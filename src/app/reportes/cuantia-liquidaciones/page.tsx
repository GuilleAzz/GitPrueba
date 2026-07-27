// src/app/reportes/cuantia-liquidaciones/page.tsx

import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Wallet, PieChart as PieChartIcon, Trophy, AlertTriangle } from "lucide-react"
import { Sidebar } from "@/app/components/sidebar"
import { Header } from "@/app/components/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getUserSessionServer } from "@/auth/actions/auth-actions"
import prisma from "src/lib/db/prisma"

import KPIsCuantia from "./components/KPIsCuantia"
import FiltrosCuantia from "./components/FiltrosCuantia"
import DistribucionTipo from "./components/DistribucionTipo"
import TopExpedientes from "./components/TopExpedientes"

// ─────────────────────────────────────────────────────────────────────────────
// Reporte FI-008 · Historial de cuantía y liquidaciones
//
// Consolida los cálculos guardados (modelo Liquidacion) vinculados a expedientes.
// Muestra: Capital en Expectativa, distribución por tipo, top 5 de cuantía.
//
// Visible para ABOGADO y ASISTENTE. ADMIN (técnico) y CLIENTE quedan fuera.
// ─────────────────────────────────────────────────────────────────────────────

type Periodo = "mes" | "trimestre" | "anio" | "todo"
type EstadoCaso = "activos" | "todos" | "cerrados"
type TipoFiltro = "todos" | "DESPIDO" | "LRT" | "CAPITALIZACION"

interface SearchParams {
  periodo?:    Periodo
  abogadoId?:  string
  tipo?:       TipoFiltro
  estado?:     EstadoCaso
}

function rangoFechasPeriodo(periodo: Periodo): { desde: Date | null } {
  const ahora = new Date()
  switch (periodo) {
    case "mes": {
      const desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
      return { desde }
    }
    case "trimestre": {
      const desde = new Date(ahora)
      desde.setMonth(desde.getMonth() - 3)
      return { desde }
    }
    case "anio": {
      const desde = new Date(ahora.getFullYear(), 0, 1)
      return { desde }
    }
    default:
      return { desde: null }
  }
}


export default async function ReporteCuantiaLiquidacionesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await getUserSessionServer()
  if (!user) redirect("/auth/login")

  const userRol = user.rol?.toUpperCase() || ""
  const esAbogado   = userRol === "ABOGADO"
  const esAsistente = userRol === "ASISTENTE"

  if (!esAbogado && !esAsistente) {
    if (userRol === "CLIENTE") redirect("/portal")
    notFound()
  }

  const periodo   = (searchParams.periodo   ?? "todo")     as Periodo
  const tipo      = (searchParams.tipo      ?? "todos")    as TipoFiltro
  const estado    = (searchParams.estado    ?? "activos")  as EstadoCaso
  const abogadoId = searchParams.abogadoId ?? ""

  const { desde } = rangoFechasPeriodo(periodo)

  // Filtros del caso vinculado:
  // - estado del caso (activos / cerrados / todos)
  // - si es ABOGADO, se restringe a sus expedientes (visión personal)
  // - si es ASISTENTE, puede filtrar por abogado vía URL
  const whereCaso: any = {}
  if (estado === "activos") whereCaso.estaCerrado = false
  if (estado === "cerrados") whereCaso.estaCerrado = true
  if (esAbogado) whereCaso.abogadoId = user.id
  if (abogadoId && esAsistente) whereCaso.abogadoId = abogadoId

  const where: any = {
    eliminadoEn: null,                  // soft delete
    casoId:      { not: null },         // solo cálculos atados a expediente
    caso:        whereCaso,
  }
  if (tipo !== "todos") where.tipo = tipo
  if (desde) where.createdAt = { gte: desde }

  const liquidaciones = await prisma.liquidacion.findMany({
    where,
    include: {
      caso: {
        select: {
          id: true, numero: true, titulo: true, estaCerrado: true,
          abogado: { select: { id: true, nombre: true, apellido: true } },
          cliente: { select: { nombre: true, apellido: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // Solo el ASISTENTE puede elegir abogado; el ABOGADO siempre se ve a sí mismo
  const abogadosDisponibles = esAsistente
    ? await prisma.user.findMany({
        where: { isActive: true, rol: "ABOGADO" },
        select: { id: true, nombre: true, apellido: true },
        orderBy: { nombre: "asc" },
      })
    : []

  // ── Agregaciones ──────────────────────────────────────────────────────────
  const capitalTotal = liquidaciones.reduce((acc, l) => acc + Number(l.montoTotal), 0)
  const cantidadCalculos = liquidaciones.length

  const distribucion = [
    { tipo: "DESPIDO" as const,        label: "Despido",         color: "#e11d48" },
    { tipo: "LRT" as const,            label: "Accidente LRT",   color: "#f59e0b" },
    { tipo: "CAPITALIZACION" as const, label: "Capitalización",  color: "#6366f1" },
  ].map(({ tipo, label, color }) => {
    const delTipo = liquidaciones.filter(l => l.tipo === tipo)
    const monto   = delTipo.reduce((acc, l) => acc + Number(l.montoTotal), 0)
    return {
      tipo, label, color,
      cantidad: delTipo.length,
      monto,
      porcentaje: capitalTotal > 0 ? (monto / capitalTotal) * 100 : 0,
    }
  })

  // Top expedientes (agrupados por casoId)
  const mapaPorCaso = new Map<string, {
    casoId: string; numero: string; titulo: string; cliente: string; abogado: string;
    estaCerrado: boolean; tiposSet: Set<string>; cantidad: number; montoTotal: number;
  }>()
  for (const l of liquidaciones) {
    if (!l.caso) continue
    const key = l.caso.id
    const actual = mapaPorCaso.get(key) ?? {
      casoId:      l.caso.id,
      numero:      l.caso.numero,
      titulo:      l.caso.titulo,
      cliente:     `${l.caso.cliente.nombre} ${l.caso.cliente.apellido ?? ""}`.trim(),
      abogado:     `${l.caso.abogado.nombre ?? ""} ${l.caso.abogado.apellido ?? ""}`.trim() || "—",
      estaCerrado: l.caso.estaCerrado,
      tiposSet:    new Set<string>(),
      cantidad:    0,
      montoTotal:  0,
    }
    actual.cantidad   += 1
    actual.montoTotal += Number(l.montoTotal)
    actual.tiposSet.add(l.tipo)
    mapaPorCaso.set(key, actual)
  }
  const topExpedientes = [...mapaPorCaso.values()]
    .sort((a, b) => b.montoTotal - a.montoTotal)
    .slice(0, 5)
    .map(({ tiposSet, ...rest }) => ({ ...rest, tipos: [...tiposSet] }))

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto py-8 px-4 space-y-6">

            <nav className="flex items-center gap-2 text-sm text-slate-500">
              <Link href="/reportes" className="flex items-center gap-1 hover:text-slate-800 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Reportes
              </Link>
              <span>/</span>
              <span className="text-slate-800 font-medium">Cuantía y Liquidaciones</span>
            </nav>

            <div className="flex items-start gap-4 flex-wrap">
              <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-slate-900">Cuantía y Liquidaciones</h1>
                <p className="text-slate-500 text-sm mt-1">
                  Capital en expectativa, distribución por tipo y expedientes de mayor cuantía.
                </p>
              </div>
            </div>

            <FiltrosCuantia
              periodo={periodo}
              tipo={tipo}
              estado={estado}
              abogadoId={abogadoId}
              abogadosDisponibles={abogadosDisponibles}
              mostrarFiltroAbogado={esAsistente}
            />

            {cantidadCalculos === 0 ? (
              <Card>
                <CardContent className="p-10 text-center text-slate-400">
                  <Wallet className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="font-medium text-slate-500">No hay cálculos vinculados a expedientes para estos filtros.</p>
                  <p className="text-xs mt-2 max-w-md mx-auto">
                    Los cálculos guardados como "sueltos" (sin vínculo a un expediente) no se incluyen en este reporte
                    porque mide capital atado a juicios reales.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <KPIsCuantia
                  capitalTotal={capitalTotal}
                  cantidadCalculos={cantidadCalculos}
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <Card>
                      <CardHeader className="border-b bg-slate-50/50">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <PieChartIcon className="h-5 w-5 text-indigo-600" />
                          Distribución del Capital por Tipo de Cálculo
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6">
                        <DistribucionTipo data={distribucion} capitalTotal={capitalTotal} />
                      </CardContent>
                    </Card>
                  </div>

                  <div className="lg:col-span-1">
                    <Card className="h-full">
                      <CardHeader className="border-b bg-slate-50/50">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Trophy className="h-5 w-5 text-amber-600" />
                          Top 5 Expedientes
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <TopExpedientes expedientes={topExpedientes} />
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <Card className="bg-slate-50/50 border-slate-200">
                  <CardContent className="p-4 text-xs text-slate-500 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                    <div className="space-y-1">
                      <p>
                        <span className="font-semibold">Notas metodológicas.</span>{" "}
                        Los montos son estimaciones sobre los cálculos guardados, no representan condena firme ni cobro asegurado.
                        El sistema no proyecta honorarios: su regulación depende de la etapa procesal alcanzada y de la base que
                        fije el tribunal, y es una decisión profesional ajena al alcance de esta herramienta.
                        El período filtra por fecha de guardado del cálculo.
                      </p>
                      <p>
                        Cálculos sueltos (no vinculados a expedientes) no se incluyen. Los cálculos eliminados (soft delete) se excluyen automáticamente.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}