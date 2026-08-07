'use client'

import { useEffect, useMemo, useState, useTransition } from "react"
import {
  getReporteActividadClienteAction,
  type ClienteActividad,
  type ReporteActividadCliente,
} from "src/lib/actions/reportes/getReporteActividadCliente"
import {
  Users, Briefcase, Activity, Crown,
  ArrowUpDown, AlertCircle, RefreshCw, Filter,
  ClipboardCheck, FileText, Mail, Calculator, Trophy,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

// ═════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════

const fmtNum = (n: number) => new Intl.NumberFormat("es-AR").format(n)

function nombreCliente(c: ClienteActividad) {
  if (c.tipoPersona === "JURIDICA" && c.tipoSociedad) {
    return `${c.tipoSociedad} — ${c.nombre}`
  }
  return `${c.nombre}${c.apellido ? ` ${c.apellido}` : ""}`
}

// Colores por dimensión de actividad — coherentes con el resto del sistema
const COLORES = {
  tareas:      { bg: "bg-indigo-500", text: "text-indigo-700", light: "bg-indigo-100", border: "border-indigo-200" },
  documentos:  { bg: "bg-blue-500",   text: "text-blue-700",   light: "bg-blue-100",   border: "border-blue-200" },
  ocas:        { bg: "bg-rose-500",   text: "text-rose-700",   light: "bg-rose-100",   border: "border-rose-200" },
  calculos:    { bg: "bg-violet-500", text: "text-violet-700", light: "bg-violet-100", border: "border-violet-200" },
} as const

// ═════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════

type SortKey =
  | "nombre" | "totalCasos" | "totalTareas" | "totalDocumentos"
  | "totalOcas" | "totalCalculos" | "totalAcciones"

export function ReporteActividadClienteView() {
  const [data, setData] = useState<ReporteActividadCliente | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [fechaDesde, setFechaDesde] = useState<string>("")
  const [fechaHasta, setFechaHasta] = useState<string>("")

  const [sortKey, setSortKey] = useState<SortKey>("totalAcciones")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const cargar = () => {
    setError(null)
    startTransition(async () => {
      const result = await getReporteActividadClienteAction({
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
      })
      if ("error" in result) {
        setError(result.error)
        setData(null)
      } else {
        setData(result)
      }
    })
  }

  useEffect(() => { cargar() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tabla ordenable ──────────────────────────────────────────────────
  const clientesOrdenados = useMemo(() => {
    if (!data) return []
    const arr = [...data.clientes]
    arr.sort((a, b) => {
      let av: any, bv: any
      if (sortKey === "nombre") {
        av = nombreCliente(a).toLowerCase()
        bv = nombreCliente(b).toLowerCase()
      } else {
        av = (a as any)[sortKey]
        bv = (b as any)[sortKey]
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })
    return arr
  }, [data, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir(key === "nombre" ? "asc" : "desc")
    }
  }

  // ── Ranking: Top 10 clientes por actividad ───────────────────────────
  const top10 = useMemo(() => {
    if (!data) return []
    return [...data.clientes]
      .sort((a, b) => b.totalAcciones - a.totalAcciones)
      .slice(0, 10)
  }, [data])

  // Máximo del top 10 para escalar las barras
  const maxAcciones = top10.length > 0 ? top10[0].totalAcciones : 1

  return (
    <div className="space-y-6">

      {/* ═══ FILTROS ═══ */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">Filtros</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={e => setFechaDesde(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={e => setFechaHasta(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
            <button
              onClick={cargar}
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md flex items-center gap-2 justify-center disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
              {isPending ? "Cargando..." : "Aplicar filtros"}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            El filtro se aplica sobre la fecha de cada acción. Se cuentan las acciones ocurridas en el período,
            sin importar cuándo se creó el expediente.
          </p>
        </CardContent>
      </Card>

      {/* ═══ ERROR ═══ */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">No se pudo generar el reporte</p>
            <p className="text-xs text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* ═══ SIN DATOS ═══ */}
      {data && data.clientes.length === 0 && !isPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <p className="text-sm font-semibold text-amber-800">No hay actividad registrada para el período seleccionado</p>
          <p className="text-xs text-amber-700 mt-1">
            Probá ampliando el rango de fechas o dejando los filtros vacíos para ver toda la actividad histórica.
          </p>
        </div>
      )}

      {/* ═══ KPIs ═══ */}
      {data && data.clientes.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Clientes con actividad"
            value={fmtNum(data.resumen.totalClientes)}
            icon={<Users className="w-5 h-5 text-indigo-600" />}
            iconBg="bg-indigo-100"
          />
          <KpiCard
            label="Expedientes activos"
            value={fmtNum(data.resumen.totalCasosActivos)}
            icon={<Briefcase className="w-5 h-5 text-blue-600" />}
            iconBg="bg-blue-100"
          />
          <KpiCard
            label="Total de acciones"
            value={fmtNum(data.resumen.totalAccionesCartera)}
            icon={<Activity className="w-5 h-5 text-emerald-600" />}
            iconBg="bg-emerald-100"
          />
          <KpiCard
            label="Cliente más activo"
            value={data.resumen.clienteMasActivo?.nombre ?? "—"}
            subtitle={
              data.resumen.clienteMasActivo
                ? `${fmtNum(data.resumen.clienteMasActivo.totalAcciones)} acciones`
                : undefined
            }
            icon={<Crown className="w-5 h-5 text-amber-600" />}
            iconBg="bg-amber-100"
          />
        </div>
      )}

      {/* ═══ RANKING: TOP 10 CLIENTES POR ACTIVIDAD ═══ */}
      {data && top10.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b bg-slate-50/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Trophy className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-800">Top 10 clientes que más te consumen</CardTitle>
                <CardDescription>
                  Ranking por cantidad de acciones registradas en el período. Cada barra muestra el desglose por tipo:
                  tareas, documentos, plantillas Correo Argentino y cálculos.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">

            {/* Leyenda de colores */}
            <div className="flex items-center gap-4 flex-wrap mb-6 text-xs">
              <LeyendaChip color={COLORES.tareas.bg} icon={<ClipboardCheck className="w-3 h-3" />} label="Tareas completadas" />
              <LeyendaChip color={COLORES.documentos.bg} icon={<FileText className="w-3 h-3" />} label="Documentos" />
              <LeyendaChip color={COLORES.ocas.bg} icon={<Mail className="w-3 h-3" />} label="Plantillas Correo Argentino" />
              <LeyendaChip color={COLORES.calculos.bg} icon={<Calculator className="w-3 h-3" />} label="Cálculos" />
            </div>

            {/* Ranking */}
            <div className="space-y-4">
              {top10.map((c, idx) => (
                <BarraCliente key={c.id} cliente={c} rank={idx + 1} maxAcciones={maxAcciones} />
              ))}
            </div>

          </CardContent>
        </Card>
      )}

      {/* ═══ TABLA COMPLETA ═══ */}
      {data && data.clientes.length > 0 && (
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <FileText className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-800">Detalle por cliente</CardTitle>
                <CardDescription>
                  {data.clientes.length} {data.clientes.length === 1 ? "cliente con actividad" : "clientes con actividad"} en el período.
                  Clickeá los encabezados para ordenar.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <Th label="Cliente" sortKey="nombre" current={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
                  <Th label="Expedientes" sortKey="totalCasos" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <Th label="Tareas" sortKey="totalTareas" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <Th label="Docs" sortKey="totalDocumentos" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <Th label="OCAs" sortKey="totalOcas" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <Th label="Cálculos" sortKey="totalCalculos" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  <Th label="Total" sortKey="totalAcciones" current={sortKey} dir={sortDir} onSort={toggleSort} highlight />
                </tr>
              </thead>
              <tbody>
                {clientesOrdenados.map(c => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">{nombreCliente(c)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      {fmtNum(c.totalCasos)}
                      <span className="text-[10px] text-slate-400 ml-1">
                        ({fmtNum(c.casosActivos)} act / {fmtNum(c.casosCerrados)} cer)
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={c.totalTareas > 0 ? "text-indigo-700 font-medium" : "text-slate-300"}>
                        {fmtNum(c.totalTareas)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={c.totalDocumentos > 0 ? "text-blue-700 font-medium" : "text-slate-300"}>
                        {fmtNum(c.totalDocumentos)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={c.totalOcas > 0 ? "text-rose-700 font-medium" : "text-slate-300"}>
                        {fmtNum(c.totalOcas)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={c.totalCalculos > 0 ? "text-violet-700 font-medium" : "text-slate-300"}>
                        {fmtNum(c.totalCalculos)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900 bg-blue-50/40">
                      {fmtNum(c.totalAcciones)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ═══ METODOLOGÍA ═══ */}
      {data && data.clientes.length > 0 && (
        <div className="mt-2 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
          <p className="text-sm text-blue-900 font-semibold mb-2">📖 Metodología del Reporte</p>
          <div className="text-xs text-blue-800 space-y-2">
            <p>
              <strong>Actividad total:</strong> suma de acciones registradas en la bitácora del sistema para expedientes vinculados a cada cliente. Se cuentan 4 tipos de acciones:
            </p>
            <ul className="ml-4 space-y-0.5 list-disc">
              <li><strong>Tareas completadas</strong> — eventos de la agenda marcados como completados</li>
              <li><strong>Documentos</strong> — archivos subidos al expediente</li>
              <li><strong>Plantillas Correo Argentino</strong> — telegramas del Correo Argentino generados</li>
              <li><strong>Cálculos</strong> — liquidaciones de indemnización guardadas</li>
            </ul>
            <p>
              <strong>Alcance:</strong> todos los clientes con al menos una acción registrada en el período seleccionado. Se incluyen casos activos y cerrados por igual.
            </p>
            <p>
              <strong>Filtro de fechas:</strong> se aplica sobre la fecha de cada acción individual (no sobre la fecha de creación del expediente). Esto permite ver la actividad real del período, incluso en casos abiertos hace mucho tiempo.
            </p>
            <p>
              <strong>Exclusiones:</strong> clientes archivados, casos traspasados a otros estudios, y clientes sin acciones en el período.
            </p>
            <p className="text-blue-700 italic">
              <strong>Nota importante:</strong> el sistema no lleva registro de horas de trabajo. La actividad es un conteo de acciones auditables, no una medida de tiempo dedicado. Este reporte responde <em>"¿qué clientes concentran mi actividad operativa?"</em>, no <em>"¿cuánto tiempo real le dediqué?"</em>.
            </p>
          </div>
        </div>
      )}

      {/* Loading placeholder */}
      {!data && !error && (
        <div className="text-center py-12 text-slate-400 text-sm">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin opacity-50" />
          Cargando reporte...
        </div>
      )}

    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═════════════════════════════════════════════════════════════════════════

// ── KPI Card ────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, iconBg, subtitle }: {
  label: string
  value: string
  icon: React.ReactNode
  iconBg: string
  subtitle?: string
}) {
  return (
    <Card className="bg-white border border-slate-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 ${iconBg} rounded-lg shrink-0`}>{icon}</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500 font-medium">{label}</p>
            <p className="text-xl font-bold text-slate-900 truncate">{value}</p>
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Barra de ranking con desglose stackeado ─────────────────────────────
function BarraCliente({ cliente, rank, maxAcciones }: {
  cliente: ClienteActividad
  rank: number
  maxAcciones: number
}) {
  const pctAncho = (cliente.totalAcciones / maxAcciones) * 100

  const segmentos = [
    { valor: cliente.totalTareas,      color: COLORES.tareas.bg,      label: "Tareas",     icon: ClipboardCheck },
    { valor: cliente.totalDocumentos,  color: COLORES.documentos.bg,  label: "Documentos", icon: FileText },
    { valor: cliente.totalOcas,        color: COLORES.ocas.bg,        label: "OCAs",       icon: Mail },
    { valor: cliente.totalCalculos,    color: COLORES.calculos.bg,    label: "Cálculos",   icon: Calculator },
  ]

  const total = cliente.totalAcciones

  return (
    <div className="group">
      {/* Header con rank + nombre + total */}
      <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-sm font-bold w-6 text-center shrink-0 ${
            rank === 1 ? "text-amber-600" :
            rank === 2 ? "text-slate-500" :
            rank === 3 ? "text-orange-600" :
            "text-slate-400"
          }`}>
            {rank}
          </span>
          <span className="text-sm font-semibold text-slate-800 truncate">{nombreCliente(cliente)}</span>
          <span className="text-[10px] text-slate-400 shrink-0">
            · {fmtNum(cliente.totalCasos)} exp. ({fmtNum(cliente.casosActivos)} act)
          </span>
        </div>
        <span className="text-sm font-bold text-slate-900 shrink-0">{fmtNum(total)}</span>
      </div>

      {/* Barra stackeada */}
      <div className="relative w-full h-6 bg-slate-100 rounded-md overflow-hidden">
        <div
          className="flex h-full transition-all"
          style={{ width: `${pctAncho}%` }}
        >
          {segmentos.map((seg, i) => {
            if (seg.valor === 0) return null
            const pctSeg = (seg.valor / total) * 100
            return (
              <div
                key={i}
                className={`${seg.color} h-full flex items-center justify-center transition-opacity hover:opacity-80`}
                style={{ width: `${pctSeg}%` }}
                title={`${seg.label}: ${seg.valor}`}
              >
                {pctSeg >= 8 && (
                  <span className="text-[10px] font-bold text-white">{seg.valor}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Desglose numérico debajo de la barra */}
      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500 flex-wrap">
        {cliente.totalTareas > 0 && (
          <span className="flex items-center gap-1">
            <ClipboardCheck className="w-2.5 h-2.5 text-indigo-500" />
            <span>{fmtNum(cliente.totalTareas)} tareas</span>
          </span>
        )}
        {cliente.totalDocumentos > 0 && (
          <span className="flex items-center gap-1">
            <FileText className="w-2.5 h-2.5 text-blue-500" />
            <span>{fmtNum(cliente.totalDocumentos)} docs</span>
          </span>
        )}
        {cliente.totalOcas > 0 && (
          <span className="flex items-center gap-1">
            <Mail className="w-2.5 h-2.5 text-rose-500" />
            <span>{fmtNum(cliente.totalOcas)} OCAs</span>
          </span>
        )}
        {cliente.totalCalculos > 0 && (
          <span className="flex items-center gap-1">
            <Calculator className="w-2.5 h-2.5 text-violet-500" />
            <span>{fmtNum(cliente.totalCalculos)} cálculos</span>
          </span>
        )}
      </div>
    </div>
  )
}

// ── Leyenda chip ────────────────────────────────────────────────────────
function LeyendaChip({ color, icon, label }: {
  color: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-3 h-3 rounded ${color}`}></div>
      <span className="text-slate-600 flex items-center gap-1">
        {icon}
        {label}
      </span>
    </div>
  )
}

// ── Header ordenable ────────────────────────────────────────────────────
function Th({ label, sortKey, current, dir, onSort, align = "right", highlight = false }: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: "asc" | "desc"
  onSort: (k: SortKey) => void
  align?: "left" | "right"
  highlight?: boolean
}) {
  const isActive = current === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-3 py-2 text-xs font-semibold cursor-pointer select-none whitespace-nowrap
        ${align === "left" ? "text-left" : "text-right"}
        ${highlight ? "bg-blue-50/40" : ""}
        ${isActive ? "text-blue-700" : "text-slate-600 hover:text-slate-900"}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${isActive ? "opacity-100" : "opacity-30"}`} />
        {isActive && <span className="text-[10px]">{dir === "asc" ? "↑" : "↓"}</span>}
      </span>
    </th>
  )
}