"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Bell, Clock, CheckCheck, ArrowRight, FileText, MessageCircle, AlarmClock, Pencil, AlertTriangle,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  getTareasParaNotificaciones,
  marcarTareasComoVistasAction,
  marcarTareaComoLeidaAction,
} from "src/lib/actions/tarea-actions";
import {
  getBurbujasComentarios,
  getAlertasProximasAVencer,
} from "src/lib/actions/comentario-actions";
import type { TareaNotificacion } from "src/lib/actions/tarea-actions";
import type { BurbujaTareaComentarios, AlertaProximaAVencer } from "src/lib/actions/comentario-actions";

// ============================================================================
// EVENTO GLOBAL — sincronización del Header con acciones de otros componentes
// ============================================================================
export const NOTIFICATIONS_REFRESH_EVENT = "notifications:refresh"

export function dispatchNotificationsRefresh() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_REFRESH_EVENT))
}

export const ABRIR_TAREA_DRAWER_EVENT = "tarea:abrir-drawer"
 
export function dispatchAbrirTareaDrawer(tareaId: string) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(ABRIR_TAREA_DRAWER_EVENT, {
    detail: { tareaId }
  }))
}

// ============================================================================
// HELPERS
// ============================================================================

const PRIORIDAD_CONFIG: Record<string, { color: string; label: string }> = {
  FATAL: { color: "text-red-600", label: "Fatal" },
  ALTA: { color: "text-orange-600", label: "Alta" },
  MEDIA: { color: "text-slate-600", label: "Media" },
  BAJA: { color: "text-slate-500", label: "Baja" },
}

function tiempoRelativo(fecha: string): string {
  const diff = Date.now() - new Date(fecha).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Ahora"
  if (mins < 60) return `Hace ${mins}m`
  const horas = Math.floor(mins / 60)
  if (horas < 24) return `Hace ${horas}h`
  const dias = Math.floor(horas / 24)
  return `Hace ${dias}d`
}

function getNombreAutor(autor: { nombre: string | null; apellido: string | null }): string {
  const n = autor.nombre ?? ""
  const a = autor.apellido ?? ""
  return `${n} ${a}`.trim() || "Usuario"
}

function etiquetaUmbral(umbral: 20 | 10 | 5, diasRestantes: number): string {
  if (diasRestantes < 0) return `Venció hace ${Math.abs(diasRestantes)}d`
  if (diasRestantes === 0) return "Vence hoy"
  if (diasRestantes === 1) return "Vence mañana"
  return `Vencimiento en ${diasRestantes}d (umbral ${umbral}d)`
}

type ItemFeed =
  | { kind: "tarea"; ordenFecha: number; data: TareaNotificacion }
  | { kind: "comentario"; ordenFecha: number; data: BurbujaTareaComentarios }
  | { kind: "por_vencer"; ordenFecha: number; data: AlertaProximaAVencer }

export function Header() {
  const { data: session } = useSession();
  const router = useRouter()
  const user = session?.user;

  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [tareasNuevas, setTareasNuevas] = useState<TareaNotificacion[]>([]);
  const [burbujasComentarios, setBurbujasComentarios] = useState<BurbujaTareaComentarios[]>([]);
  const [alertasProximas, setAlertasProximas] = useState<AlertaProximaAVencer[]>([]);
  const [isPending, startTransition] = useTransition();

  const totalItems = tareasNuevas.length + burbujasComentarios.length + alertasProximas.length
  const totalComentariosAcumulados = burbujasComentarios.reduce((acc, b) => acc + b.cantidadNuevos, 0)

  // ⬇ NUEVO: discriminar nuevas vs editadas para el resumen del sheet
  const cantidadEventosNuevos = tareasNuevas.filter(t => t.tipoNovedad === "nueva").length
  const cantidadEventosEditados = tareasNuevas.filter(t => t.tipoNovedad === "editada").length

  // Separar alertas ya vencidas de las que todavía están por vencer
  const alertasVencidas = alertasProximas.filter(a => a.diasRestantes < 0)
  const alertasPorVencer = alertasProximas.filter(a => a.diasRestantes >= 0)

  const cargarNotificaciones = useCallback(() => {
    startTransition(async () => {
      try {
        const [tareasResp, burbujasResp, alertasResp] = await Promise.all([
          getTareasParaNotificaciones(),
          getBurbujasComentarios(),
          getAlertasProximasAVencer(),
        ])
        setTareasNuevas(tareasResp.nuevas)
        setBurbujasComentarios(burbujasResp)
        setAlertasProximas(alertasResp)
      } catch (e) {
        console.error("Error cargando notificaciones:", e)
      }
    })
  }, [])

  const nombre = user?.name ?? "Usuario";
  const rol = user?.rol ?? "sin rol";
  const avatar = user?.image ?? null;
  const initials = nombre.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  const isAdmin = typeof rol === 'string' && rol.toLowerCase() === "admin";

  // Carga inicial
  useEffect(() => {
    if (isAdmin) return
    cargarNotificaciones()
  }, [cargarNotificaciones, isAdmin])

  // Recarga cuando se abre el sheet
  useEffect(() => {
    if (sheetOpen) cargarNotificaciones()
  }, [sheetOpen, cargarNotificaciones])

  // FIX BUG 1: escuchar evento global de refresh
  useEffect(() => {
    const handler = () => cargarNotificaciones()
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, handler)
    return () => window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, handler)
  }, [cargarNotificaciones])

  const handleMarcarTodasVistas = () => {
    startTransition(async () => {
      const result = await marcarTareasComoVistasAction()
      if (result.success) {
        setTareasNuevas([])
      }
    })
  }

  const handleClickItemTarea = (tareaId: string) => {
    setSheetOpen(false)

    marcarTareaComoLeidaAction(tareaId).then(() => {
      cargarNotificaciones()
    })

    if (typeof window !== "undefined" && window.location.pathname === "/gestion-tareas") {
      dispatchAbrirTareaDrawer(tareaId)
    } else {
      router.push(`/gestion-tareas?tareaAbierta=${tareaId}`)
    }
  }

  const handleSignOut = () => {
    setShowUserMenu(false)
    signOut({ callbackUrl: "/auth/signin" })
  }

  const feed: ItemFeed[] = [
    ...tareasNuevas.map<ItemFeed>(t => ({
      kind: "tarea",
      ordenFecha: new Date(t.updatedAt).getTime(),
      data: t,
    })),
    ...burbujasComentarios.map<ItemFeed>(b => ({
      kind: "comentario",
      ordenFecha: new Date(b.ultimoComentario.createdAt).getTime(),
      data: b,
    })),
    ...alertasProximas.map<ItemFeed>(a => ({
      kind: "por_vencer",
      ordenFecha: Date.now() + (100 - a.diasRestantes) * 60000,
      data: a,
    })),
  ].sort((a, b) => b.ordenFecha - a.ordenFecha)

  const getRolLabel = (rol: string) => {
    const roles: Record<string, string> = {
      ADMIN: 'Administrador',
      ABOGADO: 'Abogado',
      ASISTENTE: 'Asistente',
      CLIENTE: 'Cliente'
    };
    return roles[rol?.toUpperCase()] || rol;
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-white px-6">
      <button className="lg:hidden" onClick={() => setShowMobileMenu(!showMobileMenu)}>
        ☰
      </button>

      <h1 className="text-xl font-semibold">Sistema de Gestión Legal</h1>

      <div className="ml-auto flex items-center gap-3">

         {!isAdmin && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button className="relative rounded-full bg-slate-100 p-2.5 hover:bg-slate-200 transition-colors">
              <Bell className="w-4.5 h-4.5 text-slate-600" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 animate-pulse">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              )}
            </button>
          </SheetTrigger>
          <SheetContent className="w-full sm:w-[440px] p-0 flex flex-col">
            <SheetHeader className="px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
              <SheetTitle className="text-base font-bold text-slate-800">
                Novedades
                {totalItems > 0 && (
                  <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                    {totalItems}
                  </span>
                )}
              </SheetTitle>

              {totalItems > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  {/* ⬇ ACTUALIZADO: discriminar nuevos vs editados */}
                  {tareasNuevas.length > 0 && (
                    <span>
                      {cantidadEventosNuevos > 0 && (
                        <>{cantidadEventosNuevos} nuevo{cantidadEventosNuevos !== 1 ? "s" : ""}</>
                      )}
                      {cantidadEventosNuevos > 0 && cantidadEventosEditados > 0 && " · "}
                      {cantidadEventosEditados > 0 && (
                        <>{cantidadEventosEditados} editado{cantidadEventosEditados !== 1 ? "s" : ""}</>
                      )}
                    </span>
                  )}
                  {tareasNuevas.length > 0 && (burbujasComentarios.length > 0 || alertasProximas.length > 0) && <span> · </span>}
                  {burbujasComentarios.length > 0 && (
                    <span>{totalComentariosAcumulados} comentario{totalComentariosAcumulados !== 1 ? "s" : ""} en {burbujasComentarios.length} tarea{burbujasComentarios.length !== 1 ? "s" : ""}</span>
                  )}
                  {burbujasComentarios.length > 0 && alertasProximas.length > 0 && <span> · </span>}
                  {alertasProximas.length > 0 && (
                    <span>
                      {alertasVencidas.length > 0 && (
                        <span className="text-red-600 font-semibold">
                          {alertasVencidas.length} vencido{alertasVencidas.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      {alertasVencidas.length > 0 && alertasPorVencer.length > 0 && " · "}
                      {alertasPorVencer.length > 0 && (
                        <>{alertasPorVencer.length} por vencer</>
                      )}
                    </span>
                  )}
                </p>
              )}

              {tareasNuevas.length > 0 && (
                <button
                  onClick={handleMarcarTodasVistas}
                  disabled={isPending}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-md hover:bg-slate-100 transition-colors w-fit mt-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  {/* ⬇ TEXTO ACTUALIZADO: ahora cubre nuevos y editados */}
                  Marcar todos los eventos como vistos
                </button>
              )}
            </SheetHeader>

            <div className="flex-1 overflow-y-auto">
              {feed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <Bell className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">Estás al día</p>
                  <p className="text-xs text-slate-400 mt-1">No hay novedades desde tu última visita</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {feed.map((item) => {
                    if (item.kind === "tarea") {
                      const t = item.data
                      const prioCfg = PRIORIDAD_CONFIG[t.prioridad] ?? PRIORIDAD_CONFIG.MEDIA

                      // ⬇ NUEVO: estilo dinámico según tipoNovedad
                      const esEditada = t.tipoNovedad === "editada"
                      const labelTipo = esEditada ? "Evento editado" : "Nuevo evento"
                      const colorLabel = esEditada ? "text-amber-700" : "text-blue-700"
                      const bgIcono = esEditada ? "bg-amber-50" : "bg-blue-50"
                      const borderIcono = esEditada ? "border-amber-100" : "border-blue-100"
                      const colorIcono = esEditada ? "text-amber-600" : "text-blue-600"
                      const colorHover = esEditada ? "group-hover:text-amber-700" : "group-hover:text-blue-700"
                      const IconoNovedad = esEditada ? Pencil : FileText

                      return (
                        <button
                          key={`t-${t.id}`}
                          onClick={() => handleClickItemTarea(t.id)}
                          className="block w-full text-left"
                        >
                          <div className="px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                            <div className="flex items-start gap-3">
                              <div className={`mt-0.5 w-8 h-8 rounded-lg ${bgIcono} flex items-center justify-center shrink-0 border ${borderIcono}`}>
                                <IconoNovedad className={`w-4 h-4 ${colorIcono}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className={`text-[10px] font-bold uppercase tracking-wide ${colorLabel}`}>
                                    {labelTipo}
                                  </span>
                                  <span className={`w-1 h-1 rounded-full ${t.tipo === "PROCESAL" ? "bg-red-500" : "bg-blue-500"}`} />
                                </div>
                                <p className={`text-sm font-medium text-slate-800 ${colorHover} transition-colors leading-snug`}>
                                  {t.titulo}
                                </p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  {t.caso && (
                                    <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                      {t.caso.numero}
                                    </span>
                                  )}
                                  <span className={`text-[10px] font-medium ${prioCfg.color}`}>
                                    {prioCfg.label}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {t.creador.nombre} {t.creador.apellido}
                                  </span>
                                </div>
                                {t.fechaVencimiento && (
                                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Vence: {new Date(t.fechaVencimiento).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                                  </p>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">
                                {tiempoRelativo(t.updatedAt)}
                              </span>
                            </div>
                          </div>
                        </button>
                      )
                    }

                    if (item.kind === "comentario") {
                      const b = item.data
                      return (
                        <button
                          key={`c-${b.tareaId}`}
                          onClick={() => handleClickItemTarea(b.tareaId)}
                          className="block w-full text-left"
                        >
                          <div className="px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100 relative">
                                <MessageCircle className="w-4 h-4 text-emerald-600" />
                                {b.cantidadNuevos > 1 && (
                                  <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-emerald-600 text-white text-[9px] font-bold px-1">
                                    {b.cantidadNuevos}
                                  </span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                                    {b.cantidadNuevos === 1 ? "Nuevo comentario" : `${b.cantidadNuevos} nuevos comentarios`}
                                  </span>
                                </div>
                                <p className="text-sm font-medium text-slate-800 group-hover:text-emerald-700 transition-colors leading-snug truncate">
                                  en "{b.tituloTarea}"
                                </p>
                                <div className="mt-1">
                                  <p className="text-xs text-slate-600 line-clamp-2">
                                    <span className="font-medium text-slate-700">{getNombreAutor(b.ultimoComentario.autor)}:</span>{" "}
                                    <span className="italic">{b.ultimoComentario.textoPreview}</span>
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">
                                {tiempoRelativo(b.ultimoComentario.createdAt)}
                              </span>
                            </div>
                          </div>
                        </button>
                      )
                    }

                    const a = item.data
                    const prioCfgA = PRIORIDAD_CONFIG[a.prioridad] ?? PRIORIDAD_CONFIG.MEDIA
                    const estaVencida = a.diasRestantes < 0
                    const esUrgente = a.umbral === 5 || a.diasRestantes <= 2
                    return (
                      <button
                        key={`v-${a.tareaId}`}
                        onClick={() => handleClickItemTarea(a.tareaId)}
                        className="block w-full text-left"
                      >
                        <div className="px-5 py-3.5 hover:bg-slate-50 transition-colors group">
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                              estaVencida
                                ? "bg-red-100 border-red-300"
                                : esUrgente
                                  ? "bg-amber-100 border-amber-300"
                                  : "bg-yellow-50 border-yellow-200"
                            }`}>
                              {estaVencida ? (
                                <AlertTriangle className="w-4 h-4 text-red-700" />
                              ) : (
                                <AlarmClock className={`w-4 h-4 ${esUrgente ? "text-amber-700" : "text-yellow-700"}`} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={`text-[10px] font-bold uppercase tracking-wide ${
                                  estaVencida ? "text-red-700" : esUrgente ? "text-amber-700" : "text-yellow-700"
                                }`}>
                                  {estaVencida ? "Evento vencido" : "Por vencer"}
                                </span>
                                {!estaVencida && a.umbral === 5 && (
                                  <span className="text-[9px] px-1.5 py-0 rounded-full bg-amber-200 text-amber-800 font-bold">
                                    5d
                                  </span>
                                )}
                                {!estaVencida && a.umbral === 10 && (
                                  <span className="text-[9px] px-1.5 py-0 rounded-full bg-yellow-200 text-yellow-800 font-bold">
                                    10d
                                  </span>
                                )}
                                {!estaVencida && a.umbral === 20 && (
                                  <span className="text-[9px] px-1.5 py-0 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                                    20d
                                  </span>
                                )}
                                <span className={`w-1 h-1 rounded-full ${a.tipoTarea === "PROCESAL" ? "bg-red-500" : "bg-blue-500"}`} />
                              </div>
                              <p className="text-sm font-medium text-slate-800 group-hover:text-amber-700 transition-colors leading-snug">
                                {a.tituloTarea}
                              </p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {a.caso && (
                                  <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                    {a.caso.numero}
                                  </span>
                                )}
                                <span className={`text-[10px] font-medium ${prioCfgA.color}`}>
                                  {prioCfgA.label}
                                </span>
                              </div>
                              <p className={`text-[10px] mt-1 flex items-center gap-1 font-medium ${
                                a.diasRestantes <= 2 ? "text-red-600" :
                                a.diasRestantes <= 5 ? "text-amber-700" :
                                "text-yellow-700"
                              }`}>
                                <Clock className="w-3 h-3" />
                                {etiquetaUmbral(a.umbral, a.diasRestantes)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {feed.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-3 shrink-0 bg-slate-50">
                <Link
                  href="/gestion-tareas"
                  onClick={() => setSheetOpen(false)}
                  className="flex items-center justify-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Ver todo en Agenda y Seguimientos
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </SheetContent>
        </Sheet>
        )}


        <div className="relative">
          <button
            className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            {avatar ? (
              <img src={avatar} className="w-6 h-6 rounded-full" alt="avatar" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
                {initials}
              </div>
            )}
            <span>{nombre}</span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-md border bg-white py-1 shadow-lg">
              <div className="border-b px-4 py-2">
                <p className="font-medium">{nombre}</p>
                <p className="text-sm text-gray-500">{user?.email ?? ""}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Rol: {getRolLabel(rol)}
                </p>
              </div>

              <Link
                href="/perfil"
                onClick={() => setShowUserMenu(false)}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Mi Perfil
              </Link>

              {isAdmin && (
                <Link
                  href="/configuracion"
                  onClick={() => setShowUserMenu(false)}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Configuración
                </Link>
              )}

              <button
                onClick={handleSignOut}
                className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
              >
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}