'use client'

// app/reportes/auditoria/components/TimelineAuditoriaReporte.tsx
//
// CAMBIO en esta versión:
// - Suma visualización de hitos de DOCUMENTOS (badge azul "DOCUMENTO") y
//   CÁLCULOS / LIQUIDACIONES (badge violeta "CÁLCULO").
// - Cada tipo tiene su bloque dedicado en la TarjetaCaso, con su propia
//   FilaEvento*** y su set de íconos/labels.
// - TarjetaCasoConDias suma KPIs separados para docs y cálculos cuando hay.

import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  History, ShieldAlert, ChevronRight, User,
  FileText, CheckCircle2, DollarSign, Scale,
  MapPin, Lock, RotateCcw, AlertCircle, Clock, Calendar,
  ClipboardCheck, ClipboardX, Unlock, Sparkles,
  FileUp, FileX, FolderInput, FilePen,
  FolderPlus, FolderPen, FolderX,
  Calculator, Edit3, Trash2,
  Mail, MailX,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { EventoAuditoria, EventosPorDia } from "../page"

// ============================================================================
// HELPERS
// ============================================================================

const ACCIONES_CRITICAS = ["MONTO_CHANGE", "JUZGADO_CHANGE", "UBICACION_CHANGE", "CIERRE", "REAPERTURA", "ESTADO_RETROCESO"]
const ACCIONES_TAREA = [
  "TAREA_CREADA",
  "TAREA_ESTADO_CHANGE",
  "TAREA_COMPLETADA_CON_DEMORA",
  "TAREA_DESBLOQUEADA",
  "TAREA_VENCIDA_CERRADA_MANUAL",
]

const ACCIONES_DOCUMENTO = [
  "DOCUMENTO_SUBIDO",
  "DOCUMENTO_ELIMINADO",
  "DOCUMENTO_MOVIDO",
  "DOCUMENTO_ACTUALIZADO",
  "CARPETA_CREADA",
  "CARPETA_RENOMBRADA",
  "CARPETA_ELIMINADA",
]

const ACCIONES_LIQUIDACION = [
  "LIQUIDACION_CREADA",
  "LIQUIDACION_EDITADA",
  "LIQUIDACION_ELIMINADA",
]

const ACCIONES_OCA = [
  "OCA_CREADA",
  "OCA_ELIMINADA",
]

const CATEGORIA_LABELS: Record<string, string> = {
  PRESENTACION_ESCRITO: "Presentación / Escrito",
  AUDIENCIA: "Audiencia",
  NOTIFICACION_CEDULA: "Notificación / Cédula",
  CONTROL_EXPEDIENTE: "Control de Expediente",
  APELACION_RECURSO: "Apelación / Recurso",
  PERICIA_PRUEBA: "Pericia / Prueba",
  REUNION_CLIENTE: "Reunión con Cliente",
  REDACCION_DOCUMENTACION: "Redacción / Documentación",
  TRAMITE_ADMINISTRATIVO: "Trámite Administrativo",
  REQUERIMIENTO_CLIENTE: "Req. al Cliente",
  GESTION_FINANCIERA: "Gestión Financiera",
  REUNION_EQUIPO: "Reunión de Equipo",
  VENCIMIENTO_PLAZO: "Vencimiento / Plazo",
}

const TIPO_LIQUIDACION_LABELS: Record<string, string> = {
  DESPIDO: "Indemnización por despido",
  LRT: "LRT",
  CAPITALIZACION: "Capitalización",
}

const TIPO_PLANTILLA_OCA_LABELS: Record<string, string> = {
  RENUNCIA: "Renuncia",
  AUSENCIA: "Ausencia / Intimación",
  OTRO: "Otra comunicación",
  ARCA: "ARCA (Art. 11)",
}

function esCritico(accion: string)        { return ACCIONES_CRITICAS.includes(accion) }
function esDeTarea(accion: string)        { return ACCIONES_TAREA.includes(accion) }
function esDeDocumento(accion: string)    { return ACCIONES_DOCUMENTO.includes(accion) }
function esDeLiquidacion(accion: string)  { return ACCIONES_LIQUIDACION.includes(accion) }
function esDeOca(accion: string)          { return ACCIONES_OCA.includes(accion) }

function getLabel(accion: string, estadoNuevo?: string | null) {
  switch (accion) {
    // Caso
    case "CREATE":           return "Creación"
    case "ESTADO_CHANGE":    return "Cambio de etapa"
    case "ESTADO_RETROCESO": return "Retroceso procesal"
    case "PRIORIDAD_CHANGE": return "Prioridad"
    case "JUZGADO_CHANGE":   return "Juzgado"
    case "UBICACION_CHANGE": return "Ubicación"
    case "MONTO_CHANGE":     return "Monto"
    case "CIERRE":           return "Cierre"
    case "REAPERTURA":       return "Reapertura"
    // Tarea
    case "TAREA_CREADA":                  return "Evento creado"
    case "TAREA_ESTADO_CHANGE":
      if (estadoNuevo === "COMPLETADA") return "Completado"
      if (estadoNuevo === "BLOQUEADA")  return "Bloqueado"
      return "Cambio de estado"
    case "TAREA_COMPLETADA_CON_DEMORA":   return "Completado con demora"
    case "TAREA_DESBLOQUEADA":            return "Desbloqueado"
    case "TAREA_VENCIDA_CERRADA_MANUAL":  return "Vencido cerrado"
    // Documento
    case "DOCUMENTO_SUBIDO":      return "Documento subido"
    case "DOCUMENTO_ELIMINADO":   return "Documento eliminado"
    case "DOCUMENTO_MOVIDO":      return "Documento movido"
    case "DOCUMENTO_ACTUALIZADO": return "Documento editado"
    case "CARPETA_CREADA":        return "Carpeta creada"
    case "CARPETA_RENOMBRADA":    return "Carpeta renombrada"
    case "CARPETA_ELIMINADA":     return "Carpeta eliminada"
    // Liquidación
    case "LIQUIDACION_CREADA":    return "Cálculo guardado"
    case "LIQUIDACION_EDITADA":   return "Cálculo editado"
    case "LIQUIDACION_ELIMINADA": return "Cálculo eliminado"
    case "OCA_CREADA":            return "Plantilla OCA generada"
    case "OCA_ELIMINADA":         return "Plantilla OCA eliminada"
    default:                              return "Actualización"
  }
}

function getIconoSmall(accion: string, estadoNuevo?: string | null) {
  switch (accion) {
    // Caso
    case "CREATE":           return <FileText className="h-3 w-3" />
    case "ESTADO_CHANGE":    return <CheckCircle2 className="h-3 w-3" />
    case "ESTADO_RETROCESO": return <RotateCcw className="h-3 w-3" /> 
    case "PRIORIDAD_CHANGE": return <AlertCircle className="h-3 w-3" />
    case "JUZGADO_CHANGE":   return <Scale className="h-3 w-3" />
    case "UBICACION_CHANGE": return <MapPin className="h-3 w-3" />
    case "MONTO_CHANGE":     return <DollarSign className="h-3 w-3" />
    case "CIERRE":           return <Lock className="h-3 w-3" />
    case "REAPERTURA":       return <RotateCcw className="h-3 w-3" />
    // Tarea
    case "TAREA_CREADA":                  return <Sparkles className="h-3 w-3" />
    case "TAREA_ESTADO_CHANGE":
      if (estadoNuevo === "BLOQUEADA")    return <Lock className="h-3 w-3" />
      return <ClipboardCheck className="h-3 w-3" />
    case "TAREA_COMPLETADA_CON_DEMORA":   return <ClipboardCheck className="h-3 w-3" />
    case "TAREA_DESBLOQUEADA":            return <Unlock className="h-3 w-3" />
    case "TAREA_VENCIDA_CERRADA_MANUAL":  return <ClipboardX className="h-3 w-3" />
    // Documento
    case "DOCUMENTO_SUBIDO":      return <FileUp className="h-3 w-3" />
    case "DOCUMENTO_ELIMINADO":   return <FileX className="h-3 w-3" />
    case "DOCUMENTO_MOVIDO":      return <FolderInput className="h-3 w-3" />
    case "DOCUMENTO_ACTUALIZADO": return <FilePen className="h-3 w-3" />
    case "CARPETA_CREADA":        return <FolderPlus className="h-3 w-3" />
    case "CARPETA_RENOMBRADA":    return <FolderPen className="h-3 w-3" />
    case "CARPETA_ELIMINADA":     return <FolderX className="h-3 w-3" />
    // Liquidación
    case "LIQUIDACION_CREADA":    return <Calculator className="h-3 w-3" />
    case "LIQUIDACION_EDITADA":   return <Edit3 className="h-3 w-3" />
    case "LIQUIDACION_ELIMINADA": return <Trash2 className="h-3 w-3" />
    case "OCA_CREADA":            return <Mail className="h-3 w-3" />
    case "OCA_ELIMINADA":         return <MailX className="h-3 w-3" />
    default:                              return <Clock className="h-3 w-3" />
  }
}

function agruparPorCaso(eventos: EventoAuditoria[]): Map<string, EventoAuditoria[]> {
  const grupos = new Map<string, EventoAuditoria[]>()
  eventos.forEach(evento => {
    const key = evento.caso?.id || "sin-caso"
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(evento)
  })
  return grupos
}

function getAutoresUnicos(eventos: EventoAuditoria[]): string[] {
  const nombres = new Set(eventos.map(e => `${e.usuario.nombre} ${e.usuario.apellido}`.trim()))
  return Array.from(nombres)
}

function contarHitosTarea(eventos: EventoAuditoria[]): number {
  return eventos.filter(e => esDeTarea(e.accion)).length
}
function contarHitosDocumento(eventos: EventoAuditoria[]): number {
  return eventos.filter(e => esDeDocumento(e.accion)).length
}
function contarHitosLiquidacion(eventos: EventoAuditoria[]): number {
  return eventos.filter(e => esDeLiquidacion(e.accion)).length
}
function contarHitosOca(eventos: EventoAuditoria[]): number {
  return eventos.filter(e => esDeOca(e.accion)).length
}

function formatearMonto(monto: string): string {
  return Number(monto).toLocaleString("es-AR")
}

// Fallback: si la relación al documento se perdió (delete físico),
// parseamos el texto "Documento subido: X.pdf".
function extraerNombreDelTexto(texto: string): string | null {
  const m = texto.match(/:\s*(.+)$/)
  return m ? m[1].trim() : null
}

// ============================================================================
// MINI-FILAS DE EVENTO
// ============================================================================

function FilaEventoTarea({ evento }: { evento: EventoAuditoria }) {
  if (!evento.tarea) return null
  const labelCategoria = CATEGORIA_LABELS[evento.tarea.categoria] ?? evento.tarea.categoria
  const labelAccion = getLabel(evento.accion, evento.estadoNuevo)

  return (
    <div className="flex items-start gap-2 py-1 text-xs">
      <ClipboardCheck className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <span className="text-slate-700 font-medium">{evento.tarea.titulo}</span>
        <span className="text-slate-400"> · {labelCategoria}</span>
        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded font-bold uppercase tracking-wider border border-indigo-200">
          {labelAccion}
        </span>
      </div>
    </div>
  )
}

function FilaEventoDocumento({ evento }: { evento: EventoAuditoria }) {
  const labelAccion = getLabel(evento.accion)
  const nombreDoc = evento.documento?.nombre ?? extraerNombreDelTexto(evento.texto)

  return (
    <div className="flex items-start gap-2 py-1 text-xs">
      <span className="text-blue-500 shrink-0 mt-0.5">
        {getIconoSmall(evento.accion)}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-slate-700 font-medium">{nombreDoc || "Documento"}</span>
        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-bold uppercase tracking-wider border border-blue-200">
          {labelAccion}
        </span>
      </div>
    </div>
  )
}

function FilaEventoLiquidacion({ evento }: { evento: EventoAuditoria }) {
  const labelAccion = getLabel(evento.accion)
  const liq = evento.liquidacion

  const tipoLabel = liq ? (TIPO_LIQUIDACION_LABELS[liq.tipo] ?? liq.tipo) : "Cálculo"
  const monto = liq ? `$${formatearMonto(liq.montoTotal)}` : null

  return (
    <div className="flex items-start gap-2 py-1 text-xs">
      <span className="text-violet-500 shrink-0 mt-0.5">
        {getIconoSmall(evento.accion)}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-slate-700 font-medium">{tipoLabel}</span>
        {monto && <span className="text-slate-500 ml-2">{monto}</span>}
        {liq?.descripcion && <span className="text-slate-400 italic ml-2">— {liq.descripcion}</span>}
        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded font-bold uppercase tracking-wider border border-violet-200">
          {labelAccion}
        </span>
      </div>
    </div>
  )
}
function FilaEventoOca({ evento }: { evento: EventoAuditoria }) {
  const labelAccion = getLabel(evento.accion)
  const oca = evento.plantillaOca
  const tipoLabel = oca ? (TIPO_PLANTILLA_OCA_LABELS[oca.tipoPlantilla] ?? oca.tipoPlantilla) : "Plantilla OCA"
  const nombre = oca?.archivoNombre

  return (
    <div className="flex items-start gap-2 py-1 text-xs">
      <span className="text-rose-500 shrink-0 mt-0.5">
        {getIconoSmall(evento.accion)}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-slate-700 font-medium">{tipoLabel}</span>
        {nombre && <span className="text-slate-400 italic ml-2 truncate">— {nombre}</span>}
        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded font-bold uppercase tracking-wider border border-rose-200">
          {labelAccion}
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// TARJETA DE CASO — Modo fecha
// ============================================================================

function TarjetaCaso({
  casoId, casoNumero, casoTitulo, eventos, onVerDetalle,
}: {
  casoId: string; casoNumero: string; casoTitulo: string
  eventos: EventoAuditoria[]; onVerDetalle: () => void
}) {
  const criticos = eventos.filter(e => esCritico(e.accion))
  const eventosTarea = eventos.filter(e => esDeTarea(e.accion))
  const eventosDoc = eventos.filter(e => esDeDocumento(e.accion))
  const eventosLiq = eventos.filter(e => esDeLiquidacion(e.accion))
  const eventosOca = eventos.filter(e => esDeOca(e.accion))
  const eventosCaso = eventos.filter(e =>
    !esDeTarea(e.accion) && !esDeDocumento(e.accion) && !esDeLiquidacion(e.accion) && !esDeOca(e.accion)
  )
  const autores = getAutoresUnicos(eventos)
  const tiposUnicos = Array.from(new Set(eventosCaso.map(e => e.accion)))
  const horas = eventos.map(e => new Date(e.createdAt).getTime()).sort((a, b) => a - b)
  const horaInicio = format(new Date(horas[0]), "HH:mm", { locale: es })
  const horaFin = format(new Date(horas[horas.length - 1]), "HH:mm", { locale: es })
  const tieneCriticos = criticos.length > 0

  return (
    <div
      className={`bg-white border rounded-xl p-5 hover:shadow-md transition-all cursor-pointer group ${
        tieneCriticos ? "border-amber-300 hover:border-amber-400" : "border-slate-200 hover:border-slate-300"
      }`}
      onClick={onVerDetalle}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-base font-bold text-slate-800">{casoNumero}</span>
            {tieneCriticos && (
              <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold flex items-center gap-1 border border-amber-200">
                <ShieldAlert className="w-3 h-3" />
                {criticos.length} crítico{criticos.length !== 1 ? "s" : ""}
              </span>
            )}
            {eventosTarea.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-bold flex items-center gap-1 border border-indigo-200">
                <ClipboardCheck className="w-3 h-3" />
                {eventosTarea.length} evento{eventosTarea.length !== 1 ? "s" : ""}
              </span>
            )}
            {eventosDoc.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold flex items-center gap-1 border border-blue-200">
                <FileText className="w-3 h-3" />
                {eventosDoc.length} documento{eventosDoc.length !== 1 ? "s" : ""}
              </span>
            )}
            {eventosLiq.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full font-bold flex items-center gap-1 border border-violet-200">
                <Calculator className="w-3 h-3" />
                {eventosLiq.length} cálculo{eventosLiq.length !== 1 ? "s" : ""}
              </span>
            )}
            {eventosOca.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full font-bold flex items-center gap-1 border border-rose-200">
                <Mail className="w-3 h-3" />
                {eventosOca.length} plantilla{eventosOca.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 truncate mb-3">{casoTitulo}</p>

          {/* Tipos de acción de CASO (no incluye tareas/docs/cálculos) */}
          {tiposUnicos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {tiposUnicos.map(accion => (
                <span
                  key={accion}
                  className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                    esCritico(accion)
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  {getIconoSmall(accion)}
                  {getLabel(accion)}
                </span>
              ))}
            </div>
          )}

          {/* Bloque de tareas (indigo) */}
          {eventosTarea.length > 0 && (
            <div className="mb-3 p-2 bg-indigo-50/40 border border-indigo-100 rounded-lg">
              {eventosTarea.slice(0, 3).map(e => <FilaEventoTarea key={e.id} evento={e} />)}
              {eventosTarea.length > 3 && (
                <p className="text-[10px] text-indigo-600 mt-1 font-medium">
                  + {eventosTarea.length - 3} evento{eventosTarea.length - 3 !== 1 ? "s" : ""} más
                </p>
              )}
            </div>
          )}

          {/* Bloque de documentos (azul) */}
          {eventosDoc.length > 0 && (
            <div className="mb-3 p-2 bg-blue-50/40 border border-blue-100 rounded-lg">
              {eventosDoc.slice(0, 3).map(e => <FilaEventoDocumento key={e.id} evento={e} />)}
              {eventosDoc.length > 3 && (
                <p className="text-[10px] text-blue-600 mt-1 font-medium">
                  + {eventosDoc.length - 3} documento{eventosDoc.length - 3 !== 1 ? "s" : ""} más
                </p>
              )}
            </div>
          )}

          {/* Bloque de cálculos (violeta) */}
          {eventosLiq.length > 0 && (
            <div className="mb-3 p-2 bg-violet-50/40 border border-violet-100 rounded-lg">
              {eventosLiq.slice(0, 3).map(e => <FilaEventoLiquidacion key={e.id} evento={e} />)}
              {eventosLiq.length > 3 && (
                <p className="text-[10px] text-violet-600 mt-1 font-medium">
                  + {eventosLiq.length - 3} cálculo{eventosLiq.length - 3 !== 1 ? "s" : ""} más
                </p>
              )}
            </div>
          )}
          {eventosOca.length > 0 && (
            <div className="mb-3 p-2 bg-rose-50/40 border border-rose-100 rounded-lg">
              {eventosOca.slice(0, 3).map(e => <FilaEventoOca key={e.id} evento={e} />)}
              {eventosOca.length > 3 && (
                <p className="text-[10px] text-rose-600 mt-1 font-medium">
                  + {eventosOca.length - 3} plantilla{eventosOca.length - 3 !== 1 ? "s" : ""} más
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-wrap">
            <User className="h-3 w-3 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500">{autores.join(" · ")}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3 shrink-0">
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-800">{eventos.length}</p>
            <p className="text-xs text-slate-400">movimiento{eventos.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 font-mono">{horaInicio} — {horaFin}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// TARJETA ÚNICA DE CASO — Modo caso (con días listados adentro)
// ============================================================================

function TarjetaCasoConDias({
  casoBuscado, eventosCasoAgrupados, onVerDia,
}: {
  casoBuscado: { id: string; numero: string; titulo: string }
  eventosCasoAgrupados: EventosPorDia[]
  onVerDia: (fecha: string) => void
}) {
  const totalEventos = eventosCasoAgrupados.reduce((acc, d) => acc + d.eventos.length, 0)
  const totalCriticos = eventosCasoAgrupados.reduce(
    (acc, d) => acc + d.eventos.filter(e => esCritico(e.accion)).length, 0
  )
  const totalHitosTarea = eventosCasoAgrupados.reduce(
    (acc, d) => acc + contarHitosTarea(d.eventos), 0
  )
  const totalHitosDoc = eventosCasoAgrupados.reduce(
    (acc, d) => acc + contarHitosDocumento(d.eventos), 0
  )
  const totalHitosLiq = eventosCasoAgrupados.reduce(
    (acc, d) => acc + contarHitosLiquidacion(d.eventos), 0
  )
const totalHitosOca = eventosCasoAgrupados.reduce(
    (acc, d) => acc + contarHitosOca(d.eventos), 0
  )

  if (eventosCasoAgrupados.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p className="font-medium text-slate-600">Sin actividad registrada para este caso</p>
        <p className="text-sm text-slate-400 mt-1">Probá ajustando el rango de fechas</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header de la tarjeta */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{casoBuscado.numero}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{casoBuscado.titulo}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-center min-w-[70px]">
              <p className="text-xl font-bold text-slate-800">{totalEventos}</p>
              <p className="text-xs text-slate-500">movimientos</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-center min-w-[70px]">
              <p className="text-xl font-bold text-slate-800">{eventosCasoAgrupados.length}</p>
              <p className="text-xs text-slate-500">día{eventosCasoAgrupados.length !== 1 ? "s" : ""}</p>
            </div>
            {totalHitosTarea > 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 text-center min-w-[70px]">
                <p className="text-xl font-bold text-indigo-700">{totalHitosTarea}</p>
                <p className="text-xs text-indigo-600">evento{totalHitosTarea !== 1 ? "s" : ""}</p>
              </div>
            )}
            {totalHitosDoc > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-center min-w-[70px]">
                <p className="text-xl font-bold text-blue-700">{totalHitosDoc}</p>
                <p className="text-xs text-blue-600">document{totalHitosDoc !== 1 ? "os" : "o"}</p>
              </div>
            )}
            {totalHitosLiq > 0 && (
              <div className="bg-violet-50 border border-violet-200 rounded-lg px-4 py-2 text-center min-w-[70px]">
                <p className="text-xl font-bold text-violet-700">{totalHitosLiq}</p>
                <p className="text-xs text-violet-600">cálculo{totalHitosLiq !== 1 ? "s" : ""}</p>
              </div>
            )}
            {totalHitosOca > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-2 text-center min-w-[70px]">
                <p className="text-xl font-bold text-rose-700">{totalHitosOca}</p>
                <p className="text-xs text-rose-600">plantilla{totalHitosOca !== 1 ? "s" : ""}</p>
              </div>
            )}
            {totalCriticos > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-center min-w-[70px]">
                <p className="text-xl font-bold text-amber-700">{totalCriticos}</p>
                <p className="text-xs text-amber-600">crítico{totalCriticos !== 1 ? "s" : ""}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lista de días */}
      <div className="divide-y divide-slate-100">
        {eventosCasoAgrupados.map((dia) => {
          const criticosDia    = dia.eventos.filter(e => esCritico(e.accion))
          const hitosTareaDia  = contarHitosTarea(dia.eventos)
          const hitosDocDia    = contarHitosDocumento(dia.eventos)
          const hitosLiqDia    = contarHitosLiquidacion(dia.eventos)
          const hitosOcaDia    = contarHitosOca(dia.eventos)
          const tiposDia = Array.from(new Set(
            dia.eventos
              .filter(e => !esDeTarea(e.accion) && !esDeDocumento(e.accion) && !esDeLiquidacion(e.accion) && !esDeOca(e.accion))
              .map(e => e.accion)
          ))
          const autoresDia = getAutoresUnicos(dia.eventos)
          const horas = dia.eventos.map(e => new Date(e.createdAt).getTime()).sort((a, b) => a - b)
          const horaInicio = format(new Date(horas[0]), "HH:mm", { locale: es })
          const horaFin = format(new Date(horas[horas.length - 1]), "HH:mm", { locale: es })

          return (
            <div
              key={dia.fecha}
              className="px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors group"
              onClick={() => onVerDia(dia.fecha)}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2 shrink-0 w-48">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-sm font-medium text-slate-700 capitalize">{dia.fechaLabel}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {tiposDia.map(accion => (
                      <span
                        key={accion}
                        className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                          esCritico(accion)
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {getIconoSmall(accion)}
                        {getLabel(accion)}
                      </span>
                    ))}
                    {hitosTareaDia > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-bold border border-indigo-200">
                        <ClipboardCheck className="w-3 h-3" />
                        {hitosTareaDia} evento{hitosTareaDia !== 1 ? "s" : ""}
                      </span>
                    )}
                    {hitosDocDia > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold border border-blue-200">
                        <FileText className="w-3 h-3" />
                        {hitosDocDia} documento{hitosDocDia !== 1 ? "s" : ""}
                      </span>
                    )}
                    {hitosLiqDia > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full font-bold border border-violet-200">
                        <Calculator className="w-3 h-3" />
                        {hitosLiqDia} cálculo{hitosLiqDia !== 1 ? "s" : ""}
                      </span>
                    )}
                    {hitosOcaDia > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full font-bold border border-rose-200">
                        <Mail className="w-3 h-3" />
                        {hitosOcaDia} plantilla{hitosOcaDia !== 1 ? "s" : ""}
                      </span>
                    )}
                    {criticosDia.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold border border-amber-200">
                        <ShieldAlert className="w-3 h-3" />
                        {criticosDia.length} crítico{criticosDia.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>{autoresDia.join(", ")}</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">{horaInicio}{horas.length > 1 ? ` — ${horaFin}` : ""}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold text-slate-700">{dia.eventos.length}</span>
                    <span className="text-xs text-slate-400">movimiento{dia.eventos.length !== 1 ? "s" : ""}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

type Props = {
  eventos: EventoAuditoria[]
  currentPage: number
  totalPages: number
  modoBusqueda: "fecha" | "caso"
  eventosCasoAgrupados: EventosPorDia[]
  casoBuscado: { id: string; numero: string; titulo: string } | null
}

export function TimelineAuditoriaReporte({
  eventos, currentPage, totalPages,
  modoBusqueda, eventosCasoAgrupados, casoBuscado
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", newPage.toString())
    router.push(`${pathname}?${params.toString()}`)
  }

  const verDetalleCaso = (casoId: string, fecha?: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("vista", "detalle")
    params.set("casoId", casoId)
    if (fecha) {
      params.set("fecha", fecha)
      params.delete("modo")
      params.delete("desde")
      params.delete("hasta")
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  // ---- MODO CASO ----
  if (modoBusqueda === "caso" && casoBuscado) {
    return (
      <TarjetaCasoConDias
        casoBuscado={casoBuscado}
        eventosCasoAgrupados={eventosCasoAgrupados}
        onVerDia={(fecha) => verDetalleCaso(casoBuscado.id, fecha)}
      />
    )
  }

  // ---- MODO FECHA ----
  if (eventos.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
        <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p className="font-medium text-slate-600">Sin eventos registrados</p>
        <p className="text-sm text-slate-400 mt-1">Probá cambiando los filtros o el rango de fechas</p>
      </div>
    )
  }

  const gruposPorCaso = agruparPorCaso(eventos)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from(gruposPorCaso.entries()).map(([casoId, eventosDelCaso]) => {
          const caso = eventosDelCaso[0]?.caso
          if (!caso) return null
          return (
            <TarjetaCaso
              key={casoId}
              casoId={casoId}
              casoNumero={caso.numero}
              casoTitulo={caso.titulo}
              eventos={eventosDelCaso}
              onVerDetalle={() => verDetalleCaso(casoId)}
            />
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div className="w-28">
            {currentPage > 1 && (
              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} className="flex items-center gap-2">
                ← Anterior
              </Button>
            )}
          </div>
          <span className="text-sm font-medium text-slate-600">Página {currentPage} de {totalPages}</span>
          <div className="w-28 flex justify-end">
            {currentPage < totalPages && (
              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} className="flex items-center gap-2">
                Siguiente <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}