'use server'

import { getUserSessionServer } from "@/auth/actions/auth-actions"
import prisma from "src/lib/db/prisma"
import { revalidatePath } from "next/cache"
import { TipoPlantillaOca } from "@prisma/client"
import { put, del } from "@vercel/blob"
// Constantes y tipos: importados desde el archivo hermano sin 'use server'
// (Next.js no permite exportar objetos/tipos desde un 'use server')
import { 
  type PlantillaOcaConRelaciones,
  TIPO_PLANTILLA_OCA_LABELS 
} from "./plantilla-oca-shared"

// ═════════════════════════════════════════════════════════════════════════
// Server actions para gestionar las plantillas OCA generadas.
//
// El flujo es:
//   1. El abogado completa el formulario de OCA (TelegramaFormulario.tsx)
//   2. telegramaAction.ts genera el PDF con pdf-lib
//   3. telegramaAction.ts llama a `guardarPlantillaOcaAction` para persistir:
//        - Sube el PDF a Vercel Blob
//        - Crea el registro en BD (tabla plantilla_oca)
//        - Registra en bitácora la acción OCA_CREADA
//   4. El PDF se abre en ventana nueva para imprimir (como hoy)
//   5. Además queda listado en el tab Documentación del expediente
//
// El abogado puede después:
//   - Descargar la OCA de nuevo desde el expediente
//   - Eliminarla (soft delete + borrado físico del blob)
//
// NOTA IMPORTANTE:
// Este archivo tiene 'use server' entonces SOLO puede exportar funciones
// async. Las constantes y tipos viven en plantilla-oca-shared.ts.
// ═════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════
// HELPERS INTERNOS (no exportados)
// ═════════════════════════════════════════════════════════════════════════

const includeRelaciones = {
  caso: { select: { id: true, numero: true, titulo: true } },
  creadoPor: { select: { id: true, nombre: true, apellido: true } },
}

function mapearPlantillaOca(p: any): PlantillaOcaConRelaciones {
  return {
    id: p.id,
    tipoPlantilla: p.tipoPlantilla,
    datos: p.datos,
    archivoUrl: p.archivoUrl,
    archivoStorageKey: p.archivoStorageKey,
    archivoNombre: p.archivoNombre,
    archivoTamanio: p.archivoTamanio,
    descripcion: p.descripcion,
    casoId: p.casoId,
    caso: { id: p.caso.id, numero: p.caso.numero, titulo: p.caso.titulo },
    creadoPorId: p.creadoPorId,
    creadoPor: { id: p.creadoPor.id, nombre: p.creadoPor.nombre, apellido: p.creadoPor.apellido },
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    eliminadoEn: p.eliminadoEn?.toISOString() ?? null,
  }
}

// Solo no eliminadas — usar siempre en queries de listado
const noEliminadas = { eliminadoEn: null }

// Chequeo de acceso al caso (mismo criterio que telegramaAction.ts)
async function usuarioPuedeAccederCaso(
  casoId: string,
  userId: string,
  rol?: string | null
): Promise<boolean> {
  const rolUpper = rol?.toUpperCase()
  if (rolUpper === "ADMIN") return false
  const caso = await prisma.caso.findUnique({
    where: { id: casoId },
    select: { abogadoId: true },
  })
  if (!caso) return false
  if (rolUpper === "ASISTENTE") return true
  return caso.abogadoId === userId
}

// ═════════════════════════════════════════════════════════════════════════
// QUERIES
// ═════════════════════════════════════════════════════════════════════════

/**
 * Lista todas las OCAs del expediente (no eliminadas).
 * Se muestra en la sección "Plantillas OCA" del tab Documentación del caso.
 */
export async function getPlantillasOcaDeCaso(casoId: string): Promise<PlantillaOcaConRelaciones[]> {
  const user = await getUserSessionServer()
  if (!user) return []

  const puedeAcceder = await usuarioPuedeAccederCaso(casoId, user.id, user.rol)
  if (!puedeAcceder) return []

  const plantillas = await prisma.plantillaOca.findMany({
    where: { ...noEliminadas, casoId },
    include: includeRelaciones,
    orderBy: { createdAt: "desc" },
  })

  return plantillas.map(mapearPlantillaOca)
}

/**
 * Detalle de una plantilla OCA específica (por si se quiere abrir su info).
 */
export async function getPlantillaOcaDetalle(plantillaId: string): Promise<PlantillaOcaConRelaciones | null> {
  const user = await getUserSessionServer()
  if (!user) return null

  const plantilla = await prisma.plantillaOca.findUnique({
    where: { id: plantillaId },
    include: includeRelaciones,
  })

  if (!plantilla || plantilla.eliminadoEn) return null

  const puedeAcceder = await usuarioPuedeAccederCaso(plantilla.casoId, user.id, user.rol)
  if (!puedeAcceder) return null

  return mapearPlantillaOca(plantilla)
}

// ═════════════════════════════════════════════════════════════════════════
// GUARDAR PLANTILLA OCA
// ═════════════════════════════════════════════════════════════════════════
// Se llama desde telegramaAction.ts DESPUÉS de generar el PDF con pdf-lib.
//
// Recibe:
//   - casoId: el expediente al que pertenece la OCA
//   - tipoPlantilla: enum de qué tipo es
//   - datos: snapshot del formulario para consulta futura
//   - pdfBuffer: el PDF generado (Buffer)
//   - descripcion: opcional
//
// Hace:
//   1. Sube el PDF a Vercel Blob en `casos/{casoId}/ocas/{tipo}_{timestamp}.pdf`
//   2. Crea el registro en plantilla_oca
//   3. Registra en bitácora acción OCA_CREADA
// ═════════════════════════════════════════════════════════════════════════

export async function guardarPlantillaOcaAction(data: {
  casoId: string
  tipoPlantilla: TipoPlantillaOca
  datos: any
  pdfBuffer: Buffer
  descripcion?: string
}): Promise<{ success?: boolean; error?: string; plantillaOcaId?: string; archivoUrl?: string }> {
  const user = await getUserSessionServer()
  if (!user?.id) return { error: "No autorizado" }

  const puedeAcceder = await usuarioPuedeAccederCaso(data.casoId, user.id, user.rol)
  if (!puedeAcceder) return { error: "Sin permisos sobre este expediente" }

  // Verificar que el caso no esté cerrado
  const caso = await prisma.caso.findUnique({
    where: { id: data.casoId },
    select: { estaCerrado: true, numero: true },
  })
  if (!caso) return { error: "El expediente no existe" }
  if (caso.estaCerrado) return { error: "No se puede generar OCAs en expedientes cerrados" }

  try {
    // ── 1. Generar nombres del archivo ──
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
    const tipoLower = data.tipoPlantilla.toLowerCase()
    const uuid = crypto.randomUUID().slice(0, 8)
    
    // storageKey (pathname del blob, único y organizado por caso)
    const storageKey = `casos/${data.casoId}/ocas/${tipoLower}_${timestamp}_${uuid}.pdf`
    
    // archivoNombre (amigable para descarga)
    const nombreAmigable = `OCA-${TIPO_PLANTILLA_OCA_LABELS[data.tipoPlantilla].replace(/[\s\/\(\)]/g, "-")}-${timestamp.slice(0, 10)}.pdf`

    // ── 2. Subir a Vercel Blob ──
    const blob = await put(storageKey, data.pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: false,  // Ya agregamos uuid nosotros
    })

    // ── 3. Crear registro en BD ──
    const plantilla = await prisma.plantillaOca.create({
      data: {
        tipoPlantilla: data.tipoPlantilla,
        datos: data.datos,
        archivoUrl: blob.url,
        archivoStorageKey: storageKey,
        archivoNombre: nombreAmigable,
        archivoTamanio: data.pdfBuffer.length,
        descripcion: data.descripcion?.trim() || null,
        casoId: data.casoId,
        creadoPorId: user.id,
      },
    })

    // ── 4. Registrar en bitácora ──
    const tipoLabel = TIPO_PLANTILLA_OCA_LABELS[data.tipoPlantilla]
    await prisma.bitacora.create({
      data: {
        texto: `Plantilla OCA generada: ${tipoLabel}`,
        detalle: data.descripcion?.trim()
          ? `Archivo: ${nombreAmigable} | "${data.descripcion.trim()}"`
          : `Archivo: ${nombreAmigable}`,
        tipo: "auto",
        accion: "OCA_CREADA",
        usuarioId: user.id,
        casoId: data.casoId,
        plantillaOcaId: plantilla.id,
      },
    })

    revalidatePath(`/casos/${data.casoId}`)

    return {
      success: true,
      plantillaOcaId: plantilla.id,
      archivoUrl: blob.url,
    }
  } catch (error: any) {
    console.error("[OCA] Error al guardar plantilla:", error)
    return { error: error.message || "Error al guardar la plantilla en el expediente" }
  }
}

// ═════════════════════════════════════════════════════════════════════════
// ELIMINAR PLANTILLA OCA (SOFT DELETE + BORRADO FÍSICO DEL BLOB)
// ═════════════════════════════════════════════════════════════════════════

export async function eliminarPlantillaOcaAction(
  plantillaId: string,
  motivo?: string
): Promise<{ success?: boolean; error?: string }> {
  const user = await getUserSessionServer()
  if (!user?.id) return { error: "No autorizado" }

  try {
    const plantilla = await prisma.plantillaOca.findUnique({
      where: { id: plantillaId },
      select: {
        creadoPorId: true,
        casoId: true,
        tipoPlantilla: true,
        archivoNombre: true,
        archivoStorageKey: true,
        eliminadoEn: true,
      },
    })
    if (!plantilla) return { error: "Plantilla OCA no encontrada" }
    if (plantilla.eliminadoEn) return { error: "La plantilla ya fue eliminada" }

    // Acceso: creador o asistente
    const esCreador = plantilla.creadoPorId === user.id
    if (!esCreador && user.rol !== "ASISTENTE") {
      return { error: "Solo el creador puede eliminar esta plantilla OCA" }
    }

    // ── Borrar el archivo físico del blob ──
    // Si falla el borrado del blob, seguimos con el soft delete (mejor perder
    // el archivo huérfano que dejar un estado inconsistente en BD).
    try {
      await del(plantilla.archivoStorageKey)
    } catch (blobError) {
      console.error("[OCA] Error borrando blob (continuamos con soft delete):", blobError)
    }

    // ── Soft delete en BD ──
    await prisma.plantillaOca.update({
      where: { id: plantillaId },
      data: {
        eliminadoEn: new Date(),
        eliminadoPorId: user.id,
      },
    })

    // ── Bitácora ──
    const tipoLabel = TIPO_PLANTILLA_OCA_LABELS[plantilla.tipoPlantilla]
    await prisma.bitacora.create({
      data: {
        texto: `Plantilla OCA eliminada: ${tipoLabel}`,
        detalle: motivo?.trim()
          ? `Archivo: ${plantilla.archivoNombre} | Motivo: ${motivo.trim()}`
          : `Archivo: ${plantilla.archivoNombre}`,
        tipo: "auto",
        accion: "OCA_ELIMINADA",
        usuarioId: user.id,
        casoId: plantilla.casoId,
        plantillaOcaId: plantillaId,
      },
    })

    revalidatePath(`/casos/${plantilla.casoId}`)
    return { success: true }
  } catch (error: any) {
    console.error("[OCA] Error eliminando plantilla:", error)
    return { error: error.message || "Error al eliminar la plantilla OCA" }
  }
}