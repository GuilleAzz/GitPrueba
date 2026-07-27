// src/app/casos/[id]/page.tsx

import { getUserSessionServer } from "@/auth/actions/auth-actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { CalendarClock, FileText, Scale, History, DollarSign, Briefcase, ArrowLeft, FolderOpen } from 'lucide-react';
import prisma from "src/lib/db/prisma"
import { TaskManager } from "./components/TaskManager"
import { TimelineAuditoria } from "./components/TimelineAuditoria"
// import { PagosManager } from "./components/PagosManager"
import { CasoHeader } from "./components/caso-header"
import { Sidebar } from "@/app/components/sidebar"
import { Header } from "@/app/components/header"
import { 
  MapPin, Archive, Calendar, 
  Clock, User, Building2, Mail, Phone, Eye, AlertTriangle,
  TrendingUp, ShieldAlert
} from 'lucide-react'
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { obtenerColaboradores, obtenerAbogadosDisponibles } from "./colaborador.actions"
// import { ColaboradoresPanel } from "./components/ColaboradoresPanel"
import { getTareasDeCaso } from "src/lib/actions/tarea-actions"
import { redirect, notFound } from "next/navigation"
import { getLiquidacionesDeCaso } from "src/lib/actions/liquidacion-actions"
import { getPlantillasOcaDeCaso } from "src/lib/actions/plantilla-oca-actions"
import SeccionCalculosCaso from "./components/SeccionCalculosCaso"
import SeccionPlantillasOca from "./components/SeccionPlantillasOca"
import { NavegadorCarpetas } from "@/app/documentos/components/NavegadorCarpetas"

// Helper para verificar roles
const isAdmin = (rol: string) => rol?.toUpperCase() === 'ADMIN'
const isAbogado = (rol: string) => rol?.toUpperCase() === 'ABOGADO'
const isAsistente = (rol: string) => rol?.toUpperCase() === 'ASISTENTE'

const usuarios = await prisma.user.findMany({
  where: { isActive: true, rol: { not: "ADMIN" } },
  select: { id: true, nombre: true, apellido: true, rol: true }
})

export default async function CasoDetailPage({ params }: { params: { id: string } }) {
  const user = await getUserSessionServer()
  
  if (!user) {
    notFound()
  }

  const userRol = user.rol?.toUpperCase() || ''
  // Defensa en profundidad — bloquear roles no operativos
  if (userRol === 'CLIENTE' || userRol === 'ADMIN') notFound()
  
  const caso = await prisma.caso.findUnique({
    where: { id: params.id },
    include: {
      cliente: true,
      abogado: true,
      requirements: {
        orderBy: { dueDate: "asc" },
      },
      pagos: {  
        orderBy: { createdAt: "desc" }
      },
      // [HIST-MONTO] Traemos el historial de montos ordenado por fecha
      historialMonto: {
        orderBy: { fechaCambio: "desc" }
      }
    },
  })

  if (!caso) notFound()

  // ===== VERIFICACIÓN DE ACCESO AL CASO =====
  if (isAbogado(userRol)) {
    const esAbogadoTitular = caso.abogadoId === user.id

    // TODO: sistema colaborador no se usara ni se implementara...
    // const colaboradorEnCaso = await prisma.colaboradorCaso.findFirst({
    //   where: { casoId: params.id, userId: user.id }
    // })
    // const esColaborador = !!colaboradorEnCaso
    // if (!esAbogadoTitular && !esColaborador) notFound()

    if (!esAbogadoTitular) notFound()
  }

  // Obtener bitácora de auditoría (solo automáticas)
  const bitacoras = await prisma.bitacora.findMany({
    where: { 
      casoId: params.id, 
      tipo: "auto" 
    },
    include: {
      usuario: {
        select: { nombre: true, apellido: true }
      }
    },
    orderBy: { createdAt: "asc" }
  })

const bitacorasCampos = await prisma.bitacora.findMany({
    where: {
      casoId: params.id,
      accion: { in: ["JUZGADO_CHANGE", "UBICACION_CHANGE", "MONTO_CHANGE", "ESTADO_RETROCESO"] }
    },
    orderBy: { createdAt: "desc" },
    take: 10
  })

  // [MAQ.EST] Traer TODOS los retrocesos del caso para mostrar el historial completo
  const retrocesos = await prisma.bitacora.findMany({
    where: {
      casoId: params.id,
      accion: "ESTADO_RETROCESO"
    },
    include: {
      usuario: {
        select: { nombre: true, apellido: true }
      }
    },
    orderBy: { createdAt: "desc" }
  })

  // Helper para buscar el último cambio de un campo
  const ultimoCambio = (accion: string) => 
    bitacorasCampos.find(b => b.accion === accion)

  // Obtener colaboradores del caso
  // const colaboradores = await obtenerColaboradores(params.id)
  // const abogadosDisponibles = await obtenerAbogadosDisponibles(params.id)

  const tareasDeCaso = await getTareasDeCaso(params.id)
  const liquidacionesDelCaso = await getLiquidacionesDeCaso(params.id)
  const plantillasOcaDelCaso = await getPlantillasOcaDeCaso(params.id)

  const getPriorityColor = (priority: string) => {
    if (priority === "HIGH") return "bg-red-100 text-red-700"
    if (priority === "NORMAL") return "bg-yellow-100 text-yellow-700"
    return "bg-green-100 text-green-700"
  }

  const getStateColor = (estado: string) => {
    if (estado === "Cerrado") return "bg-slate-100 text-slate-700"
    if (estado === "Abierto" || estado === "Inicio / Demanda") return "bg-blue-100 text-blue-700"
    return "bg-purple-100 text-purple-700"
  }

  // ===== PERMISOS POR ROL =====
const puedeEditar = (isAbogado(userRol) || isAsistente(userRol)) && !caso.estaCerrado
const puedeVerPagos = isAbogado(userRol)                // pagos no se implementara
const puedeVerAuditoria = isAdmin(userRol)              // el admin ya no ve las cosas pero por ahora no toco esto
const puedeVerMontoDisputa = isAbogado(userRol) 

  // Permiso para gestionar colaboradores
  const esTitular = caso.abogadoId === user.id
  const puedeEditarColaboradores = isAdmin(userRol) || isAsistente(userRol) || esTitular

  // Verificar si el caso está cerrado
  const casoCerrado = caso.estaCerrado === true

  // Calcular cantidad de pestañas visibles para el grid
  const cantidadPestanas = 3 + (puedeVerPagos ? 1 : 0) + (puedeVerAuditoria ? 1 : 0)

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-auto">
          <div className="container mx-auto py-8 px-4">

            <nav className="mb-4 flex items-center gap-2 text-sm text-slate-500">
            <Link href="/casos" className="flex items-center gap-1 hover:text-slate-800 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Gestión de Espedientes
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">{caso.numero}</span>
          </nav>
      
            {/* ===== Header con botones de Cierre/Reapertura ===== */}
              <CasoHeader 
                caso={{
                  id:                     caso.id,
                  numero:                 caso.numero,
                  titulo:                 caso.titulo,
                  estado:                 caso.estado,
                  priority:               caso.priority,
                  isFavorite:             caso.isFavorite,
                  montoDisputa:           caso.montoDisputa ? Number(caso.montoDisputa) : null,
                  estaCerrado:            caso.estaCerrado,
                  motivoCierre:           caso.motivoCierre,
                  fechaCierre:            caso.fechaCierre?.toISOString() || null,
                  observacionCierre:      caso.observacionCierre,
                  estadoAntesCierre:      caso.estadoAntesCierre,
                  abogadoId:              caso.abogadoId,
                  recibidoEnReasignacion: caso.recibidoEnReasignacion, 
                      esTraspasado:           caso.esTraspasado,
                      fechaTraspaso:          caso.fechaTraspaso?.toISOString() || null,
                      estudioDestino:         caso.estudioDestino,
                      motivoTraspaso:         caso.motivoTraspaso,
                }}
                userRol={userRol}
                userId={user.id}            
                puedeEditar={puedeEditar}
              />

            {/* Indicador de modo Asistente */}
            {isAsistente(userRol) && (
              <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-start gap-2">
                <ShieldAlert className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Modo Asistente:</strong> Puedes ver la información del expediente y gestionar la agenda.
                </div>
              </div>
            )}

            {/* ===== BANNER CAMPOS PENDIENTES ===== */}
            {!caso.estaCerrado && (!caso.juzgado || !caso.ubicacionFisica) && (
              <div className="mb-6 rounded-xl border-2 border-amber-400 bg-amber-50 shadow-md overflow-hidden">
                <div className="bg-amber-400 px-4 py-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-900" />
                  <span className="font-bold text-amber-900 text-sm uppercase tracking-wide">
                    Expediente incompleto
                  </span>
                </div>
                <div className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-amber-900 text-sm font-medium">
                      Los siguientes campos están pendientes de completar:
                    </p>
                    <ul className="flex gap-3 mt-1">
                      {!caso.juzgado && (
                        <li className="flex items-center gap-1 text-sm text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                          <AlertTriangle className="w-3 h-3" /> Juzgado / Tribunal
                        </li>
                      )}
                      {!caso.ubicacionFisica && (
                        <li className="flex items-center gap-1 text-sm text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                          <AlertTriangle className="w-3 h-3" /> Ubicación Física
                        </li>
                      )}
                    </ul>
                  </div>
                  
                </div>
              </div>
            )}
            {/* ===================================== */}

            <Tabs defaultValue="resumen" className="w-full space-y-6">
              
              <TabsList className="grid w-full h-auto p-1 gap-1 grid-cols-3">
                <TabsTrigger value="resumen" className="h-9 w-full">
                  <FileText className="w-4 h-4 mr-2 shrink-0" />
                  Resumen
                </TabsTrigger>
              
                <TabsTrigger value="agenda" className="h-9 w-full">
                  <CalendarClock className="w-4 h-4 mr-2 shrink-0" />
                  Agenda y seguimientos
                </TabsTrigger>
              
                <TabsTrigger value="documentacion" className="h-9 w-full">
                  <FolderOpen className="w-4 h-4 mr-2 shrink-0" />
                  Documentación
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: RESUMEN COMPLETO DEL CASO */}
              <TabsContent value="resumen" className="animate-in fade-in-50">
                <div className="space-y-6">

                  {/* Descripción y Estrategia */}
                  <Card>
                    <CardHeader className="border-b bg-slate-50/50">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        Descripción y Estrategia del Expediente
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="prose max-w-none">
                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {caso.descripcion || "No hay descripción disponible"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Información Judicial */}
                  <Card>
                    <CardHeader className="border-b bg-slate-50/50">
                      <CardTitle className="flex items-center gap-2">
                        <Scale className="h-5 w-5 text-purple-600" />
                        Información Judicial y Radicación
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-semibold text-slate-600 flex items-center gap-1">
                              <FileText className="h-4 w-4" />
                              Carátula / Expediente
                            </label>
                            <p className="mt-1 text-slate-900 font-medium">
                              {caso.numero || "No especificado"}
                            </p>
                          </div>

                          <div>
                            <label className="text-sm font-semibold text-slate-600">Tipo de expediente</label>
                            <div className="mt-1">
                              <Badge variant="outline" className="text-sm">
                                {caso.tipo === 'LABORAL' ? 'Laboral' :
                                 caso.tipo === 'CIVIL_COMERCIAL' ? 'Civil Y Comercial' :
                                 caso.tipo === 'FAMILIA' ? 'Familia' :
                                 caso.tipo === 'PENAL' ? 'Penal' :
                                 caso.tipo === 'SUCESIONES' ? 'Sucesiones' :
                                 caso.tipo || 'No categorizado'}
                              </Badge>
                            </div>
                          </div>

                          {/* NUEVO: Provincia / Ciudad */}
                          {caso.fuero && (
                            <div>
                              <label className="text-sm font-semibold text-slate-600 flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                Provincia / Ciudad
                              </label>
                              <p className="mt-1 text-slate-900">{caso.fuero}</p>
                              {ultimoCambio("UBICACION_CHANGE") && (
                                <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  Modificado — {ultimoCambio("UBICACION_CHANGE")?.detalle?.replace("Motivo: ", "")}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-semibold text-slate-600">Juzgado / Tribunal</label>
                                <p className="mt-1 text-slate-900">
                                  {caso.juzgado || <span className="text-slate-400">No especificado</span>}
                                </p>
                                {ultimoCambio("JUZGADO_CHANGE") && (
                                  <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Modificado — {ultimoCambio("JUZGADO_CHANGE")?.detalle?.replace("Motivo: ", "")}
                                  </p>
                                )}
                          </div>

                              <div>
                            <label className="text-sm font-semibold text-slate-600">Estado / Etapa Procesal</label>
                            <div className="mt-1">
                              <Badge className={getStateColor(caso.estado)}>
                                {caso.estado}
                              </Badge>
                              {casoCerrado && (
                                <Badge variant="secondary" className="ml-2 bg-slate-200">
                                  Expediente Cerrado
                                </Badge>
                              )}
                              {/* [MAQ.EST] Indicador si hubo retrocesos procesales */}
                              {retrocesos.length > 0 && (
                                <Badge className="ml-2 bg-amber-100 text-amber-800 border border-amber-300">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  {retrocesos.length} {retrocesos.length === 1 ? 'retroceso registrado' : 'retrocesos registrados'}
                                </Badge>
                              )}
                            </div>

                            {/* [MAQ.EST] Panel destacado con el detalle de los retrocesos */}
                            {retrocesos.length > 0 && (
                              <div className="mt-3 border-2 border-amber-300 bg-amber-50 rounded-lg overflow-hidden">
                                <div className="bg-amber-200 px-3 py-2 flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4 text-amber-900" />
                                  <span className="text-sm font-bold text-amber-900 uppercase tracking-wide">
                                    Historial de Retrocesos Procesales Excepcionales
                                  </span>
                                </div>
                                <div className="p-3 space-y-3">
                                  {retrocesos.map((r, idx) => (
                                    <div 
                                      key={r.id} 
                                      className={`text-sm ${idx > 0 ? 'pt-3 border-t border-amber-200' : ''}`}
                                    >
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <Badge className="bg-slate-200 text-slate-700 text-xs">
                                            {r.estadoAnterior}
                                          </Badge>
                                          <span className="text-amber-700">→</span>
                                          <Badge className="bg-amber-100 text-amber-800 text-xs">
                                            {r.estadoNuevo}
                                          </Badge>
                                          {idx === 0 && (
                                            <span className="text-xs text-amber-700 font-semibold">(más reciente)</span>
                                          )}
                                        </div>
                                        <span className="text-xs text-slate-600 whitespace-nowrap">
                                          {new Date(r.createdAt).toLocaleDateString('es-AR', { 
                                            day: '2-digit', 
                                            month: '2-digit', 
                                            year: 'numeric' 
                                          })}
                                        </span>
                                      </div>
                                      <p className="text-slate-700 text-xs mt-1">
                                        <span className="font-semibold text-amber-900">Motivo: </span>
                                        {r.detalle?.replace("Motivo justificado: ", "") || "Sin motivo registrado"}
                                      </p>
                                      <p className="text-xs text-slate-500 mt-1">
                                        Por: {r.usuario.nombre} {r.usuario.apellido}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Contraparte (si existe) */}
                      {(caso.contraparteNombre || caso.contraparteDni) && (
                        <div className="mt-6 pt-6 border-t border-slate-100">
                          <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            Información de la Contraparte
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {caso.contraparteNombre && (
                              <div>
                                <label className="text-sm text-slate-600">Nombre/Razón Social</label>
                                <p className="mt-1 text-slate-900 font-medium">{caso.contraparteNombre}</p>
                              </div>
                            )}
                            {caso.contraparteDni && (
                              <div>
                                <label className="text-sm text-slate-600">DNI/CUIT</label>
                                <p className="mt-1 text-slate-900 font-mono">{caso.contraparteDni}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Información Financiera - Solo Admin y Abogado */}
                  {puedeVerMontoDisputa && (caso.montoDisputa || caso.montoFinal) && (
                    <Card>
                      <CardHeader className="border-b bg-slate-50/50">
                        <CardTitle className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-green-600" />
                          Información Financiera
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {caso.montoDisputa && (
                              <div>
                                <label className="text-sm font-semibold text-slate-600">Monto en Disputa</label>
                                <p className="mt-1 text-2xl font-bold text-slate-700">
                                  ${Number(caso.montoDisputa).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                {ultimoCambio("MONTO_CHANGE") && (
                                  <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Modificado — {ultimoCambio("MONTO_CHANGE")?.detalle?.replace("Motivo: ", "")}
                                  </p>
                                )}

                                {/* [HIST-MONTO] Acá mostramos los montos viejos en gris */}
                                {(caso as any).historialMonto && (caso as any).historialMonto.length > 1 && (
                                  <div className="mt-4 pt-3 border-t border-slate-100">
                                    <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                                      Historial de montos anteriores
                                    </p>
                                    <div className="space-y-2">
                                      {/* Usamos slice(1) para ignorar el monto actual y mostrar solo los viejos */}
                                      {(caso as any).historialMonto.slice(1).map((h: any) => (
                                        <div key={h.id} className="text-xs text-slate-500 flex flex-col gap-0.5 border-l-2 border-slate-200 pl-2">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium line-through text-slate-400">
                                              ${Number(h.monto).toLocaleString('es-AR')}
                                            </span>
                                            <span className="text-slate-400 text-[10px]">
                                              {new Date(h.fechaCambio).toLocaleDateString('es-AR')}
                                            </span>
                                          </div>
                                          <p className="text-slate-400 italic">
                                            {h.esInicial ? 'Carga inicial del expediente' : `Motivo: ${h.motivo}`}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          
                          {/* Monto Final (si el caso está cerrado) */}
                          {casoCerrado && caso.montoFinal && (
                            <div>
                              <label className="text-sm font-semibold text-slate-600">Monto Final (Cierre)</label>
                              <p className="mt-1 text-2xl font-bold text-green-600">
                                ${Number(caso.montoFinal).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                              {caso.montoDisputa && (
                                <p className="text-sm text-slate-500 mt-1">
                                  {Number(caso.montoFinal) >= Number(caso.montoDisputa) 
                                    ? `✅ ${((Number(caso.montoFinal) / Number(caso.montoDisputa)) * 100).toFixed(1)}% del monto en disputa`
                                    : `📉 ${((Number(caso.montoFinal) / Number(caso.montoDisputa)) * 100).toFixed(1)}% del monto en disputa`
                                  }
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Ubicación Física del Expediente */}
                  {caso.ubicacionFisica && (
                    <Card>
                      <CardHeader className="border-b bg-slate-50/50">
                        <CardTitle className="flex items-center gap-2">
                          <MapPin className="h-5 w-5 text-orange-600" />
                          Ubicación Física del Expediente
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                          <Archive className="h-5 w-5 text-orange-600 mt-0.5" />
                          <div>
                            <p className="text-sm text-slate-600 mb-1">El expediente físico se encuentra en:</p>
                            <p className="text-slate-900 font-semibold">{caso.ubicacionFisica}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Fechas Importantes */}
                  <Card>
                    <CardHeader className="border-b bg-slate-50/50">
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-indigo-600" />
                        Fechas Importantes
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <label className="text-sm font-semibold text-slate-600 flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Fecha de Inicio
                          </label>
                          <p className="mt-1 text-slate-900">
                            {new Date(caso.fechaInicio).toLocaleDateString('es-AR', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </p>
                        </div>

                        {caso.fechaCierre && (
                          <div>
                            <label className="text-sm font-semibold text-slate-600">Fecha de Cierre</label>
                            <p className="mt-1 text-slate-900">
                              {new Date(caso.fechaCierre).toLocaleDateString('es-AR', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </p>
                          </div>
                        )}

                        <div>
                          <label className="text-sm font-semibold text-slate-600">Duración</label>
                          <p className="mt-1 text-slate-900">
                            {caso.fechaCierre 
                              ? `${Math.floor((new Date(caso.fechaCierre).getTime() - new Date(caso.fechaInicio).getTime()) / (1000 * 60 * 60 * 24))} días (finalizado)`
                              : `${Math.floor((new Date().getTime() - new Date(caso.fechaInicio).getTime()) / (1000 * 60 * 60 * 24))} días (en curso)`
                            }
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Datos del Cliente */}
                  <Card>
                    <CardHeader className="border-b bg-slate-50/50">
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5 text-blue-600" />
                        Información del Cliente
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      {caso.cliente ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-semibold text-slate-600">Nombre Completo</label>
                              <p className="mt-1 text-slate-900 font-medium">
                                {caso.cliente.nombre} {caso.cliente.apellido}
                              </p>
                            </div>

                            <div>
                              <label className="text-sm font-semibold text-slate-600">Documento</label>
                              <p className="mt-1 text-slate-900 font-mono">
                                {caso.cliente.tipoDocumento}: {caso.cliente.numeroDocumento || "No registrado"}
                              </p>
                            </div>

                            <div>
                              <label className="text-sm font-semibold text-slate-600">Tipo de Persona</label>
                              <div className="mt-1 flex items-center gap-2">
                                {caso.cliente.tipoPersona === 'FISICA' ? (
                                  <>
                                    <User className="h-4 w-4 text-blue-600" />
                                    <span className="text-slate-900">Persona Física</span>
                                  </>
                                ) : (
                                  <>
                                    <Building2 className="h-4 w-4 text-purple-600" />
                                    <span className="text-slate-900">Persona Jurídica</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Representante Legal si es Persona Jurídica */}
                            {caso.cliente.tipoPersona === 'JURIDICA' && caso.cliente.representanteNombre && (
                              <div>
                                <label className="text-sm font-semibold text-slate-600">Representante Legal</label>
                                <p className="mt-1 text-slate-900">
                                  {caso.cliente.representanteNombre}
                                  {caso.cliente.representanteDni && (
                                    <span className="text-slate-500 font-mono text-sm ml-2">
                                      — DNI {caso.cliente.representanteDni}
                                    </span>
                                  )}
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-semibold text-slate-600 flex items-center gap-1">
                                <Mail className="h-4 w-4" />
                                Email
                              </label>
                              <p className="mt-1 text-slate-900">
                                {caso.cliente.email ? (
                                  <a href={`mailto:${caso.cliente.email}`} className="hover:text-blue-600 hover:underline">
                                    {caso.cliente.email}
                                  </a>
                                ) : (
                                  <span className="text-slate-400">No registrado</span>
                                )}
                              </p>
                            </div>

                            <div>
                              <label className="text-sm font-semibold text-slate-600 flex items-center gap-1">
                                <Phone className="h-4 w-4" />
                                Teléfono
                              </label>
                              <p className="mt-1 text-slate-900">
                                {caso.cliente.telefono ? (
                                  <a href={`tel:${caso.cliente.telefono}`} className="hover:text-blue-600 hover:underline">
                                    {caso.cliente.telefono}
                                  </a>
                                ) : (
                                  <span className="text-slate-400">No registrado</span>
                                )}
                              </p>
                            </div>

                            <div>
                              <label className="text-sm font-semibold text-slate-600 flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                Dirección
                              </label>
                              <p className="mt-1 text-slate-900">
                                {caso.cliente.direccion || <span className="text-slate-400">No registrada</span>}
                              </p>
                            </div>
                          </div>

                          <div className="md:col-span-2">
                            <Link href={`/clientes/${caso.cliente.id}`}>
                              <Button variant="outline" size="sm" className="gap-2">
                                <Eye className="h-4 w-4" />
                                Ver Perfil Completo del Cliente
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-500 text-center py-4">Sin cliente asignado</p>
                      )}
                    </CardContent>
                  </Card>

                </div>
              </TabsContent>

              {/* TAB 2: AGENDA Y TAREAS - Disponible para todos */}
              <TabsContent value="agenda" className="animate-in fade-in-50">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50">
                    <div>
                      <CardTitle>Bitácora de la agenda</CardTitle>
                      <p className="text-sm text-slate-500 mt-1">Gestión de vencimientos, audiencias y escritos.</p>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <TaskManager
                      casoId={caso.id}
                      tareas={tareasDeCaso}
                      puedeCrear={puedeEditar}
                      currentUserId={user.id} 
                      usuarios={usuarios}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

            <TabsContent value="documentacion" className="animate-in fade-in-50 space-y-6">
 
              {/* Sección 1: Documentos del expediente (carpetas + archivos subidos) */}
              <Card>
                <CardHeader className="border-b bg-slate-50/50">
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-blue-600" />
                    Documentos del Expediente
                  </CardTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    Carpetas y archivos subidos al expediente.
                  </p>
                </CardHeader>
                  <CardContent className="p-0 min-h-[600px] flex flex-col">
                  <NavegadorCarpetas
                    caso={{ id: caso.id, numero: caso.numero, titulo: caso.titulo }}
                    userId={user.id}
                    userRol={userRol}
                  />
                </CardContent>
              </Card>
            
              {/* Sección 2: Cálculos de indemnización guardados */}
              <SeccionCalculosCaso
                casoId={caso.id}
                liquidaciones={liquidacionesDelCaso}
                puedeEliminar={puedeEditar}
              />
              {/* Sección 3: Plantillas OCA generadas para el expediente */}
              <SeccionPlantillasOca
                casoId={caso.id}
                plantillas={plantillasOcaDelCaso}
                puedeEliminar={puedeEditar}
              />
            
            </TabsContent>

              {/* TAB 5: AUDITORÍA - Solo Admin */}
              {puedeVerAuditoria && (
                <TabsContent value="auditoria" className="animate-in fade-in-50">
                  <Card>
                    <CardHeader className="border-b bg-slate-50/50">
                      <CardTitle>Timeline de Auditoría</CardTitle>
                      <p className="text-sm text-slate-500 mt-1">
                        Historial automático de cambios y movimientos del expediente
                      </p>
                    </CardHeader>
                    <CardContent className="p-6">
                      {bitacoras.length > 0 ? (
                        <TimelineAuditoria bitacoras={bitacoras.filter(b => b.accion !== null) as any} />
                      ) : (
                        <div className="text-center py-12 text-slate-500">
                          <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                          <p className="font-medium">Sin movimientos registrados</p>
                          <p className="text-sm">La auditoría automática comenzará a registrar cambios</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  )
}