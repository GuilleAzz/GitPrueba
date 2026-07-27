import { getUserSessionServer } from "@/auth/actions/auth-actions"
import { CasoService } from "@/lib/aplication/services/caso.service"
import { UserService } from "@/lib/aplication/services/user.service"
import Link from "next/link"
import { Sidebar } from "@/app/components/sidebar"
import { Header } from "@/app/components/header"
import {   Star, FolderOpen, Plus, AlertTriangle, ChevronRight, 
  LayoutDashboard, Eye, Sparkles, X  } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card" 
import { Buscador } from "../components/buscador" 
import { FiltrosCasos } from "./components/filtros"
import { Button } from "@/components/ui/button"
import { redirect, notFound } from "next/navigation"
import { getMotivoCierreLabel, getMotivoCierreColors } from "src/lib/constants/motivos-cierre"

const casoService = new CasoService()
const userService = new UserService()

// Traduce el enum de tipo a etiqueta legible
const getTipoLabel = (tipo: string) => {
  const labels: Record<string, string> = {
    LABORAL: "Laboral",
    CIVIL_COMERCIAL: "Civil y Comercial",
    FAMILIA: "Familia",
    PENAL: "Penal",
    SUCESIONES: "Sucesiones",
    CONTENCIOSO_ADMINISTRATIVO: "Contencioso Administrativo",
    OTRO: "Otro",
  }
  return labels[tipo] ?? tipo
}

// Helper para color de estados
const getBadgeColor = (estado: string) => {
  if (["Terminado", "Archivado"].includes(estado)) return "bg-gray-100 text-gray-600 border-gray-200"
  if (["Sentencia / Resolución", "Ejecución de Sentencia"].includes(estado)) return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (["Prueba (Oficios/Pericias)", "Alegatos / Conclusiones"].includes(estado)) return "bg-blue-50 text-blue-700 border-blue-200"
  return "bg-slate-100 text-slate-700 border-slate-200"
}

// Helper para verificar roles
const isAdmin = (rol: string) => rol?.toUpperCase() === 'ADMIN'
const isAbogado = (rol: string) => rol?.toUpperCase() === 'ABOGADO'
const isAsistente = (rol: string) => rol?.toUpperCase() === 'ASISTENTE'

export default async function CasosPage({
  searchParams,
}: {
  searchParams?: { buscar?: string; tipo?: string; etapa?: string; recientes?: string; abogado?: string }
}) {
  const user = await getUserSessionServer()

  if (!user) {
    redirect("/auth/signin")
  }

  const userRol = user.rol?.toUpperCase() || ''
  // Defensa en profundidad — bloquear roles no operativos
  if (userRol === 'CLIENTE' || userRol === 'ADMIN') notFound()

  if (userRol === 'ADMIN') {
      return (
    <div className="flex h-screen bg-slate-50 items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow text-center max-w-md">
        <h1 className="text-xl font-bold text-red-600 mb-2">Acceso restringido</h1>
        <p className="text-slate-600 mb-4">El administrador no puede crear expedientes.</p>
        <Link href="/">
          <Button variant="outline">Volver al inicio</Button>
        </Link>
      </div>
    </div>
  )
}

  // Lógica de Roles para obtener casos
  let casos;
  if (isAdmin(userRol) || isAsistente(userRol)) {
    // Admin y Asistente ven todos los casos
    casos = await casoService.getAllCasos()
  } else {
    // Abogado ve solo sus casos
    casos = await casoService.getCasosByAbogado(user.id)
  }

  // Filtrado por Expediente y Carátula/Título
  const terminoBusqueda = searchParams?.buscar?.toLowerCase() || ""
  const terminoTipo = searchParams?.tipo || ""
  const terminoEtapa = searchParams?.etapa || ""

  const filtroRecientes = searchParams?.recientes === "1"

  // Filtro por abogado — solo para ASISTENTE, que ve expedientes de todo el estudio
  const filtroAbogado = isAsistente(userRol) ? (searchParams?.abogado || "") : ""
  const abogadosDisponibles = isAsistente(userRol)
    ? await userService.obtenerAbogadosActivos()
    : []

  // Contar casos recibidos por reasignación ANTES de aplicar el filtro
const totalRecientes = casos.filter(c => c.recibidoEnReasignacion).length

// Aplicar filtro si está activo
if (filtroRecientes) {
  casos = casos.filter(c => c.recibidoEnReasignacion)
}

if (filtroAbogado) {
  casos = casos.filter(c => c.abogadoId === filtroAbogado)
}

  if (terminoBusqueda) {
    casos = casos.filter(c => 
      c.titulo?.toLowerCase().includes(terminoBusqueda) || 
      c.numero?.toLowerCase().includes(terminoBusqueda)
    )
  }

  if (terminoTipo) {
  casos = casos.filter(c => c.tipo === terminoTipo)
}

if (terminoEtapa) {
  casos = casos.filter(c => c.estado === terminoEtapa)
}

  // Textos según rol
  const getTitulo = () => {
    if (isAdmin(userRol)) return 'Gestión Global de Expedientes'
    if (isAsistente(userRol)) return 'Panel de Expedientes'
    return 'Mis Expedientes Activos'
  }

  const getSubtitulo = () => {
    if (isAdmin(userRol)) return 'Supervisión de todos los expedientes del estudio.'
    if (isAsistente(userRol)) return 'Visualización y apoyo en la gestión de expedientes.'
    return 'Administra tus expedientes y consulta sus estados.'
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-auto p-6">
          <div className="w-full">
            
            {/* BREADCRUMB AGREGADO */}
            <nav className="mb-4 flex items-center gap-1.5 text-sm text-slate-400">
              <Link href="/" className="hover:text-slate-700 transition-colors flex items-center gap-1">
                <LayoutDashboard className="w-3.5 h-3.5" />
                Inicio
              </Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-slate-600 font-medium">Expedientes</span>
            </nav>

            {/* ENCABEZADO UNIFICADO */}
            <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{getTitulo()}</h1>
                <p className="text-sm text-slate-500 mt-1">{getSubtitulo()}</p>
              </div>
              
              {!isAdmin(userRol) && (
                <Link 
                  href="/casos/nuevo" 
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 shadow-sm font-medium"
                >
                  <Plus className="w-4 h-4" /> Nuevo Expediente
                </Link>
              )}
            </div>
            </div>
            
          {/* Indicador de rol para Asistente */}
          {isAsistente(userRol) && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              <strong>Modo Asistente:</strong> Puedes ver todos los expedientes y crear nuevos.
            </div>
          )}

          {/* Filtro: Recientemente recibidos*/}
          {totalRecientes > 0 && (
            <div className="mb-4">
              <Link
                href={filtroRecientes ? "/casos" : "/casos?recientes=1"}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  filtroRecientes
                    ? "bg-amber-100 text-amber-800 border border-amber-300 shadow-sm"
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-amber-50 hover:border-amber-200"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Recientemente recibidos ({totalRecientes})
                {filtroRecientes && <X className="w-3 h-3 ml-1" />}
              </Link>
            </div>
          )}

          {/* Bloque del Buscador */}
          <Card className="mb-6 shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Filtros de Búsqueda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Buscador placeholder="Buscar por número de expediente o carátula..." />
                <FiltrosCasos
                  abogadosDisponibles={abogadosDisponibles}
                  mostrarFiltroAbogado={isAsistente(userRol)}
                />
              </div>
            </CardContent>
          </Card>

          {/* TABLA DE CASOS */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-4 w-[50px] text-center">#</th>
                  <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Expediente</th>
                  <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Carátula</th>
                  <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Cliente</th>
                  
                  {/* Columna Abogado visible para Admin y Asistente */}
                  {(isAdmin(userRol) || isAsistente(userRol)) && (
                    <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Abogado</th>
                  )}
                  
                  <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Etapa Procesal</th>
                  <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {casos.length === 0 ? (
                  <tr>
                    <td colSpan={(isAdmin(userRol) || isAsistente(userRol)) ? 7 : 6} className="p-16 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <FolderOpen className="w-12 h-12 mb-3 opacity-50" />
                        <p className="text-lg font-medium text-slate-600">No se encontraron expedientes</p>
                        {terminoBusqueda === "" && (
                           <p className="text-sm">Comienza creando un nuevo expediente.</p>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  casos.map((caso) => (
                    <tr key={caso.id} className="hover:bg-slate-50 transition duration-150 group">
                      
                      {/* Columna Prioridad/Favorito */}
                      <td className="p-4 text-center align-middle">
                        <div className="flex flex-col items-center gap-1">
                          {caso.isFavorite && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                          {caso.priority === 'HIGH' && <AlertTriangle className="w-4 h-4 text-orange-500 fill-orange-100" />}
                        </div>
                      </td>

                      <td className="p-4 text-sm font-mono text-slate-500 font-medium whitespace-nowrap">
                        {caso.numero || "S/N"}
                      </td>
                      
                      <td className="p-4 text-sm font-medium text-slate-800">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="line-clamp-1" title={caso.titulo}>
                            {caso.titulo}
                          </span>
                          {caso.recibidoEnReasignacion && (
                            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold border border-amber-200">
                              <Sparkles className="w-2.5 h-2.5" />
                              Nuevo
                            </span>
                          )}
                          {isAbogado(userRol) && caso.abogadoId !== user.id && (
                            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 font-semibold border border-violet-200">
                              Colaborador
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 font-normal">{getTipoLabel(caso.tipo)}</span>
                      </td>
                      
                      <td className="p-4 text-sm text-slate-600">
                        {/* @ts-ignore */}
                        {caso.cliente ? `${caso.cliente.nombre} ${caso.cliente.apellido || ''}` : <span className="text-slate-300 italic">Sin Asignar</span>}
                      </td>
                      
                      {/* Columna Abogado - Visible para Admin y Asistente */}
                      {(isAdmin(userRol) || isAsistente(userRol)) && (
                        <td className="p-4 text-sm text-slate-600">
                          {/* @ts-ignore */}
                          {caso.abogado ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                              {/* @ts-ignore */}
                              {caso.abogado.nombre || caso.abogado.email}
                            </span>
                          ) : '-'}
                        </td>
                      )}

                      {/* Estado con Badge */}
                      <td className="p-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBadgeColor(caso.estado)}`}>
                              {caso.estado}
                            </span>
                            {caso.estaCerrado && (
                              caso.esTraspasado ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-purple-50 text-purple-700 border-purple-200">
                                  Traspasado a Otro Estudio
                                </span>
                              ) : (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getMotivoCierreColors(caso.motivoCierre).bg} ${getMotivoCierreColors(caso.motivoCierre).text} ${getMotivoCierreColors(caso.motivoCierre).border}`}>
                                  {caso.motivoCierre ? getMotivoCierreLabel(caso.motivoCierre) : 'Cerrado'}
                                </span>
                              )
                            )}
                          </div>
                      </td>
                      
                      <td className="p-4 text-right pr-6">
                        <div className="flex justify-end">
                          <Link href={`/casos/${caso.id}`}>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="group/btn h-8 gap-2 px-3 hover:bg-blue-50 hover:text-blue-700 text-slate-600 transition-all rounded-lg"
                            >
                              <span className="text-xs font-semibold">Ver Expediente</span>
                              <Eye className="w-4 h-4 text-slate-400 group-hover/btn:text-blue-600 transition-colors" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  )
}