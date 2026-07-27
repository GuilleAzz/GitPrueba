// app/reportes/ubicacion-geografica/page.tsx
// Distribución de casos por ubicación geográfica
// ACCESO: Todos los roles (Admin, Abogado, Asistente) — reporte operativo
// Vista personal: casos propios del abogado logueado
// Vista general: distribución del estudio, coordinación, zonas con atención (ABOGADO + ADMIN)

import React from "react"
import Link from "next/link"
import { Sidebar } from "@/app/components/sidebar"
import { Header } from "@/app/components/header"
import { getUserSessionServer } from "@/auth/actions/auth-actions"
import prisma from "src/lib/db/prisma"
import { ArrowLeft, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"

import { KPIsUbicacion } from "./components/KPIsUbicacion"
import { AcordeonZonas } from "./components/AcordeonZonas"
import { ToggleVista } from "./components/ToggleVista"
import { FiltrosGeografia } from "./components/FiltrosGeografia"
import { VistaGeneralGeo, type ZonaGeneral } from "./components/VistaGeneralGeo"

import { PROVINCIAS_ARGENTINA } from "src/lib/data/argentina-ubicaciones"
import { redirect, notFound } from "next/navigation"

// ============================================================================
// TIPOS
// ============================================================================

export type CasoUbicacion = {
  id: string
  numero: string
  titulo: string
  tipo: string
  estado: string
  juzgado: string | null
  clienteNombre: string
  abogadoNombre: string
  abogadoId: string
  ultimoMovimiento: Date
  priority: string
  esUrgente: boolean
}

export type JuzgadoAgrupado = {
  nombre: string
  casos: CasoUbicacion[]
  cantidadCasos: number
  urgentes: number
}

export type ZonaGeografica = {
  id: string
  ciudad: string
  provincia: string
  coordenadas: { lat: number; lng: number } | null
  juzgados: JuzgadoAgrupado[]
  totalCasos: number
  casos: CasoUbicacion[]
}

export type KPIsData = {
  totalCasos: number
  ciudadesActivas: number
}

// ============================================================================
// HELPERS
// ============================================================================

function extraerCiudadProvincia(fuero: string | null): { ciudad: string; provincia: string } {
  if (!fuero) return { ciudad: 'Sin Especificar', provincia: 'Sin Especificar' }
  const partes = fuero.split(',').map(p => p.trim())
  if (partes.length >= 2) return { ciudad: partes[0], provincia: partes[1] }
  return { ciudad: partes[0], provincia: 'Sin Especificar' }
}

const ALIAS_UBICACIONES: Record<string, { lat: number; lng: number }> = {
  'capital federal': { lat: -34.6037, lng: -58.3816 },
  'caba': { lat: -34.6037, lng: -58.3816 },
  'buenos aires': { lat: -34.6037, lng: -58.3816 },
  'ciudad de buenos aires': { lat: -34.6037, lng: -58.3816 },
  'ciudad autonoma de buenos aires': { lat: -34.6037, lng: -58.3816 },
  'cordoba': { lat: -31.4201, lng: -64.1888 },
  'córdoba': { lat: -31.4201, lng: -64.1888 },
  'cordoba capital': { lat: -31.4201, lng: -64.1888 },
  'córdoba capital': { lat: -31.4201, lng: -64.1888 },
  'rosario': { lat: -32.9468, lng: -60.6393 },
  'mendoza': { lat: -32.8908, lng: -68.8272 },
  'tucuman': { lat: -26.8083, lng: -65.2176 },
  'tucumán': { lat: -26.8083, lng: -65.2176 },
  'san miguel de tucuman': { lat: -26.8083, lng: -65.2176 },
  'san miguel de tucumán': { lat: -26.8083, lng: -65.2176 },
  'santa fe': { lat: -31.6333, lng: -60.7000 },
  'la plata': { lat: -34.9205, lng: -57.9536 },
  'mar del plata': { lat: -38.0055, lng: -57.5426 },
  'salta': { lat: -24.7821, lng: -65.4232 },
  'neuquen': { lat: -38.9516, lng: -68.0591 },
  'neuquén': { lat: -38.9516, lng: -68.0591 },
  'rio cuarto': { lat: -33.1307, lng: -64.3499 },
  'río cuarto': { lat: -33.1307, lng: -64.3499 },
  'villa maria': { lat: -32.4103, lng: -63.2306 },
  'villa maría': { lat: -32.4103, lng: -63.2306 },
  'san francisco': { lat: -31.4297, lng: -62.0828 },
}

function buscarCoordenadasCiudad(ciudad: string, provincia: string): { lat: number; lng: number } | null {
  const ciudadNorm = ciudad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const provinciaNorm = provincia.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const combinado = `${ciudadNorm} ${provinciaNorm}`.trim()

  if (ALIAS_UBICACIONES[ciudadNorm]) return ALIAS_UBICACIONES[ciudadNorm]
  if (ALIAS_UBICACIONES[combinado]) return ALIAS_UBICACIONES[combinado]

  for (const prov of PROVINCIAS_ARGENTINA) {
    const provNombre = prov.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    if (provNombre.includes(provinciaNorm) || provinciaNorm.includes(provNombre)) {
      for (const depto of prov.departamentos) {
        const deptoNombre = depto.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        const cabeceraName = depto.cabecera?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || ''
        if (deptoNombre.includes(ciudadNorm) || ciudadNorm.includes(deptoNombre) ||
          cabeceraName.includes(ciudadNorm) || ciudadNorm.includes(cabeceraName)) {
          return depto.coordenadas
        }
      }
      return prov.coordenadas
    }
  }
  for (const prov of PROVINCIAS_ARGENTINA) {
    for (const depto of prov.departamentos) {
      const deptoNombre = depto.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      const cabeceraName = depto.cabecera?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || ''
      if (deptoNombre === ciudadNorm || cabeceraName === ciudadNorm) return depto.coordenadas
    }
  }
  for (const prov of PROVINCIAS_ARGENTINA) {
    const provNombre = prov.nombre.toLowerCase()
    if (ciudadNorm.includes(provNombre) || provNombre.includes(ciudadNorm)) return prov.coordenadas
  }
  return null
}

function humanizarProvincia(provinciaId: string): string {
  const mapa: Record<string, string> = {
    'cordoba': 'Córdoba',
    'buenos_aires': 'Buenos Aires',
    'caba': 'CABA',
    'santa_fe': 'Santa Fe',
    'mendoza': 'Mendoza',
    'tucuman': 'Tucumán',
    'entre_rios': 'Entre Ríos',
    'salta': 'Salta',
    'misiones': 'Misiones',
    'chaco': 'Chaco',
    'corrientes': 'Corrientes',
    'santiago_del_estero': 'Santiago del Estero',
    'san_juan': 'San Juan',
    'jujuy': 'Jujuy',
    'rio_negro': 'Río Negro',
    'neuquen': 'Neuquén',
    'formosa': 'Formosa',
    'chubut': 'Chubut',
    'san_luis': 'San Luis',
    'catamarca': 'Catamarca',
    'la_rioja': 'La Rioja',
    'la_pampa': 'La Pampa',
    'santa_cruz': 'Santa Cruz',
    'tierra_del_fuego': 'Tierra del Fuego',
  }
  return mapa[provinciaId] ?? provinciaId
}

const isAdmin = (rol: string) => rol?.toUpperCase() === 'ADMIN'
const isAbogado = (rol: string) => rol?.toUpperCase() === 'ABOGADO'
const isAsistente = (rol: string) => rol?.toUpperCase() === 'ASISTENTE'

// ============================================================================
// QUERY — VISTA PERSONAL (sin cambios)
// ============================================================================

async function obtenerCasosPorUbicacion(
  userId: string,
  userRol: string,
  filtroFuero: string,
  filtroEtapa: string,
  filtroAbogado: string
): Promise<{
  zonas: ZonaGeografica[]
  kpis: KPIsData
}> {
  const whereClause: any = {
    estaCerrado: false,
    estado: { notIn: ['Cerrado', 'Archivado', 'CERRADO', 'ARCHIVADO'] }
  }

  const esAdmin = userRol === 'ADMIN'
  const esAsistente = userRol === 'ASISTENTE'

  if (!esAdmin && !esAsistente) {
    whereClause.abogadoId = userId
  }

  if (filtroAbogado !== 'todos') {
    whereClause.abogadoId = filtroAbogado
  }

  if (filtroFuero !== 'todos') whereClause.tipo = filtroFuero
  if (filtroEtapa !== 'todas') whereClause.estado = filtroEtapa

  const casos = await prisma.caso.findMany({
    where: whereClause,
    include: {
      cliente: { select: { nombre: true, apellido: true } },
      abogado: { select: { id: true, nombre: true, apellido: true } }
    },
    orderBy: { updatedAt: 'desc' }
  })

  const zonasPorCiudad = new Map<string, { casos: CasoUbicacion[]; provincia: string }>()

  casos.forEach(caso => {
    const ciudad = (caso as any).ciudad || extraerCiudadProvincia(caso.fuero).ciudad
    const provinciaRaw = (caso as any).provincia || extraerCiudadProvincia(caso.fuero).provincia
    const provincia = humanizarProvincia(provinciaRaw)
    const key = `${ciudad}|${provincia}`
    if (!zonasPorCiudad.has(key)) zonasPorCiudad.set(key, { casos: [], provincia })

    const esUrgente = caso.priority === 'HIGH'
    const clienteNombre = caso.cliente
      ? `${caso.cliente.nombre} ${caso.cliente.apellido || ''}`.trim() : 'Sin cliente'
    const abogadoNombre = caso.abogado
      ? `${caso.abogado.nombre || ''} ${caso.abogado.apellido || ''}`.trim() : 'Sin asignar'

    zonasPorCiudad.get(key)!.casos.push({
      id: caso.id, numero: caso.numero, titulo: caso.titulo,
      tipo: caso.tipo, estado: caso.estado, juzgado: caso.juzgado,
      clienteNombre, abogadoNombre, abogadoId: caso.abogado?.id || '',
      ultimoMovimiento: caso.updatedAt, priority: caso.priority, esUrgente
    })
  })

  const zonas: ZonaGeografica[] = []
  zonasPorCiudad.forEach((data, key) => {
    const [ciudad, provincia] = key.split('|')
    const coordenadas = buscarCoordenadasCiudad(ciudad, provincia)

    const juzgadosMap = new Map<string, CasoUbicacion[]>()
    data.casos.forEach(caso => {
      const juzgado = caso.juzgado || 'Sin Juzgado Especificado'
      if (!juzgadosMap.has(juzgado)) juzgadosMap.set(juzgado, [])
      juzgadosMap.get(juzgado)!.push(caso)
    })

    const juzgados: JuzgadoAgrupado[] = Array.from(juzgadosMap.entries())
      .map(([nombre, casos]) => ({
        nombre, casos, cantidadCasos: casos.length, urgentes: casos.filter(c => c.esUrgente).length
      }))
      .sort((a, b) => b.cantidadCasos - a.cantidadCasos)

      zonas.push({
        id: key, ciudad, provincia, coordenadas, juzgados,
        totalCasos: data.casos.length,
        casos: data.casos,
      })

  })

zonas.sort((a, b) => b.totalCasos - a.totalCasos)

  const kpis: KPIsData = {
      totalCasos: casos.length,
      ciudadesActivas: zonas.length,
    }

    return { zonas, kpis }
}

// ============================================================================
// QUERY — VISTA GENERAL
// ============================================================================

async function obtenerVistaGeneral(): Promise<ZonaGeneral[]> {
  const casos = await prisma.caso.findMany({
    where: {
      estaCerrado: false,
      estado: { notIn: ['Cerrado', 'Archivado', 'CERRADO', 'ARCHIVADO'] }
    },
    include: {
      abogado: { select: { id: true, nombre: true, apellido: true } }
    },
    orderBy: { updatedAt: 'desc' }
  })

  // Agrupar por ciudad
  type CiudadData = {
    provincia: string
    abogados: Map<string, { nombre: string; casos: number; tieneAltaPrioridad: boolean }>
    totalCasos: number
    tieneAltaPrioridad: boolean
  }

  const ciudadMap = new Map<string, CiudadData>()

  casos.forEach(caso => {
    const ciudad = (caso as any).ciudad || extraerCiudadProvincia(caso.fuero).ciudad
    const provinciaRaw = (caso as any).provincia || extraerCiudadProvincia(caso.fuero).provincia
    const provincia = humanizarProvincia(provinciaRaw)
    const key = `${ciudad}|${provincia}`

    if (!ciudadMap.has(key)) {
      ciudadMap.set(key, {
        provincia,
        abogados: new Map(),
        totalCasos: 0,
        tieneAltaPrioridad: false
      })
    }

    const data = ciudadMap.get(key)!
    data.totalCasos++

    if (caso.priority === 'HIGH') data.tieneAltaPrioridad = true

    if (caso.abogado) {
      const abogadoId = caso.abogado.id
      const abogadoNombre = `${caso.abogado.nombre || ''} ${caso.abogado.apellido || ''}`.trim()
      if (!data.abogados.has(abogadoId)) {
        data.abogados.set(abogadoId, { nombre: abogadoNombre, casos: 0, tieneAltaPrioridad: false })
      }
      const ab = data.abogados.get(abogadoId)!
      ab.casos++
      if (caso.priority === 'HIGH') ab.tieneAltaPrioridad = true
    }
  })

  const zonas: ZonaGeneral[] = []

ciudadMap.forEach((data, key) => {
    const [ciudad, provincia] = key.split('|')

    zonas.push({
      ciudad,
      provincia,
      totalCasos: data.totalCasos,
      abogados: Array.from(data.abogados.entries()).map(([id, ab]) => ({
        id,
        nombre: ab.nombre,
        cantidadCasos: ab.casos,
      })).sort((a, b) => b.cantidadCasos - a.cantidadCasos)
    })
  })

  // Ordenar: primero coordinables con viaje, luego por carga
 // Ordenar por carga de casos
  return zonas.sort((a, b) => b.totalCasos - a.totalCasos)
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default async function UbicacionGeograficaPage({
  searchParams
}: {
  searchParams: { vista?: string; fuero?: string; etapa?: string; abogado?: string }
}) {
  const user = await getUserSessionServer()
  if (!user) redirect("/api/auth/signin")

  const userRol = user.rol?.toUpperCase() || ''
  // Defensa en profundidad — bloquear roles no operativos
  if (userRol === 'CLIENTE'|| userRol === 'ADMIN') notFound()
  const puedeVerGeneral = isAdmin(userRol) || isAbogado(userRol)
  const vistaGeneral = puedeVerGeneral && searchParams.vista === 'general'

  const filtroFuero = searchParams?.fuero || 'todos'
  const filtroEtapa = searchParams?.etapa || 'todas'

  // Lista de abogados — solo Admin y Asistente
  let abogadosLista: { id: string; nombre: string }[] = []
  if (isAdmin(userRol) || isAsistente(userRol)) {
    const abogados = await prisma.user.findMany({
      where: { rol: 'ABOGADO', isActive: true },
      select: { id: true, nombre: true, apellido: true },
      orderBy: { nombre: 'asc' }
    })
    abogadosLista = abogados.map(a => ({
      id: a.id,
      nombre: `${a.nombre || ''} ${a.apellido || ''}`.trim()
    }))
  }

  const abogadoParam = searchParams?.abogado || 'todos'
  const filtroAbogado = abogadoParam !== 'todos' && abogadosLista.some(a => a.id === abogadoParam)
    ? abogadoParam
    : 'todos'

  // Ejecutar solo la query que corresponde
  const [datosPersonal, zonasGenerales] = await Promise.all([
    !vistaGeneral
      ? obtenerCasosPorUbicacion(user.id, userRol, filtroFuero, filtroEtapa, filtroAbogado)
      : Promise.resolve(null),
    vistaGeneral
      ? obtenerVistaGeneral()
      : Promise.resolve(null)
  ])

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
                    <MapPin className="h-6 w-6 text-orange-500" />
                    Distribución de expedientes por ubicación geográfica
                  </h1>
                  <p className="text-sm text-slate-500">
                    {vistaGeneral
                      ? 'Distribución del estudio — coordinación y zonas que necesitan atención'
                      : 'Expedientes agrupados por ciudad y juzgado para organizar traslados y recorridas'
                    }
                  </p>
                </div>
              </div>
                    {/* TODOOOOOOOOOO */}
              {/* Toggle — solo ABOGADO y ADMIN */}
              {/* PENDIENTE: habilitar cuando se implemente módulo de tareas/agenda */}
              {/* {puedeVerGeneral && (
                <ToggleVista vistaActual={vistaGeneral ? 'general' : 'personal'} />
              )} */}
            </div>

            {/* Vista personal */}
            {!vistaGeneral && datosPersonal && (
              <>
                <div className="mb-6">
                  <FiltrosGeografia
                    abogados={abogadosLista}
                    mostrarFiltroAbogado={isAdmin(userRol) || isAsistente(userRol)}
                  />
                </div>

                {(isAdmin(userRol) || isAbogado(userRol)) && (
                  <KPIsUbicacion data={datosPersonal.kpis} />
                )}

                {datosPersonal.zonas.length > 0 ? (
                  <AcordeonZonas zonas={datosPersonal.zonas} vistaGeneral={false} />
                ) : (
                  <div className="mt-8 p-12 bg-white border border-slate-200 rounded-lg text-center">
                    <MapPin className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                    <p className="text-lg font-medium text-slate-600">No hay expedientes activos con ubicación</p>
                    <p className="text-sm text-slate-400 mt-2">
                      {filtroFuero !== 'todos' || filtroEtapa !== 'todas'
                        ? 'Probá cambiando los filtros para ver más resultados.'
                        : 'Los expedientes se agruparán automáticamente por ciudad cuando tengan el campo "Fuero" completado.'
                      }
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Vista general */}
            {vistaGeneral && zonasGenerales && (
              <VistaGeneralGeo zonas={zonasGenerales} />
            )}

            {/* Nota metodológica — solo vista personal */}
            {!vistaGeneral && (
              <div className="mt-8 p-4 bg-slate-100 border border-slate-200 rounded-lg">
                <p className="text-xs text-slate-600">
                  <strong>Nota:</strong> Los expedientes se agrupan por ciudad y provincia según el fuero cargado.
                  Este reporte muestra la distribución territorial de la cartera para organizar recorridas y traslados.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}