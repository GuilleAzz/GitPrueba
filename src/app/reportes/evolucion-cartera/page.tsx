// app/reportes/evolucion-cartera/page.tsx

import React from "react"
import Link from "next/link"
import { Sidebar } from "@/app/components/sidebar"
import { Header } from "@/app/components/header"
import { getUserSessionServer } from "@/auth/actions/auth-actions"
import prisma from "src/lib/db/prisma"
import {
  subDays, startOfMonth, format, isBefore, isAfter,
} from "date-fns"
import { es } from "date-fns/locale"
import {
  ArrowLeft, TrendingUp, ArrowUpRight, ArrowDownRight, Minus,
  Scale, Layers, AlertTriangle, CheckCircle2, Lightbulb, Wallet
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

import { FiltroTiempo } from "./components/FiltroTiempo"
import { TablaFlujo } from "./components/Tablaflujo"
import { TablaComposicion } from "./components/Tablacomposicion"
import { ToggleVistaEvolucion } from "./components/ToggleVistaEvolucion"
import { GraficoEvolucion } from "./components/GraficoEvolucion"
import { redirect, notFound } from "next/navigation"
import { NotaContextoPeriodo } from "@/app/reportes/components/NotaContextoPeriodo"

const PERIODOS = [
  { key: "30",  label: "Últimos 30 días",  dias: 30 },
  { key: "90",  label: "Últimos 90 días",  dias: 90 },
  { key: "180", label: "Últimos 6 meses",  dias: 180 },
  { key: "365", label: "Últimos 12 meses", dias: 365 },
]

export default async function ReporteEvolucionCarteraPage({
  searchParams
}: {
  searchParams: { periodo?: string; vista?: string }
}) {
  const user = await getUserSessionServer()
  if (!user) redirect("/api/auth/signin")

  const userRol = user.rol?.toUpperCase()

  // Solo abogados y admin pueden ver este reporte
  if (userRol === "CLIENTE" || userRol === "ASISTENTE") notFound()

  const esAdmin = userRol === "ADMIN"

  // ── Toggle personal/gerencial (para abogados) ────────────────────────────
  const vistaParam = searchParams.vista === 'gerencial' ? 'gerencial' : 'personal'
  const vistaActual: 'personal' | 'gerencial' = esAdmin ? 'gerencial' : vistaParam

  // ── Filtrado por abogado según vista ─────────────────────────────────────
  const filtroAbogado = vistaActual === 'personal'
    ? { abogadoId: user.id }
    : {}

  // ── Rango de tiempo ──────────────────────────────────────────────────────
  const periodoKey = searchParams.periodo || "180"
  const periodoObj = PERIODOS.find(p => p.key === periodoKey) || PERIODOS[2]
  const diasRango  = periodoObj.dias

  const hoy = new Date()
  const desde = subDays(hoy, diasRango)

  // ── Data cruda ───────────────────────────────────────────────────────────
  const [casosIngresados, casosCerrados, todosCasosActivos] = await Promise.all([
    // Casos con fechaInicio en el rango (INGRESOS)
    prisma.caso.findMany({
      where: {
        ...filtroAbogado,
        fechaInicio: { gte: desde, lte: hoy },
        esTraspasado: false,
      },
      select: {
        id: true,
        fechaInicio: true,
        fuero: true,
      },
    }),

    // Casos cerrados en el rango (CIERRES)
    prisma.caso.findMany({
      where: {
        ...filtroAbogado,
        estaCerrado: true,
        fechaCierre: { gte: desde, lte: hoy },
        esTraspasado: false,
      },
      select: {
        id: true,
        fechaCierre: true,
        fuero: true,
      },
    }),

    // Cartera activa AL DÍA DE HOY (para el nuevo KPI)
    prisma.caso.count({
      where: {
        ...filtroAbogado,
        estaCerrado: false,
        esTraspasado: false,
      },
    }),
  ])

  const totalIngresos = casosIngresados.length
  const totalCierres  = casosCerrados.length
  const crecimientoTotal = totalIngresos - totalCierres    // renombrado de "netoTotal"

  // ── Composición por FUERO ────────────────────────────────────────────────
  const composicionIngresos = new Map<string, number>()
  for (const c of casosIngresados) {
    const f = c.fuero ?? "SIN_ESPECIFICAR"
    composicionIngresos.set(f, (composicionIngresos.get(f) || 0) + 1)
  }
  const composicionCierres = new Map<string, number>()
  for (const c of casosCerrados) {
    const f = c.fuero ?? "SIN_ESPECIFICAR"
    composicionCierres.set(f, (composicionCierres.get(f) || 0) + 1)
  }
  const top3Ingresos = [...composicionIngresos.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([fuero, count]) => ({
      fuero,
      count,
      pct: totalIngresos > 0 ? (count / totalIngresos) * 100 : 0
    }))
  const top3Cierres = [...composicionCierres.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([fuero, count]) => ({
      fuero,
      count,
      pct: totalCierres > 0 ? (count / totalCierres) * 100 : 0
    }))

  // ── Serie mensual ────────────────────────────────────────────────────────
  // Cantidad de meses a agrupar según el rango
  const cantMeses = Math.max(1, Math.ceil(diasRango / 30))
  const filasMap = new Map<string, { ingresos: number; cierres: number }>()
  const ordenKeys: string[] = []

  for (let i = cantMeses - 1; i >= 0; i--) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    const key = format(fecha, "yyyy-MM")
    ordenKeys.push(key)
    filasMap.set(key, { ingresos: 0, cierres: 0 })
  }

  for (const c of casosIngresados) {
    if (!c.fechaInicio) continue
    const key = format(c.fechaInicio, "yyyy-MM")
    if (filasMap.has(key)) {
      filasMap.get(key)!.ingresos++
    }
  }
  for (const c of casosCerrados) {
    if (!c.fechaCierre) continue
    const key = format(c.fechaCierre, "yyyy-MM")
    if (filasMap.has(key)) {
      filasMap.get(key)!.cierres++
    }
  }

  // ── Cálculo de cartera acumulada ────────────────────────────────────────
  // Punto de partida: cartera activa AL INICIO del rango
  // Fórmula: casos con fechaInicio antes del rango que NO estaban cerrados al inicio
  const carteraInicial = await prisma.caso.count({
    where: {
      ...filtroAbogado,
      fechaInicio: { lt: desde },
      esTraspasado: false,
      OR: [
        { estaCerrado: false },
        { fechaCierre: { gte: desde } },
      ],
    },
  })

  // Ahora arrastramos el balance mes a mes
  let carteraAcum = carteraInicial
  const filasMensuales = ordenKeys.map(key => {
    const info = filasMap.get(key)!
    carteraAcum += (info.ingresos - info.cierres)
    return {
      key,
      label: format(new Date(key + "-01"), "MMM yyyy", { locale: es }),
      ingresos: info.ingresos,
      cierres: info.cierres,
      balance: info.ingresos - info.cierres,
      carteraAcumulada: carteraAcum,
      ingresosMesAnterior: 0,   // (no se usa ahora que sacamos los %, se calcula abajo por si algo depende)
      cierresMesAnterior: 0,
    }
  })

  // Rellenar mes anterior para posible uso futuro (no muestra %, pero deja el dato)
  for (let i = 0; i < filasMensuales.length; i++) {
    if (i > 0) {
      filasMensuales[i].ingresosMesAnterior = filasMensuales[i - 1].ingresos
      filasMensuales[i].cierresMesAnterior  = filasMensuales[i - 1].cierres
    }
  }

  // ── Tendencia mes a mes ──────────────────────────────────────────────────
  // Comparamos media reciente (primera mitad) vs media anterior (segunda mitad)
  // Para calcular VARIACIÓN. Si la base es 0 → null (no se muestra %)
  const mitadReciente = Math.ceil(filasMensuales.length / 2)
  const mesesRecientes = filasMensuales.slice(-mitadReciente)
  const mesesAnteriores = filasMensuales.slice(0, filasMensuales.length - mitadReciente)

  const mediaReciente = mesesRecientes.length > 0
    ? mesesRecientes.reduce((s, m) => s + m.ingresos, 0) / mesesRecientes.length
    : 0
  const mediaAnterior = mesesAnteriores.length > 0
    ? mesesAnteriores.reduce((s, m) => s + m.ingresos, 0) / mesesAnteriores.length
    : 0

  const cierresMediaReciente = mesesRecientes.length > 0
    ? mesesRecientes.reduce((s, m) => s + m.cierres, 0) / mesesRecientes.length
    : 0
  const cierresMediaAnterior = mesesAnteriores.length > 0
    ? mesesAnteriores.reduce((s, m) => s + m.cierres, 0) / mesesAnteriores.length
    : 0

  // NULL cuando no hay base de comparación (evitamos porcentajes "sin sentido")
  const variacionIngresos = mediaAnterior > 0
    ? ((mediaReciente - mediaAnterior) / mediaAnterior) * 100
    : null
  const variacionCierres = cierresMediaAnterior > 0
    ? ((cierresMediaReciente - cierresMediaAnterior) / cierresMediaAnterior) * 100
    : null

  // Tendencia solo si tenemos variación
  const tendencia = variacionIngresos === null
    ? 'sin_base' as const
    : variacionIngresos > 10
      ? 'crecimiento' as const
      : variacionIngresos < -10
        ? 'contraccion' as const
        : 'estable' as const

  // ── Insights (recomendaciones) ───────────────────────────────────────────
  const insights: Array<{
    tipo: 'positivo' | 'negativo' | 'neutro',
    titulo: string,
    descripcion: string
  }> = []

  if (crecimientoTotal > 0) {
    insights.push({
      tipo: 'positivo',
      titulo: 'Cartera en crecimiento',
      descripcion: `Entraron ${totalIngresos} expedientes y cerraste ${totalCierres} en los últimos ${diasRango} días. Neto: +${crecimientoTotal}.`
    })
  } else if (crecimientoTotal < 0) {
    insights.push({
      tipo: 'negativo',
      titulo: 'Cartera en contracción',
      descripcion: `Cerraste más expedientes de los que ingresaste (${Math.abs(crecimientoTotal)} menos). Puede reflejar un ciclo de resolución de casos viejos.`
    })
  } else {
    insights.push({
      tipo: 'neutro',
      titulo: 'Cartera estable',
      descripcion: `Ingresos y cierres se equilibran en el período (${totalIngresos} vs ${totalCierres}).`
    })
  }

  if (tendencia === 'crecimiento' && variacionIngresos !== null) {
    insights.push({
      tipo: 'positivo',
      titulo: 'Tendencia positiva',
      descripcion: `Los ingresos crecen ${variacionIngresos.toFixed(0)}% comparando la primera y la segunda mitad del período.`
    })
  } else if (tendencia === 'contraccion' && variacionIngresos !== null) {
    insights.push({
      tipo: 'negativo',
      titulo: 'Tendencia negativa',
      descripcion: `Los ingresos bajaron ${Math.abs(variacionIngresos).toFixed(0)}% en la segunda mitad del período.`
    })
  }

  const totalMovimientos = totalIngresos + totalCierres

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">

            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <Link href="/reportes">
                  <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-800 gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Volver
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                    Evolución y tendencia de cartera
                  </h1>
                  <p className="text-sm text-slate-500">
                    {vistaActual === 'personal' && !esAdmin
                      ? "Flujo de expedientes de tu cartera personal"
                      : "Flujo de expedientes del estudio completo"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {!esAdmin && <ToggleVistaEvolucion vistaActual={vistaActual} />}
                <FiltroTiempo periodos={PERIODOS} periodoActual={periodoObj.key} />
              </div>
            </div>

            {/* Nota de contexto del período */}
            <NotaContextoPeriodo
              desde={desde.toISOString()}
              hasta={hoy.toISOString()}
              rangoLabel={periodoObj.label.toLowerCase()}
            />

            {/* ═══ KPIs ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 rounded-lg">
                      <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Ingresos totales</p>
                      <p className="text-2xl font-bold text-slate-900">{totalIngresos}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Expedientes abiertos en el rango</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-50 rounded-lg">
                      <ArrowDownRight className="w-5 h-5 text-rose-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Cierres totales</p>
                      <p className="text-2xl font-bold text-slate-900">{totalCierres}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Expedientes cerrados en el rango</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* KPI: Crecimiento (renombrado de "Balance neto") */}
              <Card className="border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      crecimientoTotal > 0 ? "bg-emerald-50" :
                      crecimientoTotal < 0 ? "bg-rose-50" : "bg-slate-100"
                    }`}>
                      {crecimientoTotal > 0 ? <ArrowUpRight className="w-5 h-5 text-emerald-600" /> :
                       crecimientoTotal < 0 ? <ArrowDownRight className="w-5 h-5 text-rose-600" /> :
                       <Minus className="w-5 h-5 text-slate-500" />}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Crecimiento del período</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {crecimientoTotal > 0 ? "+" : ""}{crecimientoTotal}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {crecimientoTotal > 0 ? "La cartera creció"
                          : crecimientoTotal < 0 ? "La cartera se achicó"
                          : "La cartera se mantuvo estable"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* KPI: Cartera activa (reemplaza "Ratio de recuperación") */}
              <Card className="border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Wallet className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Cartera activa</p>
                      <p className="text-2xl font-bold text-slate-900">{todosCasosActivos}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Total al día de hoy (arrancó en {carteraInicial})
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ═══ GRÁFICO COMBINADO (nuevo) ═══ */}
            <div className="mb-6">
              <GraficoEvolucion filas={filasMensuales} carteraInicial={carteraInicial} />
            </div>

            {/* ═══ TABLA DE FLUJO POR MES ═══ */}
            <Card className="mb-6 border-slate-200 shadow-sm">
              <CardHeader className="border-b bg-slate-50/50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Layers className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-800">
                      Flujo de expedientes por mes
                    </CardTitle>
                    <CardDescription>
                      Detalle numérico mes a mes del rango seleccionado.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <TablaFlujo filas={filasMensuales} />
              </CardContent>
            </Card>


            {/* ═══ INSIGHTS ═══ */}
            {insights.length > 0 && (
              <Card className="mb-6 border-slate-200 shadow-sm">
                <CardHeader className="border-b bg-slate-50/50 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 rounded-lg">
                      <Lightbulb className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold text-slate-800">
                        Lectura del período
                      </CardTitle>
                      <CardDescription>
                        Observaciones automáticas basadas en los datos.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  {insights.map((ins, i) => (
                    <div key={i} className={`p-3 rounded-lg border-l-4 ${
                      ins.tipo === 'positivo' ? 'bg-emerald-50 border-emerald-400' :
                      ins.tipo === 'negativo' ? 'bg-rose-50 border-rose-400' :
                      'bg-slate-50 border-slate-400'
                    }`}>
                      <div className="flex items-start gap-2">
                        {ins.tipo === 'positivo' && <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />}
                        {ins.tipo === 'negativo' && <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />}
                        {ins.tipo === 'neutro'   && <Minus            className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />}
                        <div>
                          <p className={`text-sm font-semibold ${
                            ins.tipo === 'positivo' ? 'text-emerald-800' :
                            ins.tipo === 'negativo' ? 'text-rose-800' : 'text-slate-800'
                          }`}>{ins.titulo}</p>
                          <p className={`text-xs mt-0.5 ${
                            ins.tipo === 'positivo' ? 'text-emerald-700' :
                            ins.tipo === 'negativo' ? 'text-rose-700' : 'text-slate-600'
                          }`}>{ins.descripcion}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* ═══ METODOLOGÍA ═══ */}
            <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
              <p className="text-sm text-blue-900 font-semibold mb-2">Metodología del Reporte</p>
              <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
                <li><strong>Ingresos:</strong> expedientes con fecha de inicio dentro del período.</li>
                <li><strong>Cierres:</strong> expedientes marcados como cerrados con fecha de cierre dentro del período.</li>
                <li><strong>Crecimiento:</strong> ingresos menos cierres. Positivo = la cartera creció. Negativo = se achicó.</li>
                <li><strong>Cartera activa:</strong> total de expedientes activos al día de hoy. En el gráfico, la línea muestra su evolución mes a mes.</li>
                <li><strong>Alcance:</strong> {vistaActual === 'personal' && !esAdmin ? 'expedientes asignados al abogado' : 'todos los expedientes del estudio'}. Se excluyen expedientes traspasados.</li>
                <li className="italic text-blue-700">
                  <strong>Nota:</strong> el reporte muestra diferencias absolutas (+/-) en vez de porcentajes de un mes a otro para evitar comparaciones distorsionadas cuando algún mes no tiene actividad.
                </li>
              </ul>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}