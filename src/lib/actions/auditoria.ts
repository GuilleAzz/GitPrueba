import prisma from "../../lib/db/prisma"

// Definición de tipos permitidos para la auditoría
type AuditoriaData = {
  casoId?: string | null
  tareaId?: string | null
  documentoId?: string | null
  liquidacionId?: string | null
   historialMontoId?: string | null 
  plantillaOcaId?: string | null      
  usuarioId: string
  accion:
    // ── Acciones de casos ──
    | "CREATE"
    | "UPDATE"
    | "ESTADO_CHANGE"
    | "ESTADO_RETROCESO"
    | "PRIORIDAD_CHANGE"
    | "CLIENTE_CHANGE"
    | "CIERRE"
    | "REAPERTURA"
    | "JUZGADO_CHANGE"
    | "UBICACION_CHANGE"
    | "MONTO_CHANGE"
    // ── Acciones de tareas ──
    | "TAREA_CREADA"
    | "TAREA_ESTADO_CHANGE"
    | "TAREA_COMPLETADA_CON_DEMORA"
    | "TAREA_DESBLOQUEADA"
    | "TAREA_VENCIDA_CERRADA_MANUAL"
    // ── Acciones de documentos y carpetas ──
    | "DOCUMENTO_SUBIDO"
    | "DOCUMENTO_ELIMINADO"
    | "DOCUMENTO_MOVIDO"
    | "DOCUMENTO_ACTUALIZADO"
    | "CARPETA_CREADA"
    | "CARPETA_RENOMBRADA"
    | "CARPETA_ELIMINADA"
    // ── Acciones de liquidaciones ──
    | "LIQUIDACION_CREADA"
    | "LIQUIDACION_EDITADA"
    | "LIQUIDACION_ELIMINADA"
    // ── Acciones de plantillas OCA ──                   
    | "OCA_CREADA"
    | "OCA_ELIMINADA"
  texto: string
  detalle?: string | null
  estadoAnterior?: string | null
  estadoNuevo?: string | null
}
 
export async function registrarAuditoria(data: AuditoriaData) {
  try {
    await prisma.bitacora.create({
      data: {
        casoId: data.casoId ?? null,
        tareaId: data.tareaId ?? null,
        documentoId: data.documentoId ?? null,
        liquidacionId: data.liquidacionId ?? null,
        plantillaOcaId: data.plantillaOcaId ?? null, 
        historialMontoId: data.historialMontoId ?? null,
        usuarioId: data.usuarioId,
        accion: data.accion,
        texto: data.texto,
        detalle: data.detalle ?? null,
        estadoAnterior: data.estadoAnterior ?? null,
        estadoNuevo: data.estadoNuevo ?? null,
        tipo: "auto",
      },
    })
  } catch (error) {
    console.error("[AUDITORIA] Error registrando bitácora:", error)
  }
}