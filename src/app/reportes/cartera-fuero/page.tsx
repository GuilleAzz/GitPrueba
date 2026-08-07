// app/reportes/cartera-fuero/page.tsx
// REPORTE EST-14: Composición de Cartera por Fuero
// ACCESO: ABOGADO (ve su cartera + vista general del estudio) y ADMIN

import Link from "next/link"
import { Sidebar } from "@/app/components/sidebar"
import { Header } from "@/app/components/header"
import { getUserSessionServer } from "@/auth/actions/auth-actions"
import prisma from "src/lib/db/prisma"
import { differenceInDays, subDays } from "date-fns"
import { ArrowLeft, Scale } from "lucide-react"
import { Button } from "@/components/ui/button"

import { KPICards } from "./components/KPICards"
import { MatrizFuero } from "./components/MatrizFuero"
import { MatrizFueroGeneral } from "./components/MatrizFueroGeneral"
import { PanelLitigiosidad } from "./components/Panellitigiosidad"
import { FiltrosCartera } from "./components/FiltrosCartera"
import { ToggleVista } from "./components/ToggleVista"
import { redirect, notFound } from "next/navigation"
import { NotaContextoPeriodo } from "@/app/reportes/components/NotaContextoPeriodo"
// ============================================================================
// MAPEO Y CONSTANTES
// ============================================================================

const TIPO_CASO_LABELS: Record<string, string> = {
  LABORAL: "Laboral",
  CIVIL_COMERCIAL: "Civil y Comercial",
  FAMILIA: "Familia",
  PENAL: "Penal",
  SUCESIONES: "Sucesiones",
  CONTENCIOSO_ADMINISTRATIVO: "Contencioso Administrativo",
  OTRO: "Otro",
}

const ETAPAS_TEMPRANAS = ["Inicio / Demanda", "Mediación / Previo"]
const ETAPAS_MEDIAS = ["Prueba (Oficios/Pericias)", "Alegatos / Conclusiones"]
const ETAPAS_TARDIAS = ["Sentencia de 1ra Instancia", "Apelación / 2da Instancia", "Ejecución de Sentencia"]

// ============================================================================
// TIPO CASO EXPANDIDO (para vista personal con casos individuales)
// ============================================================================

export type CasoDetalle = {
  id: string
  numero: string
  titulo: string
  estado: string
  montoDisputa: number
  diasDuracion: number
}

// ============================================================================
// QUERY VISTA PERSONAL — incluye casos individuales por fuero
// ============================================================================

async function getCarteraPersonal(abogadoId: string, filtroEtapa?: string) {
  const hoy = new Date()
  const hace30Dias = subDays(hoy, 30)

  const whereActivos: any = {
    abogadoId,
    estaCerrado: false,
    estado: { notIn: ["Cerrado", "Archivado", "CERRADO", "ARCHIVADO"] },
  }
  if (filtroEtapa && filtroEtapa !== "todas") {
    whereActivos.estado = filtroEtapa
  }

  const casosActivos = await prisma.caso.findMany({
    where: whereActivos,
    select: {
      id: true,
      numero: true,
      titulo: true,
      tipo: true,
      estado: true,
      montoDisputa: true,
      fechaInicio: true,
      updatedAt: true,
    },
  })

  const casosCerrados = await prisma.caso.findMany({
    where: { abogadoId, estaCerrado: true, fechaCierre: { not: null } },
    select: { tipo: true, fechaInicio: true, fechaCierre: true },
  })

  const totalActivos = casosActivos.length

  const agrupado: Record<string, typeof casosActivos> = {}
  for (const caso of casosActivos) {
    if (!agrupado[caso.tipo]) agrupado[caso.tipo] = []
    agrupado[caso.tipo].push(caso)
  }

  const cerradosPorTipo: Record<string, number[]> = {}
  for (const caso of casosCerrados) {
    if (!cerradosPorTipo[caso.tipo]) cerradosPorTipo[caso.tipo] = []
    if (caso.fechaCierre) {
      const dias = differenceInDays(caso.fechaCierre, caso.fechaInicio)
      if (dias > 0) cerradosPorTipo[caso.tipo].push(dias)
    }
  }

  const filas = Object.entries(agrupado)
    .map(([tipo, casos]) => {
      const cantidad = casos.length
      const pesoVolumen = totalActivos > 0 ? Math.round((cantidad / totalActivos) * 100) : 0
      const capitalEnLitigio = casos.reduce((sum, c) => sum + (c.montoDisputa ? Number(c.montoDisputa) : 0), 0)
      const ticketPromedio = cantidad > 0 ? Math.round(capitalEnLitigio / cantidad) : 0
      const casosConActividad = casos.filter(c => c.updatedAt >= hace30Dias).length
      const tasaActividad = cantidad > 0 ? Math.round((casosConActividad / cantidad) * 100) : 0

      const diasCierreArr = cerradosPorTipo[tipo] || []
      const promedioDiasCierre = diasCierreArr.length > 0
        ? Math.round(diasCierreArr.reduce((a, b) => a + b, 0) / diasCierreArr.length)
        : null

      const conteoEtapas: Record<string, number> = {}
      for (const c of casos) {
        conteoEtapas[c.estado] = (conteoEtapas[c.estado] || 0) + 1
      }
      const distribucionEtapas = Object.entries(conteoEtapas)
        .map(([etapa, cant]) => ({ etapa, cantidad: cant, porcentaje: Math.round((cant / cantidad) * 100) }))
        .sort((a, b) => b.cantidad - a.cantidad)

      // Casos individuales para el expand
      const casosDetalle: CasoDetalle[] = casos.map(c => ({
        id: c.id,
        numero: c.numero,
        titulo: c.titulo,
        estado: c.estado,
        montoDisputa: c.montoDisputa ? Number(c.montoDisputa) : 0,
        diasDuracion: differenceInDays(hoy, c.fechaInicio),
      })).sort((a, b) => b.diasDuracion - a.diasDuracion)

      return {
        tipo,
        tipoLabel: TIPO_CASO_LABELS[tipo] || tipo,
        cantidad,
        pesoVolumen,
        capitalEnLitigio,
        ticketPromedio,
        tasaActividad,
        promedioDiasCierre,
        distribucionEtapas,
        casosDetalle,
      }
    })
    .sort((a, b) => b.capitalEnLitigio - a.capitalEnLitigio)

  const capitalTotal = filas.reduce((s, r) => s + r.capitalEnLitigio, 0)
  const ticketGlobal = totalActivos > 0 ? Math.round(capitalTotal / totalActivos) : 0
  const fueroMasVolumen = filas.length > 0 ? [...filas].sort((a, b) => b.cantidad - a.cantidad)[0].tipoLabel : "—"
  const fueroMasValor = filas.length > 0 ? filas[0].tipoLabel : "—"

  let etapaTemprana = 0, etapaMedia = 0, etapaTardia = 0
  for (const caso of casosActivos) {
    if (ETAPAS_TEMPRANAS.includes(caso.estado)) etapaTemprana++
    else if (ETAPAS_MEDIAS.includes(caso.estado)) etapaMedia++
    else if (ETAPAS_TARDIAS.includes(caso.estado)) etapaTardia++
    else etapaTemprana++
  }

  return {
    kpis: { totalCasosActivos: totalActivos, capitalTotalEnLitigio: capitalTotal, ticketPromedioGlobal: ticketGlobal, fueroConMasVolumen: fueroMasVolumen, fueroConMasValor: fueroMasValor },
    filas,
    litigiosidad: { etapaTemprana, etapaMedia, etapaTardia, totalActivos },
  }
}

// ============================================================================
// QUERY VISTA GENERAL — sin casos individuales, puede filtrar por un colega
// ============================================================================

async function getCarteraGeneral(excluirAbogadoId: string, filtroColegaId?: string) {
  const hoy = new Date()
  const hace30Dias = subDays(hoy, 30)

  // Si filtra por colega, solo ese. Si no, todos EXCEPTO el logueado
  const whereActivos: any = {
    estaCerrado: false,
    estado: { notIn: ["Cerrado", "Archivado", "CERRADO", "ARCHIVADO"] },
  }

  if (filtroColegaId && filtroColegaId !== "todos") {
    whereActivos.abogadoId = filtroColegaId
  } else {
    // Vista "todos" incluye al logueado también — suma global del estudio
    // no hay exclusión aquí
  }

  const casosActivos = await prisma.caso.findMany({
    where: whereActivos,
    select: {
      tipo: true,
      estado: true,
      montoDisputa: true,
      updatedAt: true,
      abogadoId: true,
    },
  })

  const casosCerrados = await prisma.caso.findMany({
    where: { estaCerrado: true, fechaCierre: { not: null } },
    select: { tipo: true, fechaInicio: true, fechaCierre: true },
  })

  const totalActivos = casosActivos.length

  const agrupado: Record<string, typeof casosActivos> = {}
  for (const caso of casosActivos) {
    if (!agrupado[caso.tipo]) agrupado[caso.tipo] = []
    agrupado[caso.tipo].push(caso)
  }

  const cerradosPorTipo: Record<string, number[]> = {}
  for (const caso of casosCerrados) {
    if (!cerradosPorTipo[caso.tipo]) cerradosPorTipo[caso.tipo] = []
    if (caso.fechaCierre) {
      const dias = differenceInDays(caso.fechaCierre, caso.fechaInicio)
      if (dias > 0) cerradosPorTipo[caso.tipo].push(dias)
    }
  }

  const filas = Object.entries(agrupado)
    .map(([tipo, casos]) => {
      const cantidad = casos.length
      const pesoVolumen = totalActivos > 0 ? Math.round((cantidad / totalActivos) * 100) : 0
      const capitalEnLitigio = casos.reduce((sum, c) => sum + (c.montoDisputa ? Number(c.montoDisputa) : 0), 0)
      const ticketPromedio = cantidad > 0 ? Math.round(capitalEnLitigio / cantidad) : 0
      const casosConActividad = casos.filter(c => c.updatedAt >= hace30Dias).length
      const tasaActividad = cantidad > 0 ? Math.round((casosConActividad / cantidad) * 100) : 0

      const diasCierreArr = cerradosPorTipo[tipo] || []
      const promedioDiasCierre = diasCierreArr.length > 0
        ? Math.round(diasCierreArr.reduce((a, b) => a + b, 0) / diasCierreArr.length)
        : null

      const conteoEtapas: Record<string, number> = {}
      for (const c of casos) {
        conteoEtapas[c.estado] = (conteoEtapas[c.estado] || 0) + 1
      }
      const distribucionEtapas = Object.entries(conteoEtapas)
        .map(([etapa, cant]) => ({ etapa, cantidad: cant, porcentaje: Math.round((cant / cantidad) * 100) }))
        .sort((a, b) => b.cantidad - a.cantidad)

      return {
        tipo,
        tipoLabel: TIPO_CASO_LABELS[tipo] || tipo,
        cantidad,
        pesoVolumen,
        capitalEnLitigio,
        ticketPromedio,
        tasaActividad,
        promedioDiasCierre,
        distribucionEtapas,
      }
    })
    .sort((a, b) => b.capitalEnLitigio - a.capitalEnLitigio)

  const capitalTotal = filas.reduce((s, r) => s + r.capitalEnLitigio, 0)
  const ticketGlobal = totalActivos > 0 ? Math.round(capitalTotal / totalActivos) : 0
  const fueroMasVolumen = filas.length > 0 ? [...filas].sort((a, b) => b.cantidad - a.cantidad)[0].tipoLabel : "—"
  const fueroMasValor = filas.length > 0 ? filas[0].tipoLabel : "—"

  let etapaTemprana = 0, etapaMedia = 0, etapaTardia = 0
  for (const caso of casosActivos) {
    if (ETAPAS_TEMPRANAS.includes(caso.estado)) etapaTemprana++
    else if (ETAPAS_MEDIAS.includes(caso.estado)) etapaMedia++
    else if (ETAPAS_TARDIAS.includes(caso.estado)) etapaTardia++
    else etapaTemprana++
  }

  return {
    kpis: { totalCasosActivos: totalActivos, capitalTotalEnLitigio: capitalTotal, ticketPromedioGlobal: ticketGlobal, fueroConMasVolumen: fueroMasVolumen, fueroConMasValor: fueroMasValor },
    filas,
    litigiosidad: { etapaTemprana, etapaMedia, etapaTardia, totalActivos },
  }
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function CarteraFueroPage({ searchParams }: PageProps) {
  const user = await getUserSessionServer()
  if (!user) redirect("/api/auth/signin")

  const userRol = user.rol?.toUpperCase()
  // Defensa en profundidad — bloquear roles no operativos
if (userRol === 'CLIENTE' || userRol === 'ADMIN') notFound()
  if (userRol === "ASISTENTE") redirect("/reportes")

  const params = await searchParams
  const vista = typeof params.vista === "string" ? params.vista : "personal"
  const filtroEtapa = typeof params.etapa === "string" ? params.etapa : "todas"
  const filtroColega = typeof params.colega === "string" ? params.colega : "todos"

  // Lista de colegas para la vista general (excluye al logueado)
  const colegas = await prisma.user.findMany({
    where: { rol: "ABOGADO", id: { not: user.id } },
    select: { id: true, nombre: true, apellido: true },
    orderBy: { nombre: "asc" },
  })
  const colegasConNombre = colegas.map(a => ({
    id: a.id,
    nombre: a.nombre && a.apellido ? `${a.nombre} ${a.apellido}` : a.nombre || "Sin nombre",
  }))

  // Etapas disponibles para el filtro (vista personal)
  const etapasDisponibles = [
    "Inicio / Demanda",
    "Mediación / Previo",
    "Prueba (Oficios/Pericias)",
    "Alegatos / Conclusiones",
    "Sentencia de 1ra Instancia",
    "Apelación / 2da Instancia",
    "Ejecución de Sentencia",
  ]

  // Datos según vista activa
  const datosPersonal = vista === "personal"
    ? await getCarteraPersonal(user.id, filtroEtapa)
    : null

  const datosGeneral = vista === "general"
    ? await getCarteraGeneral(user.id, filtroColega)
    : null

  const datos = vista === "personal" ? datosPersonal! : datosGeneral!

  // Etiqueta del colega seleccionado (para subtítulo)
  const colegaSeleccionado = colegasConNombre.find(c => c.id === filtroColega)

  const hoyDate = new Date()
const desdeDate = subDays(hoyDate, 90)
const desdeISO = desdeDate.toISOString()
const hastaISO = hoyDate.toISOString()

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Link href="/reportes">
                  <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-800 gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Volver
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Scale className="h-6 w-6 text-indigo-600" />
                    Composición de cartera por fuero
                  </h1>
                  <p className="text-sm text-slate-500">
                    {vista === "personal"
                      ? "Tu cartera: volumen y capital en litigio por tipo de causa"
                      : colegaSeleccionado
                        ? `Cartera de ${colegaSeleccionado.nombre}`
                        : "Vista general del estudio — todos los abogados"}
                  </p>
                </div>
              </div>

              <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
                vista === "personal"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-purple-50 text-purple-700 border-purple-200"
              }`}>
                {vista === "personal" ? "Mi cartera" : colegaSeleccionado ? colegaSeleccionado.nombre : "Vista General"}
              </span>
            </div>

            {/* Toggle Vista Personal / General */}
            <div className="mb-5">
              <ToggleVista vistaActual={vista} />
            </div>

            <NotaContextoPeriodo
              desde={desdeISO}
              hasta={hastaISO}
              rangoLabel="últimos 90 días"
            />

            {/* Filtros — cambian según la vista */}
            <div className="mb-6">
              <FiltrosCartera
                vista={vista}
                etapas={etapasDisponibles}
                colegas={colegasConNombre}
              />
            </div>

            {/* KPIs */}
            <KPICards data={datos.kpis} vista={vista} colegaNombre={colegaSeleccionado?.nombre} />

            {/* Tabla */}
            {datos.filas.length > 0 ? (
              vista === "personal"
                ? <MatrizFuero data={datosPersonal!.filas} />
                : <MatrizFueroGeneral data={datosGeneral!.filas} />
            ) : (
              <div className="p-8 bg-white border border-slate-200 rounded-lg text-center">
                <p className="text-slate-500">No hay expedientes activos para analizar.</p>
              </div>
            )}

            {/* Panel litigiosidad */}
            {datos.litigiosidad.totalActivos > 0 && (
              <PanelLitigiosidad data={datos.litigiosidad} />
            )}

            {/* Nota de criterios */}
            <div className="mt-8 p-4 bg-slate-100 border border-slate-200 rounded-lg">
              <p className="text-xs text-slate-600">
                <strong>Criterios del reporte:</strong> Solo incluye expedientes activos (no cerrados ni archivados) |
                Capital en litigio = suma de monto en disputa | Tasa de actividad = expedientes con movimiento en últimos 30 días |
                Promedio de cierre = calculado sobre expedientes históricos cerrados del mismo fuero
              </p>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}