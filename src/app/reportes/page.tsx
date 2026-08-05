// app/reportes/page.tsx
//
// CAMBIO: se saca la agrupación por bloques (Personal / Operativo / Expedientes /
// Estratégico) y queda una grilla plana con todos los reportes disponibles.
// El diseño de cada card se mantiene idéntico. Sigue filtrando por rol
// (asistentes no ven reportes marcados como soloAbogado).

import Link from "next/link"
import { redirect, notFound } from "next/navigation"
import { Sidebar } from "@/app/components/sidebar"
import { Header } from "@/app/components/header"
import { getUserSessionServer } from "@/auth/actions/auth-actions"
import {
  ClipboardCheck, Briefcase, BarChart3, MapPinned, Timer,
  TrendingUp, Target, PieChart, LineChart, FileText, Wallet,
  ChevronRight, LayoutDashboard, Zap
} from "lucide-react"

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  blue:    { bg: "bg-blue-50",    text: "text-blue-600",    border: "border-blue-200" },
  cyan:    { bg: "bg-cyan-50",    text: "text-cyan-600",    border: "border-cyan-200" },
  purple:  { bg: "bg-purple-50",  text: "text-purple-600",  border: "border-purple-200" },
  indigo:  { bg: "bg-indigo-50",  text: "text-indigo-600",  border: "border-indigo-200" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
  amber:   { bg: "bg-amber-50",   text: "text-amber-600",   border: "border-amber-200" },
  rose:    { bg: "bg-rose-50",    text: "text-rose-600",    border: "border-rose-200" },
  slate:   { bg: "bg-slate-50",   text: "text-slate-600",   border: "border-slate-200" },
  orange:  { bg: "bg-orange-50",  text: "text-orange-600",  border: "border-orange-200" },
}

type Reporte = {
  titulo: string
  descripcion: string
  href: string
  icono: any
  color: keyof typeof COLOR_MAP
  soloAbogado: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Grilla plana de reportes (sin agrupación por categorías).
// El orden acá es el orden en que se van a mostrar en pantalla.
// Mantiene el criterio anterior de forma implícita: primero los reportes
// operativos que ven todos, después los estratégicos que ven solo abogados.
// ─────────────────────────────────────────────────────────────────────────────
const REPORTES: Reporte[] = [
  {
    titulo: "Log de Movimientos",
    descripcion: "Registro de cambios en mis expedientes",
    href: "/reportes/auditoria",
    icono: FileText,
    color: "slate",
    soloAbogado: true,
  },
  {
    titulo: "Cumplimiento de Plazos",
    descripcion: "Cómo se trabajó: eventos cumplidos en plazo, con demora y vencidas",
    href: "/reportes/cumplimiento-tareas",
    icono: ClipboardCheck,
    color: "blue",
    soloAbogado: false,
  },
  {
    titulo: "Carga de trabajo",
    descripcion: "Qué tenés encima hoy: expedientes, agenda, eventos activos y próximos a vencer",
    href: "/reportes/matriz-carga",
    icono: Briefcase,
    color: "cyan",
    soloAbogado: false,
  },
  {
    titulo: "Composición de la Agenda",
    descripcion: "Qué tipo de trabajo hace el estudio: procesal vs interna, categorías, contexto",
    href: "/reportes/composicion-tareas",
    icono: BarChart3,
    color: "purple",
    soloAbogado: false,
  },
  {
    titulo: "Distribución de expedientes por ubicación geográfica",
    descripcion: "Organización logística de visitas a tribunales",
    href: "/reportes/ubicacion-geografica",
    icono: MapPinned,
    color: "emerald",
    soloAbogado: false,
  },
  {
    titulo: "Estado de expedientes por etapa",
    descripcion: "Dónde están trabados los expedientes y cuáles requieren atención",
    href: "/reportes/tiempo-por-etapa",
    icono: Timer,
    color: "amber",
    soloAbogado: true,
  },
  {
    titulo: "Resultados de expedientes cerrados",
    descripcion: "Tasa de éxito, recupero y resultados por motivo de cierre",
    href: "/reportes/analisis-resultados",
    icono: Target,
    color: "rose",
    soloAbogado: true,
  },
  {
    titulo: "Cuantía y Liquidaciones",
    descripcion: "Capital en expectativa, distribución por tipo y top expedientes",
    href: "/reportes/cuantia-liquidaciones",
    icono: Wallet,
    color: "emerald",
    soloAbogado: true,
  },
  {
    titulo: "Composición de cartera por fuero",
    descripcion: "Dónde está el volumen y el valor económico del estudio",
    href: "/reportes/cartera-fuero",
    icono: PieChart,
    color: "indigo",
    soloAbogado: true,
  },
  {
    titulo: "Análisis de cartera de clientes",
    descripcion: "Perfil de la base de clientes: activos, recurrentes, antigüedad",
    href: "/reportes/cartera-clientes",
    icono: TrendingUp,
    color: "emerald",
    soloAbogado: true,
  },
  {
    titulo: "Evolución y tendencia de cartera",
    descripcion: "Flujo de entrada y salida de expedientes a lo largo del tiempo",
    href: "/reportes/evolucion-cartera",
    icono: LineChart,
    color: "blue",
    soloAbogado: true,
  },
  {
    titulo: "Actividad por cliente",
    descripcion: "Cuánto trabajo operativo genera cada cliente en tu cartera",
    href: "/reportes/esfuerzo-vs-resultado",
    icono: Zap,
    color: "orange",
    soloAbogado: true,
  },
]

export default async function ReportesPage() {
  const user = await getUserSessionServer()
  if (!user) redirect("/api/auth/signin")

  const userRol = user.rol?.toUpperCase()
  if (userRol === "CLIENTE" || userRol === "ADMIN") notFound()

  const esAbogado = userRol === "ABOGADO"

  // Filtrar reportes según rol (los asistentes no ven los soloAbogado)
  const reportesVisibles = REPORTES.filter(r => !r.soloAbogado || esAbogado)

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <div className="w-full">

            {/* Breadcrumb */}
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-slate-400">
              <Link href="/" className="hover:text-slate-700 transition-colors flex items-center gap-1">
                <LayoutDashboard className="w-3.5 h-3.5" />
                Inicio
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-slate-600 font-medium">Reportes</span>
            </nav>

            {/* Encabezado */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900">Reportes</h1>
              <p className="text-sm text-slate-500 mt-1">
                Herramientas de análisis para la toma de decisiones del estudio.
              </p>
            </div>

            {/* Grilla plana de reportes (sin secciones) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {reportesVisibles.map(r => {
                const cfg = COLOR_MAP[r.color]
                const Icon = r.icono
                return (
                  <Link
                    key={r.href}
                    href={r.href}
                    className="group flex items-start gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:shadow-lg hover:border-blue-300 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 duration-500"
                  >
                    <div className={`p-2.5 rounded-lg ${cfg.bg} shrink-0 group-hover:scale-110 transition-transform`}>
                      <Icon className={`w-5 h-5 ${cfg.text}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors">
                        {r.titulo}
                      </p>
                      <p className="text-[11px] leading-relaxed text-slate-500 mt-1 line-clamp-2">
                        {r.descripcion}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}