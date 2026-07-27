'use server'

import { getUserSessionServer } from "@/auth/actions/auth-actions"
import prisma from "src/lib/db/prisma"

// ═════════════════════════════════════════════════════════════════════════
// REPORTE: Evolución y tendencia de cartera
//
// Cambios respecto a la versión anterior:
//   - Se ELIMINAN los cálculos de porcentaje vs período anterior. Cuando la
//     base es 0 esos porcentajes son matemáticamente sin sentido.
//   - Se REEMPLAZA "balance neto" por "crecimiento" (lenguaje no técnico).
//   - Se AGREGA el conteo de cartera activa al inicio del rango, para poder
//     mostrar en el gráfico la evolución REAL del tamaño de la cartera.
//   - Cada bucket del período trae ahora `carteraAcumulada`: cuántos
//     expedientes activos había al final de ese período.
// ═════════════════════════════════════════════════════════════════════════

// Tipos y helpers de agrupación (SIN CAMBIOS)
type Granularidad = 'semanal' | 'mensual' | 'trimestral' | 'anual'

interface Filtros {
  fechaDesde?: string  // 'YYYY-MM-DD'
  fechaHasta?: string  // 'YYYY-MM-DD'
  granularidad?: Granularidad
  fuero?: string       // 'todos' | 'LABORAL' | 'CIVIL' | ...
}

export interface BucketPeriodo {
  periodo: string           // clave (2025-W36, 2025-09, 2025-Q3, 2025)
  etiqueta: string          // label legible
  fechaInicio: Date
  fechaFin: Date
  ingresos: number
  cierres: number
  crecimiento: number       // ingresos - cierres (renombrado de "neto")
  carteraAcumulada: number  // cartera activa al final del período
}

// ── PADS PARA CÁLCULOS DE ISO ──────────────────────────────────────────
function pad(n: number, len = 2) { return String(n).padStart(len, '0') }

function claveSemana(d: Date): { clave: string, inicio: Date, fin: Date } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  const clave = `${date.getUTCFullYear()}-W${pad(weekNo)}`

  const inicioSemana = new Date(d)
  const day = inicioSemana.getDay() || 7
  inicioSemana.setDate(inicioSemana.getDate() - day + 1)
  inicioSemana.setHours(0, 0, 0, 0)

  const finSemana = new Date(inicioSemana)
  finSemana.setDate(inicioSemana.getDate() + 6)
  finSemana.setHours(23, 59, 59, 999)

  return { clave, inicio: inicioSemana, fin: finSemana }
}

function claveMes(d: Date): { clave: string, inicio: Date, fin: Date } {
  const clave = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
  const inicio = new Date(d.getFullYear(), d.getMonth(), 1)
  const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
  return { clave, inicio, fin }
}

function claveTrimestre(d: Date): { clave: string, inicio: Date, fin: Date } {
  const q = Math.floor(d.getMonth() / 3) + 1
  const clave = `${d.getFullYear()}-Q${q}`
  const inicio = new Date(d.getFullYear(), (q - 1) * 3, 1)
  const fin = new Date(d.getFullYear(), q * 3, 0, 23, 59, 59, 999)
  return { clave, inicio, fin }
}

function claveAño(d: Date): { clave: string, inicio: Date, fin: Date } {
  const clave = `${d.getFullYear()}`
  const inicio = new Date(d.getFullYear(), 0, 1)
  const fin = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999)
  return { clave, inicio, fin }
}

function calcularClave(d: Date, granularidad: Granularidad) {
  switch (granularidad) {
    case 'semanal':    return claveSemana(d)
    case 'mensual':    return claveMes(d)
    case 'trimestral': return claveTrimestre(d)
    case 'anual':      return claveAño(d)
  }
}

function etiquetaBonita(clave: string, granularidad: Granularidad): string {
  if (granularidad === 'mensual') {
    const [year, month] = clave.split('-')
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    return `${nombresMeses[parseInt(month) - 1]} ${year}`
  }
  if (granularidad === 'trimestral') {
    const [year, q] = clave.split('-')
    return `${q} ${year}`
  }
  return clave
}

// ── GENERAR PERIODOS COMPLETOS (SIN CAMBIOS) ───────────────────────────
function generarPeriodosCompletos(
  fechaDesde: Date,
  fechaHasta: Date,
  granularidad: Granularidad
): Array<{ clave: string, etiqueta: string, inicio: Date, fin: Date }> {
  const periodos: Array<{ clave: string, etiqueta: string, inicio: Date, fin: Date }> = []
  let cursor = new Date(fechaDesde)
  cursor.setHours(0, 0, 0, 0)

  while (cursor <= fechaHasta) {
    const { clave, inicio, fin } = calcularClave(cursor, granularidad)
    if (!periodos.find(p => p.clave === clave)) {
      periodos.push({ clave, etiqueta: etiquetaBonita(clave, granularidad), inicio, fin })
    }

    switch (granularidad) {
      case 'semanal':    cursor.setDate(cursor.getDate() + 7); break
      case 'mensual':    cursor.setMonth(cursor.getMonth() + 1); break
      case 'trimestral': cursor.setMonth(cursor.getMonth() + 3); break
      case 'anual':      cursor.setFullYear(cursor.getFullYear() + 1); break
    }
  }

  return periodos
}

// ═════════════════════════════════════════════════════════════════════════
// ACTION PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════

export async function getEvolucionCarteraAction(filtros: Filtros = {}) {
  try {
    const user = await getUserSessionServer()
    if (!user?.id) return { error: 'No autorizado' }

    const rol = user.rol?.toUpperCase()
    if (rol === 'ADMIN' || rol === 'CLIENTE') return { error: 'Sin acceso al reporte' }

    // ─── DEFAULTS ────────────────────────────────────────────────────
    const hoy = new Date()
    const seisMesesAtras = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1)
    const finMesActual = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999)

    const fechaDesde = filtros.fechaDesde ? new Date(filtros.fechaDesde + 'T00:00:00') : seisMesesAtras
    const fechaHasta = filtros.fechaHasta ? new Date(filtros.fechaHasta + 'T23:59:59') : finMesActual
    const granularidad = filtros.granularidad || 'mensual'
    const fuero = filtros.fuero && filtros.fuero !== 'todos' ? filtros.fuero : null

    // ─── ALCANCE ─────────────────────────────────────────────────────
    const whereAlcance: any = { esTraspasado: false }
    if (rol === 'ABOGADO') whereAlcance.abogadoId = user.id
    if (fuero) whereAlcance.fuero = fuero

    // ─── CONTEO DE CARTERA ACTIVA AL INICIO DEL RANGO ────────────────
    // Cuántos expedientes activos había el día anterior al inicio del rango.
    // Un caso está "activo" en una fecha si:
    //   - fechaInicio <= esa fecha  (ya existía)
    //   - fechaCierre > esa fecha O es null  (no estaba cerrado aún)
    const fechaAntesRango = new Date(fechaDesde)
    fechaAntesRango.setMilliseconds(fechaAntesRango.getMilliseconds() - 1)

    const carteraInicial = await prisma.caso.count({
      where: {
        ...whereAlcance,
        fechaInicio: { lte: fechaAntesRango },
        OR: [
          { fechaCierre: null },
          { fechaCierre: { gt: fechaAntesRango } },
        ],
      }
    })

    // ─── CONSULTAS DE INGRESOS Y CIERRES ─────────────────────────────
    const [ingresosRaw, cierresRaw, fuerosStats] = await Promise.all([
      // Ingresos: casos con fechaInicio en el rango
      prisma.caso.findMany({
        where: { ...whereAlcance, fechaInicio: { gte: fechaDesde, lte: fechaHasta } },
        select: { fechaInicio: true, fuero: true },
      }),

      // Cierres: casos cerrados en el rango
      prisma.caso.findMany({
        where: {
          ...whereAlcance,
          estaCerrado: true,
          fechaCierre: { gte: fechaDesde, lte: fechaHasta },
        },
        select: { fechaCierre: true, fuero: true },
      }),

      // Distribución por fuero (contexto)
      prisma.caso.groupBy({
        by: ['fuero'],
        where: { ...whereAlcance, fechaInicio: { gte: fechaDesde, lte: fechaHasta } },
        _count: true,
      }),
    ])

    // ─── AGRUPACIÓN POR PERÍODO ──────────────────────────────────────
    // Generamos TODOS los períodos del rango (incluso vacíos)
    const periodosCompletos = generarPeriodosCompletos(fechaDesde, fechaHasta, granularidad)

    // Map inicial con ceros
    const bucketMap = new Map<string, BucketPeriodo>(
      periodosCompletos.map(p => [p.clave, {
        periodo: p.clave,
        etiqueta: p.etiqueta,
        fechaInicio: p.inicio,
        fechaFin: p.fin,
        ingresos: 0,
        cierres: 0,
        crecimiento: 0,
        carteraAcumulada: 0,
      }])
    )

    // Volcar ingresos
    for (const c of ingresosRaw) {
      if (!c.fechaInicio) continue
      const { clave } = calcularClave(c.fechaInicio, granularidad)
      const b = bucketMap.get(clave)
      if (b) b.ingresos++
    }

    // Volcar cierres
    for (const c of cierresRaw) {
      if (!c.fechaCierre) continue
      const { clave } = calcularClave(c.fechaCierre, granularidad)
      const b = bucketMap.get(clave)
      if (b) b.cierres++
    }

    // Ordenar buckets por fecha y calcular crecimiento y cartera acumulada
    const buckets = Array.from(bucketMap.values()).sort(
      (a, b) => a.fechaInicio.getTime() - b.fechaInicio.getTime()
    )

    // Calcular crecimiento (ingresos - cierres) y cartera acumulada
    let carteraAcum = carteraInicial
    for (const b of buckets) {
      b.crecimiento = b.ingresos - b.cierres
      carteraAcum += b.crecimiento
      b.carteraAcumulada = carteraAcum
    }

    // ─── AGREGADOS GLOBALES ──────────────────────────────────────────
    const totalIngresos = buckets.reduce((s, b) => s + b.ingresos, 0)
    const totalCierres = buckets.reduce((s, b) => s + b.cierres, 0)
    const crecimientoTotal = totalIngresos - totalCierres
    const ratio = totalIngresos > 0 ? (totalCierres / totalIngresos) * 100 : 0
    const carteraFinal = carteraInicial + crecimientoTotal

    // Período mejor / peor (por ingresos)
    let mejorPeriodo: { etiqueta: string, ingresos: number } | null = null
    let peorPeriodo: { etiqueta: string, ingresos: number } | null = null
    if (buckets.length > 0) {
      const sorted = [...buckets].sort((a, b) => b.ingresos - a.ingresos)
      mejorPeriodo = { etiqueta: sorted[0].etiqueta, ingresos: sorted[0].ingresos }
      peorPeriodo = { etiqueta: sorted[sorted.length - 1].etiqueta, ingresos: sorted[sorted.length - 1].ingresos }
    }

    // ─── FUEROS ──────────────────────────────────────────────────────
    const totalIngresosParaPct = totalIngresos || 1
    const fueros = fuerosStats.map((f: any) => ({
      fuero: f.fuero || 'SIN_ESPECIFICAR',
      ingresos: f._count,
      porcentaje: parseFloat(((f._count / totalIngresosParaPct) * 100).toFixed(1)),
    })).sort((a, b) => b.ingresos - a.ingresos)

    return {
      periodos: buckets,
      resumen: {
        totalIngresos,
        totalCierres,
        crecimientoTotal,       // ingresos - cierres del rango completo (antes "netoTotal")
        ratio: parseFloat(ratio.toFixed(1)),
        mejorPeriodo,
        peorPeriodo,
        carteraInicial,         // cuántos expedientes activos había al inicio del rango
        carteraFinal,           // cuántos hay al final del rango
      },
      fueros,
      parametros: {
        granularidad,
        fuero: fuero || 'todos',
        fechaDesde: fechaDesde.toISOString(),
        fechaHasta: fechaHasta.toISOString(),
      },
    }
  } catch (error) {
    console.error('Error en getEvolucionCarteraAction:', error)
    return { error: 'Error al generar el reporte' }
  }
}