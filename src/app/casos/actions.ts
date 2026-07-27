// src/app/casos/actions.ts
'use server'

import { getUserSessionServer } from "@/auth/actions/auth-actions"
import { CasoService } from "@/lib/aplication/services/caso.service"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import prisma from "src/lib/db/prisma" 
import { Priority, TipoCaso } from "@prisma/client"
import { registrarAuditoria } from "../../lib/actions/auditoria"
import {
  TIPO_CASO_LABELS,
  PRIORIDAD_CASO_LABELS,
  ROL_LABELS,
} from "src/lib/utils/labels"

// [MAQ.EST] Importar la máquina de estados para validación server-side
import {
  validarTransicion,
  getTipoTransicion,
} from "src/lib/domain/expediente-estados"

const casoService = new CasoService()

export type State = {
  error?: string | null
  message?: string | null
}

type CasoState = {
  message?: string | null
  error?: string | null
}

// ============================================================================
// TIPOS DE CASO VÁLIDOS (Actualizado)
// ============================================================================
const TIPOS_CASO_VALIDOS = [
  "LABORAL", 
  "CIVIL_COMERCIAL",
  "FAMILIA", 
  "PENAL", 
  "SUCESIONES", 
  "CONTENCIOSO_ADMINISTRATIVO", 
  "OTRO",
]

// ============================================================================
// 1. CREAR CASO (CON SOPORTE PARA ASISTENTE)
// ============================================================================
export async function crearCasoAction(
  prevState: CasoState,
  formData: FormData
): Promise<CasoState> {
  const user = await getUserSessionServer()

  if (!user || !user.id) {
    return { error: "No autorizado. Debes iniciar sesión." }
  }

  const titulo = formData.get("titulo") as string
  const descripcion = formData.get("descripcion") as string
  const tipo = formData.get("tipo") as string
  const estado = formData.get("estado") as string
  const priority = formData.get("priority") as string
  const fuero = formData.get("fuero") as string
  const provincia = formData.get("provincia") as string
  const ciudad = formData.get("ciudad") as string
  const juzgado = formData.get("juzgado") as string
  const ubicacionFisica = formData.get("ubicacionFisica") as string
  const contraparteNombre = formData.get("contraparteNombre") as string
  const contraparteDni = formData.get("contraparteDni") as string
  const montoDisputa = formData.get("montoDisputa") as string
  const clienteId = formData.get("clienteId") as string

  if (!titulo || titulo.trim().length < 5) {
    return { error: "El título es obligatorio y debe tener al menos 5 caracteres" }
  }
  if (!tipo) return { error: "Debes seleccionar un tipo de caso" }
  if (!estado) return { error: "Debes seleccionar un estado" }
  if (!priority) return { error: "Debes seleccionar una prioridad" }
  if (!fuero) return { error: "Debes seleccionar un fuero" }
  if (!provincia) return { error: "Debes seleccionar una provincia" }
  if (!clienteId) return { error: "Debes seleccionar un cliente" }
  
  const clienteExiste = await prisma.cliente.findFirst({
    where: { id: clienteId, abogadoId: user.id, activo: true }
  })
  if (!clienteExiste) {
    return { error: "El cliente seleccionado no es válido o no te pertenece" }
  }
  
  const currentYear = new Date().getFullYear()
  const lastCase = await prisma.caso.findFirst({
    where: { numero: { startsWith: `EXP-${currentYear}` } },
    orderBy: { numero: 'desc' }
  })
  
  let nextNumber = 1
  if (lastCase) {
    const parts = lastCase.numero.split('-')
    if (parts.length === 3) {
      nextNumber = parseInt(parts[2]) + 1
    }
  }
  
  const numero = `EXP-${currentYear}-${nextNumber.toString().padStart(3, '0')}`
  
  try {
    const nuevoCaso = await prisma.caso.create({
      data: {
        numero,
        titulo: titulo.trim(),
        descripcion: descripcion?.trim() || "",
        tipo: tipo as any,
        estado: estado as any,
        priority: priority as any,
        fuero: fuero as any,
        provincia: provincia as any,
        ciudad: ciudad?.trim() || null,
        juzgado: juzgado?.trim() || null,
        ubicacionFisica: ubicacionFisica?.trim() || null,
        contraparteNombre: contraparteNombre?.trim() || null,
        contraparteDni: contraparteDni?.trim() || null,
        montoDisputa: montoDisputa ? parseFloat(montoDisputa) : null,
        clienteId,
        abogadoId: user.id,
        fechaInicio: new Date(),
      }
    })
    
    // Registrar en bitácora
    await registrarAuditoria({
      casoId: nuevoCaso.id,
      usuarioId: user.id,
      accion: "CREATE",
      texto: `Expediente creado: ${nuevoCaso.numero} - ${nuevoCaso.titulo}`,
      detalle: `Tipo: ${nuevoCaso.tipo}, Prioridad: ${nuevoCaso.priority}, Cliente: ${clienteExiste.nombre}${clienteExiste.apellido ? ' ' + clienteExiste.apellido : ''}`
    })

    // [HIST-MONTO] Si el caso se crea con monto en disputa, generar la fila inicial del historial
    // + registrar bitácora vinculada para trazabilidad completa
    if (nuevoCaso.montoDisputa !== null && nuevoCaso.montoDisputa !== undefined) {
      const filaInicial = await prisma.historialMonto.create({
        data: {
          casoId: nuevoCaso.id,
          monto: nuevoCaso.montoDisputa,
          motivo: 'Monto declarado al abrir el expediente',
          esInicial: true,
          registradoPorId: user.id,
        }
      })

      await registrarAuditoria({
        casoId: nuevoCaso.id,
        usuarioId: user.id,
        accion: "MONTO_CHANGE",
        texto: `Monto inicial declarado: $${Number(nuevoCaso.montoDisputa).toLocaleString('es-AR')}`,
        detalle: `Motivo: Monto declarado al abrir el expediente`,
        estadoAnterior: null,
        estadoNuevo: nuevoCaso.montoDisputa.toString(),
        historialMontoId: filaInicial.id,
      })
    }
    
    console.log(`Caso creado: ${nuevoCaso.numero} - ${nuevoCaso.titulo}`)
    
  } catch (error: any) {
    console.error("Error en crearCasoAction:", error)
    
    if (error.code === 'P2002') {
      return { error: "Ya existe un caso con ese número. Intenta nuevamente." }
    }
    
    return { error: error.message || "Error al crear el caso" }
  }
  
  revalidatePath("/casos")
  redirect("/casos")
}
// ============================================================================
// 2. ACTUALIZAR CASO (CON AUDITORÍA DE CAMBIOS + MÁQUINA DE ESTADOS)
// ============================================================================
export async function actualizarCasoAction(
  prevState: CasoState,
  formData: FormData
): Promise<CasoState> {
  const user = await getUserSessionServer()

  if (!user || !user.id) {
    return { error: "No autorizado. Debes iniciar sesión." }
  }

  const casoId = formData.get("id") as string
  if (!casoId) return { error: "ID del caso no válido" }

  // ═══════════════════════════════════════════════════════════════════════
  // VERIFICAR EXISTENCIA Y PERMISOS
  // ═══════════════════════════════════════════════════════════════════════
  const casoActual = await prisma.caso.findUnique({
    where: { id: casoId },
    include: {
      cliente: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          activo: true,
        }
      }
    }
  })

  if (!casoActual) return { error: "Caso no encontrado" }

  if (casoActual.abogadoId !== user.id) {
    return { error: "No tienes permisos para editar este caso" }
  }

  if (!casoActual.cliente?.activo) {
    return {
      error: `El cliente ${casoActual.cliente?.nombre} ${casoActual.cliente?.apellido || ''} está deshabilitado. No se pueden hacer cambios en sus expedientes.`
    }
  }

  const titulo = formData.get("titulo") as string
  const descripcion = formData.get("descripcion") as string
  const nuevoEstado = formData.get("estado") as string
  const priority = formData.get("priority") as string
  const clienteIdNuevo = formData.get("clienteId") as string
  const juzgado = formData.get("juzgado") as string
  const ubicacionFisica = formData.get("ubicacionFisica") as string
  const montoDisputa = formData.get("montoDisputa") as string
  const motivoEstado = formData.get("motivo_estado") as string | null
  const isFavorite = formData.get("isFavorite") === "on"
  const motivoMonto = formData.get("motivo_monto") as string | null   // [HIST-MONTO]
  const motivoJuzgado = formData.get("motivo_juzgado") as string | null
  const fuero = formData.get("fuero") as string
  const provincia = formData.get("provincia") as string
  const ciudad = formData.get("ciudad") as string
  const motivoUbicacionGeo = formData.get("motivo_ubicacion") as string | null

  if (!titulo || titulo.trim().length < 5) {
    return { error: "El título es obligatorio y debe tener al menos 5 caracteres" }
  }
  if (!clienteIdNuevo) {
    return { error: "Debes seleccionar un cliente" }
  }

  const cambioCliente = clienteIdNuevo !== casoActual.clienteId
  if (cambioCliente) {
    const clienteNuevo = await prisma.cliente.findFirst({
      where: { id: clienteIdNuevo, abogadoId: user.id, activo: true }
    })
    if (!clienteNuevo) {
      return { error: "El cliente seleccionado no es válido o no te pertenece" }
    }
  }

  const cambioEstado = nuevoEstado !== casoActual.estado
  const cambioPrioridad = priority !== casoActual.priority
  const cambioFavorito = isFavorite !== casoActual.isFavorite
  const cambioJuzgado = juzgado?.trim() !== (casoActual.juzgado || '')
  const cambioUbicacion = ubicacionFisica?.trim() !== (casoActual.ubicacionFisica || '')
  const cambioFuero = (fuero?.trim() || '') !== (casoActual.fuero || '')
  const nuevoMonto = montoDisputa ? parseFloat(montoDisputa) : null
  const montoAnterior = casoActual.montoDisputa ? parseFloat(casoActual.montoDisputa.toString()) : null
  const cambioMonto = nuevoMonto !== montoAnterior

  // [MAQ.EST] Validación server-side: si es retroceso, motivo obligatorio
  if (cambioEstado) {
    const tipoTransicion = getTipoTransicion(casoActual.estado, nuevoEstado)

    if (tipoTransicion === 'invalido') {
      return { error: `Transición de estado inválida: ${casoActual.estado} → ${nuevoEstado}` }
    }

    if (tipoTransicion === 'retroceso') {
      if (!motivoEstado || motivoEstado.trim().length < 10) {
        return {
          error: 'Al retroceder de estado, debés ingresar un motivo justificado (mínimo 10 caracteres) explicando la razón procesal (nulidad, reapertura, corrección de error material, medida para mejor proveer, etc.)'
        }
      }
    }
  }

  // [UBIC-GEO] Validación server-side: si cambia la radicación, motivo obligatorio
  if (cambioFuero) {
    if (!motivoUbicacionGeo || motivoUbicacionGeo.trim().length < 5) {
      return {
        error: 'Al modificar la radicación del expediente, debés ingresar un motivo (mínimo 5 caracteres) explicando el cambio (inhibición, incompetencia, cambio de jurisdicción, etc.)'
      }
    }
  }

  // [HIST-MONTO] Validación server-side: si el monto cambia, motivo obligatorio (mínimo 5 caracteres)
  if (cambioMonto) {
    if (!motivoMonto || motivoMonto.trim().length < 5) {
      return {
        error: 'Al modificar el monto en disputa, debés ingresar un motivo (mínimo 5 caracteres) explicando el cambio (actualización monetaria, peritaje, transacción, corrección, etc.)'
      }
    }
  }

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // ACTUALIZAR EL CASO
    // ═══════════════════════════════════════════════════════════════════════
    await prisma.caso.update({
      where: { id: casoId },
      data: {
        titulo: titulo.trim(),
        descripcion: descripcion?.trim() || "",
        estado: nuevoEstado as any,
        priority: priority as any,
        clienteId: clienteIdNuevo,
        juzgado: juzgado?.trim() || null,
        ubicacionFisica: ubicacionFisica?.trim() || null,
        fuero: cambioFuero ? (fuero?.trim() || null) : undefined,
        provincia: cambioFuero ? (provincia?.trim() || null) : undefined,
        ciudad: cambioFuero ? (ciudad?.trim() || null) : undefined,
        montoDisputa: nuevoMonto,
        isFavorite: isFavorite,
        fechaUltimoCambioEstado: cambioEstado ? new Date() : casoActual.fechaUltimoCambioEstado,
      }
    })

    // ═══════════════════════════════════════════════════════════════════════
    // AUDITORÍA
    // ═══════════════════════════════════════════════════════════════════════

    // [MAQ.EST] Cambio de estado - AUDITORÍA DIFERENCIADA según sea avance o retroceso
    if (cambioEstado) {
      const tipoTransicion = getTipoTransicion(casoActual.estado, nuevoEstado)

      if (tipoTransicion === 'retroceso') {
        // Retroceso: acción específica ESTADO_RETROCESO + motivo obligatorio
        await registrarAuditoria({
          casoId: casoId,
          usuarioId: user.id,
          accion: "ESTADO_RETROCESO",
          texto: `⚠️ RETROCESO PROCESAL EXCEPCIONAL: ${casoActual.estado} → ${nuevoEstado}`,
          detalle: `Motivo justificado: ${motivoEstado}`,
          estadoAnterior: casoActual.estado,
          estadoNuevo: nuevoEstado
        })
      } else {
        // Avance normal (o legacy → activo): bitácora estándar
        await registrarAuditoria({
          casoId: casoId,
          usuarioId: user.id,
          accion: "ESTADO_CHANGE",
          texto: `Cambio de estado: ${casoActual.estado} → ${nuevoEstado}`,
          estadoAnterior: casoActual.estado,
          estadoNuevo: nuevoEstado
        })
      }
    }

    // Cambio de prioridad
    if (cambioPrioridad) {
      await registrarAuditoria({
        casoId: casoId,
        usuarioId: user.id,
        accion: "PRIORIDAD_CHANGE",
        texto: `Cambio de prioridad: ${casoActual.priority} → ${priority}`,
        estadoAnterior: casoActual.priority,
        estadoNuevo: priority
      })
    }

    // Cambio de cliente
    if (cambioCliente) {
      const clienteNuevoData = await prisma.cliente.findUnique({
        where: { id: clienteIdNuevo },
        select: { nombre: true, apellido: true }
      })

      const clienteAnteriorNombre = `${casoActual.cliente?.nombre} ${casoActual.cliente?.apellido || ''}`
      const clienteNuevoNombre = `${clienteNuevoData?.nombre} ${clienteNuevoData?.apellido || ''}`

      await registrarAuditoria({
        casoId: casoId,
        usuarioId: user.id,
        accion: "CLIENTE_CHANGE",
        texto: `Cambio de cliente: ${clienteAnteriorNombre.trim()} → ${clienteNuevoNombre.trim()}`,
        detalle: `El caso fue reasignado a otro cliente. Los datos originales del caso se mantienen.`
      })
    }

    // Cambio de juzgado
    if (cambioJuzgado) {
      const juzgadoAnterior = casoActual.juzgado || 'Sin juzgado asignado'
      const juzgadoNuevo = juzgado?.trim() || 'Sin juzgado asignado'

      await registrarAuditoria({
        casoId: casoId,
        usuarioId: user.id,
        accion: "JUZGADO_CHANGE",
        texto: `Cambio de juzgado: ${juzgadoAnterior} → ${juzgadoNuevo}`,
        detalle: motivoJuzgado?.trim()
          ? `Motivo: ${motivoJuzgado.trim()}`
          : `Modificación de la asignación jurisdiccional (impacto procesal)`,
        estadoAnterior: casoActual.juzgado,
        estadoNuevo: juzgado?.trim() || null
      })
    }

    // Cambio de ubicación física
    if (cambioUbicacion) {
      const ubicacionAnterior = casoActual.ubicacionFisica || 'Sin ubicación física asignada'
      const ubicacionNueva = ubicacionFisica?.trim() || 'Sin ubicación física asignada'

      await registrarAuditoria({
        casoId: casoId,
        usuarioId: user.id,
        accion: "UBICACION_CHANGE",
        texto: `Cambio de ubicación física: ${ubicacionAnterior} → ${ubicacionNueva}`,
        detalle: `Modificación del lugar de guarda física del expediente`,
        estadoAnterior: casoActual.ubicacionFisica,
        estadoNuevo: ubicacionFisica?.trim() || null
      })
    }

    // [UBIC-GEO] Cambio de radicación con motivo justificado
    if (cambioFuero) {
      const fueroAnterior = casoActual.fuero || 'Sin radicación asignada'
      const fueroNuevo = fuero?.trim() || 'Sin radicación asignada'

      await registrarAuditoria({
        casoId: casoId,
        usuarioId: user.id,
        accion: "UBICACION_CHANGE",
        texto: `Cambio de radicación: ${fueroAnterior} → ${fueroNuevo}`,
        detalle: motivoUbicacionGeo?.trim()
          ? `Motivo: ${motivoUbicacionGeo.trim()}`
          : `Modificación de la jurisdicción territorial del expediente`,
        estadoAnterior: casoActual.fuero,
        estadoNuevo: fuero?.trim() || null,
      })
    }

    // [HIST-MONTO] Cambio de monto en disputa: crear fila en HistorialMonto + bitácora vinculada
    if (cambioMonto) {
      const montoAnteriorFmt = montoAnterior ? `$${montoAnterior.toLocaleString('es-AR')}` : 'sin monto'
      const nuevoMontoFmt = nuevoMonto ? `$${nuevoMonto.toLocaleString('es-AR')}` : 'sin monto'

      // Solo creamos fila en HistorialMonto si el nuevo monto NO es null.
      // Si el usuario borra el monto, no tiene sentido registrar "null" como valor histórico:
      // se queda solo la bitácora del cambio con estadoNuevo=null.
      let historialMontoIdCreado: string | null = null
      if (nuevoMonto !== null) {
        const nuevaFila = await prisma.historialMonto.create({
          data: {
            casoId: casoId,
            monto: nuevoMonto,
            motivo: motivoMonto!.trim(),   // ya validado arriba
            esInicial: false,               // es una modificación, no la carga inicial
            registradoPorId: user.id,
          }
        })
        historialMontoIdCreado = nuevaFila.id
      }

      await registrarAuditoria({
        casoId: casoId,
        usuarioId: user.id,
        accion: "MONTO_CHANGE",
        texto: `Cambio de monto: ${montoAnteriorFmt} → ${nuevoMontoFmt}`,
        detalle: motivoMonto?.trim()
          ? `Motivo: ${motivoMonto.trim()}`
          : `Modificación del monto en disputa (impacto económico)`,
        estadoAnterior: montoAnterior?.toString() || null,
        estadoNuevo: nuevoMonto?.toString() || null,
        historialMontoId: historialMontoIdCreado,   // [HIST-MONTO] trazabilidad completa
      })
    }

    console.log(`Caso actualizado: ${casoId} - ${titulo}`)

  } catch (error: any) {
    console.error("Error en actualizarCasoAction:", error)

    if (error.code === 'P2002') {
      return { error: "Error de duplicado en algún campo único." }
    }

    return { error: error.message || "Error al actualizar el caso" }
  }

  revalidatePath("/casos")
  revalidatePath(`/casos/${casoId}`)
  redirect(`/casos/${casoId}`)
}

// ============================================================================
// 3. ACCIONES DE TAREAS
// ============================================================================


// ============================================================================
// 4. ACCIONES DE BITÁCORA
// ============================================================================
export async function crearBitacoraAction(prevState: State, formData: FormData): Promise<State> {
  const user = await getUserSessionServer()
  if (!user || !user.id) return { error: "No autorizado" }

  const casoId = formData.get("casoId") as string
  const texto = formData.get("texto") as string

  if (!casoId || !texto) return { error: "El texto no puede estar vacío" }

  try {
    await prisma.bitacora.create({
      data: {
        texto,
        tipo: "manual",
        accion: "Nota",
        usuarioId: user.id,
        casoId: casoId,
        detalle: "Nota manual del usuario"
      }
    })
  } catch (error) {
    return { error: "Error al guardar la nota" }
  }

  revalidatePath(`/casos/${casoId}`)
  return { message: "Nota guardada" }
}