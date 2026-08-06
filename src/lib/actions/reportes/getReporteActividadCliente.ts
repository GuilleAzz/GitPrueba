'use server'

import { getUserSessionServer } from "@/auth/actions/auth-actions"
import prisma from "src/lib/db/prisma"

// ═════════════════════════════════════════════════════════════════════════
// REPORTE: Actividad por Cliente (ex "Esfuerzo vs Resultado")
//
// PREGUNTA CENTRAL: ¿Qué clientes concentran la actividad operativa del
// estudio en el período seleccionado?
//
// ENFOQUE:
//   - Solo mide ACTIVIDAD (acciones registradas). No mide resultado económico.
//   - El resultado económico ya se ve en otros reportes (cartera, cuantía).
//   - Los datos salen todos de la bitácora auditable del sistema.
//   - No hay fórmulas compuestas. Cada número es un conteo puro.
//
// LAS 4 DIMENSIONES DE ACTIVIDAD:
//   1. Tareas completadas   → bitácora TAREA_ESTADO_CHANGE → COMPLETADA
//   2. Documentos           → bitácora DOCUMENTO_SUBIDO
//   3. Plantillas OCA       → bitácora OCA_CREADA
//   4. Cálculos             → bitácora LIQUIDACION_CREADA
//
// FILTRO DE FECHAS:
//   Aplica a la fecha de la ACCIÓN (bitácora.createdAt), no a la creación
//   del caso. Un caso viejo con actividad reciente participa. Esto responde
//   "qué hice en este período", no "qué casos se abrieron en este período".
// ═════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

export type ClienteActividad = {
  id: string
  nombre: string
  apellido: string | null
  tipoPersona: string
  tipoSociedad: string | null

  // Contexto: expedientes del cliente
  totalCasos: number        // Total de expedientes del cliente (contexto)
  casosActivos: number
  casosCerrados: number

  // Actividad desglosada por dimensión (todos son conteos crudos)
  totalTareas: number       // Tareas completadas en el período
  totalDocumentos: number   // Documentos subidos en el período
  totalOcas: number         // Plantillas OCA generadas en el período
  totalCalculos: number     // Cálculos de indemnización guardados en el período

  // Total de acciones (suma de las 4 dimensiones)
  totalAcciones: number
}

export type ReporteActividadCliente = {
  clientes: ClienteActividad[]
  resumen: {
    totalClientes: number
    totalCasosActivos: number
    totalCasosCerrados: number
    totalAccionesCartera: number
    clienteMasActivo: {
      nombre: string
      totalAcciones: number
    } | null
  }
  parametros: {
    fechaDesde: string | null
    fechaHasta: string | null
  }
}

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

function nombreCompleto(c: {
  nombre: string
  apellido: string | null
  tipoPersona: string
  tipoSociedad: string | null
}): string {
  if (c.tipoPersona === "JURIDICA" && c.tipoSociedad) {
    return `${c.tipoSociedad} — ${c.nombre}`
  }
  return `${c.nombre}${c.apellido ? ` ${c.apellido}` : ""}`
}

// ═════════════════════════════════════════════════════════════════════════
// ACTION PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════

export async function getReporteActividadClienteAction(params: {
  fechaDesde?: string  // 'YYYY-MM-DD'
  fechaHasta?: string  // 'YYYY-MM-DD'
}): Promise<ReporteActividadCliente | { error: string }> {
  const user = await getUserSessionServer()
  if (!user?.id) return { error: "No autorizado" }
  if (user.rol !== "ABOGADO") return { error: "Solo los abogados pueden ver este reporte" }

  try {
    // ── Construir filtro de fechas para las acciones ────────────────────
    // Se aplica a bitacora.createdAt, no a caso.createdAt
    const filtroFechaAccion: any = {}
    if (params.fechaDesde) {
      filtroFechaAccion.gte = new Date(params.fechaDesde + "T00:00:00")
    }
    if (params.fechaHasta) {
      filtroFechaAccion.lte = new Date(params.fechaHasta + "T23:59:59")
    }
    const hayFiltroFecha = params.fechaDesde || params.fechaHasta

    // ── 1. Traer TODOS los clientes activos del abogado y sus casos ────
    // No filtramos casos por fecha. Traemos todos. El filtro es a nivel
    // de acciones.
    const clientesRaw = await prisma.cliente.findMany({
      where: {
        abogadoId: user.id,
        activo: true,
      },
      include: {
        casos: {
          where: {
            abogadoId: user.id,
            esTraspasado: false,
          },
          select: {
            id: true,
            estaCerrado: true,
          },
        },
      },
      orderBy: { nombre: "asc" },
    })

    if (clientesRaw.length === 0) {
      return {
        clientes: [],
        resumen: {
          totalClientes: 0,
          totalCasosActivos: 0,
          totalCasosCerrados: 0,
          totalAccionesCartera: 0,
          clienteMasActivo: null,
        },
        parametros: {
          fechaDesde: params.fechaDesde ?? null,
          fechaHasta: params.fechaHasta ?? null,
        },
      }
    }

    // ── 2. Para cada cliente, contar acciones EN EL PERÍODO ────────────
    const clientes: ClienteActividad[] = []

    for (const cli of clientesRaw) {
      const casoIds = cli.casos.map(c => c.id)

      // Cliente sin casos → no participa
      if (casoIds.length === 0) continue

      const totalCasos = cli.casos.length
      const casosCerrados = cli.casos.filter(c => c.estaCerrado).length
      const casosActivos = totalCasos - casosCerrados

      // Filtro base para bitácora: casos del cliente + fecha del período
      const bitacoraWhereBase: any = {
        casoId: { in: casoIds },
      }
      if (hayFiltroFecha) {
        bitacoraWhereBase.createdAt = filtroFechaAccion
      }

      // Contar las 4 dimensiones desde la bitácora en paralelo (más rápido)
      const [totalTareas, totalDocumentos, totalOcas, totalCalculos] = await Promise.all([
        // Tareas completadas: bitácora TAREA_ESTADO_CHANGE con estadoNuevo=COMPLETADA
        prisma.bitacora.count({
          where: {
            ...bitacoraWhereBase,
            accion: { in: ["TAREA_ESTADO_CHANGE", "TAREA_COMPLETADA_CON_DEMORA"] },
            estadoNuevo: "COMPLETADA",
          },
        }),
        // Documentos subidos
        prisma.bitacora.count({
          where: {
            ...bitacoraWhereBase,
            accion: "DOCUMENTO_SUBIDO",
          },
        }),
        // Plantillas OCA generadas
        prisma.bitacora.count({
          where: {
            ...bitacoraWhereBase,
            accion: "OCA_CREADA",
          },
        }),
        // Cálculos guardados
        prisma.bitacora.count({
          where: {
            ...bitacoraWhereBase,
            accion: "LIQUIDACION_CREADA",
          },
        }),
      ])

      const totalAcciones = totalTareas + totalDocumentos + totalOcas + totalCalculos

      // Excluir clientes sin actividad en el período (según lo hablado)
      if (totalAcciones === 0) continue

      clientes.push({
        id: cli.id,
        nombre: cli.nombre,
        apellido: cli.apellido,
        tipoPersona: cli.tipoPersona,
        tipoSociedad: cli.tipoSociedad,
        totalCasos,
        casosActivos,
        casosCerrados,
        totalTareas,
        totalDocumentos,
        totalOcas,
        totalCalculos,
        totalAcciones,
      })
    }

    // ── 3. Orden por defecto: mayor actividad primero ──────────────────
    clientes.sort((a, b) => b.totalAcciones - a.totalAcciones)

    // ── 4. Calcular resumen de la cartera ──────────────────────────────
    const totalCasosActivos = clientes.reduce((s, c) => s + c.casosActivos, 0)
    const totalCasosCerrados = clientes.reduce((s, c) => s + c.casosCerrados, 0)
    const totalAccionesCartera = clientes.reduce((s, c) => s + c.totalAcciones, 0)

    const clienteMasActivo = clientes.length > 0
      ? {
          nombre: nombreCompleto(clientes[0]),
          totalAcciones: clientes[0].totalAcciones,
        }
      : null

    return {
      clientes,
      resumen: {
        totalClientes: clientes.length,
        totalCasosActivos,
        totalCasosCerrados,
        totalAccionesCartera,
        clienteMasActivo,
      },
      parametros: {
        fechaDesde: params.fechaDesde ?? null,
        fechaHasta: params.fechaHasta ?? null,
      },
    }
  } catch (error) {
    console.error("Error generando reporte actividad cliente:", error)
    return { error: "Error al generar el reporte" }
  }
}