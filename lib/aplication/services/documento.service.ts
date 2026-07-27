// src/lib/aplication/services/documento.service.ts

import prisma from "src/lib/db/prisma"
import { storage } from "src/lib/storage"
import { buildStorageKey } from "src/lib/storage/storageKeys"
import { differenceInDays } from "date-fns"
import {
  DocumentoListItem,
  CarpetaListItem,
  ContenidoCarpeta
} from "./documento.types"

// ============================================================================
// TIPOS
// ============================================================================

export type DocumentoUploadInput = {
  casoId: string
  subidoPorId: string
  carpetaId?: string | null      // null/undefined = raíz del expediente
  descripcion?: string
  esInterno?: boolean
  file: {
    buffer: Buffer
    nombre: string
    tipo: string
    tamanio: number
  }
}

// Contexto del usuario para validar ownership (ADMIN es técnico, sin datos legales).
export type ContextoUsuario = {
  usuarioId: string
  rol?: string | null
}

const TIPOS_PERMITIDOS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain'
]

const TAMANIO_MAXIMO = 10 * 1024 * 1024 // 10MB

// Repara nombres mal decodificados (UTF-8 leído como Latin-1): "ConfirmaciÃ³n" → "Confirmación".
// Si el nombre ya está bien, lo devuelve intacto.
function repararNombreArchivo(nombre: string): string {
  // La firma del problema es la secuencia Ã seguida de otro byte alto.
  if (!/Ã.|Â./.test(nombre)) return nombre
  try {
    // Reinterpretar los bytes Latin-1 como UTF-8
    const reparado = Buffer.from(nombre, 'latin1').toString('utf8')
    // Solo aceptar la reparación si no introdujo el carácter de reemplazo (�)
    return reparado.includes('\uFFFD') ? nombre : reparado
  } catch {
    return nombre
  }
}

// ============================================================================
// SERVICE
// ============================================================================

export class DocumentoService {

  // --------------------------------------------------------------------------
  // OWNERSHIP
  // --------------------------------------------------------------------------
  private async verificarAccesoCaso(casoId: string, ctx?: ContextoUsuario): Promise<void> {
    const caso = await prisma.caso.findUnique({
      where: { id: casoId },
      select: { id: true, abogadoId: true }
    })
    if (!caso) throw new Error('Caso no encontrado')
    if (!ctx) return
 
    const rol = ctx.rol?.toUpperCase()
 
    // ADMIN no tiene acceso a datos legales (es solo técnico).
    if (rol === 'ADMIN') {
      throw new Error('El rol administrador no tiene acceso a los documentos de los expedientes')
    }
 
    // ASISTENTE tiene acceso general a cualquier expediente del estudio
    // (no es titular de casos, pero asiste a todos los abogados).
    if (rol === 'ASISTENTE') return
 
    // ABOGADO solo accede a sus propios expedientes.
    if (caso.abogadoId !== ctx.usuarioId) {
      throw new Error('No tenés permiso para acceder a los documentos de este expediente')
    }
  }

  // Valida que una carpeta exista y pertenezca al caso indicado.
  private async verificarCarpetaDelCaso(carpetaId: string, casoId: string) {
    const carpeta = await prisma.carpeta.findUnique({
      where: { id: carpetaId },
      select: { id: true, casoId: true, nombre: true, carpetaPadreId: true }
    })
    if (!carpeta) throw new Error('Carpeta no encontrada')
    if (carpeta.casoId !== casoId) throw new Error('La carpeta no pertenece a este expediente')
    return carpeta
  }

  // --------------------------------------------------------------------------
  // VALIDACIÓN DE ARCHIVO
  // --------------------------------------------------------------------------
  validarArchivo(tipo: string, tamanio: number): { valido: boolean; error?: string } {
    if (!TIPOS_PERMITIDOS.includes(tipo)) {
      return { valido: false, error: `Tipo de archivo no permitido. Se aceptan: PDF, Word, Excel, imágenes y texto plano.` }
    }
    if (tamanio > TAMANIO_MAXIMO) {
      return { valido: false, error: `El archivo supera el tamaño máximo permitido de 10MB.` }
    }
    return { valido: true }
  }

  // ==========================================================================
  // CARPETAS
  // ==========================================================================

  // Crea una carpeta en la raíz del expediente o dentro de otra carpeta.
  async crearCarpeta(
    casoId: string,
    nombre: string,
    carpetaPadreId: string | null,
    ctx?: ContextoUsuario
  ) {
    await this.verificarAccesoCaso(casoId, ctx)

    const nombreLimpio = nombre.trim()
    if (!nombreLimpio) throw new Error('El nombre de la carpeta no puede estar vacío')
    if (nombreLimpio.length > 100) throw new Error('El nombre es demasiado largo (máximo 100 caracteres)')

    // Si es anidada, validar que la carpeta padre sea del mismo caso.
    let nombrePadre: string | null = null
    if (carpetaPadreId) {
      const padre = await this.verificarCarpetaDelCaso(carpetaPadreId, casoId)
      nombrePadre = padre.nombre
    }

    // Evitar duplicados en el mismo nivel.
    const yaExiste = await prisma.carpeta.findFirst({
      where: { casoId, carpetaPadreId: carpetaPadreId ?? null, nombre: nombreLimpio }
    })
    if (yaExiste) throw new Error('Ya existe una carpeta con ese nombre en este nivel')

    const carpeta = await prisma.carpeta.create({
      data: { casoId, nombre: nombreLimpio, carpetaPadreId: carpetaPadreId ?? null }
    })

    await prisma.bitacora.create({
      data: {
        casoId, usuarioId: ctx?.usuarioId || '',
        accion: 'CARPETA_CREADA',
        texto: `Carpeta creada: ${nombreLimpio}`,
        detalle: nombrePadre
          ? `Dentro de la carpeta "${nombrePadre}"`
          : 'En la raíz del expediente',
        tipo: 'sistema'
      }
    })

    return carpeta
  }

  async renombrarCarpeta(carpetaId: string, nuevoNombre: string, ctx?: ContextoUsuario) {
    const carpeta = await prisma.carpeta.findUnique({
      where: { id: carpetaId },
      select: { id: true, casoId: true, carpetaPadreId: true, nombre: true }
    })
    if (!carpeta) throw new Error('Carpeta no encontrada')
    await this.verificarAccesoCaso(carpeta.casoId, ctx)

    const nombreLimpio = nuevoNombre.trim()
    if (!nombreLimpio) throw new Error('El nombre no puede estar vacío')
    if (nombreLimpio.length > 100) throw new Error('El nombre es demasiado largo (máximo 100 caracteres)')
    if (nombreLimpio === carpeta.nombre) return carpeta // no-op si no cambió

    const yaExiste = await prisma.carpeta.findFirst({
      where: {
        casoId: carpeta.casoId,
        carpetaPadreId: carpeta.carpetaPadreId,
        nombre: nombreLimpio,
        id: { not: carpetaId }
      }
    })
    if (yaExiste) throw new Error('Ya existe una carpeta con ese nombre en este nivel')

    const actualizada = await prisma.carpeta.update({
      where: { id: carpetaId },
      data: { nombre: nombreLimpio }
    })

    await prisma.bitacora.create({
      data: {
        casoId: carpeta.casoId,
        usuarioId: ctx?.usuarioId || '',
        accion: 'CARPETA_RENOMBRADA',
        texto: `Carpeta renombrada: "${carpeta.nombre}" → "${nombreLimpio}"`,
        tipo: 'sistema'
      }
    })

    return actualizada
  }

  // Borra una carpeta. El cascade del schema borra subcarpetas y documentos.
  // (Los archivos físicos del storage se limpian acá antes de borrar la fila.)
  async eliminarCarpeta(carpetaId: string, ctx?: ContextoUsuario) {
    const carpeta = await prisma.carpeta.findUnique({
      where: { id: carpetaId },
      select: { id: true, casoId: true, nombre: true }
    })
    if (!carpeta) throw new Error('Carpeta no encontrada')
    await this.verificarAccesoCaso(carpeta.casoId, ctx)

    // Recolectar TODOS los documentos de esta carpeta y sus subcarpetas (recursivo)
    // para borrar sus archivos físicos del storage.
    const idsCarpetas = await this.recolectarIdsCarpetaYDescendientes(carpetaId)
    const documentos = await prisma.documento.findMany({
      where: { carpetaId: { in: idsCarpetas } },
      select: { storageKey: true }
    })
    for (const doc of documentos) {
      try { await storage.delete(doc.storageKey) } catch { /* si falla, seguimos */ }
    }

    // Borrar la carpeta: el cascade del schema elimina subcarpetas y filas de documentos.
    // Las bitácoras previas de esos documentos quedan con documentoId = null (SetNull),
    // preservando la trazabilidad histórica.
    await prisma.carpeta.delete({ where: { id: carpetaId } })

    await prisma.bitacora.create({
      data: {
        casoId: carpeta.casoId, usuarioId: ctx?.usuarioId || '',
        accion: 'CARPETA_ELIMINADA',
        texto: `Carpeta eliminada: ${carpeta.nombre}`,
        detalle: `Se eliminaron ${documentos.length} documento(s) y sus subcarpetas`,
        tipo: 'sistema'
      }
    })

    return { success: true, documentosEliminados: documentos.length }
  }

  // Devuelve el id de la carpeta + todos sus descendientes (recursivo).
  private async recolectarIdsCarpetaYDescendientes(carpetaId: string): Promise<string[]> {
    const resultado: string[] = [carpetaId]
    const hijas = await prisma.carpeta.findMany({
      where: { carpetaPadreId: carpetaId },
      select: { id: true }
    })
    for (const hija of hijas) {
      const sub = await this.recolectarIdsCarpetaYDescendientes(hija.id)
      resultado.push(...sub)
    }
    return resultado
  }

  // --------------------------------------------------------------------------
  // CONTENIDO DE UN NIVEL (raíz del caso o dentro de una carpeta)
  // --------------------------------------------------------------------------
  async getContenido(
    casoId: string,
    carpetaId: string | null,
    opciones?: { soloPublicos?: boolean },
    ctx?: ContextoUsuario
  ): Promise<ContenidoCarpeta> {
    await this.verificarAccesoCaso(casoId, ctx)

    // Carpeta actual + breadcrumb
    let carpetaActual: CarpetaListItem | null = null
    const ruta: CarpetaListItem[] = []

    if (carpetaId) {
      const actual = await this.mapearCarpeta(carpetaId)
      if (!actual || actual.casoId !== casoId) throw new Error('Carpeta no encontrada en este expediente')
      carpetaActual = actual

      // Construir breadcrumb subiendo por los padres
      let cursor: string | null = actual.carpetaPadreId
      const cadena: CarpetaListItem[] = [actual]
      while (cursor) {
        const padre = await this.mapearCarpeta(cursor)
        if (!padre) break
        cadena.unshift(padre)
        cursor = padre.carpetaPadreId
      }
      ruta.push(...cadena)
    }

    // Subcarpetas de este nivel
    const subcarpetasRaw = await prisma.carpeta.findMany({
      where: { casoId, carpetaPadreId: carpetaId ?? null },
      orderBy: { nombre: 'asc' }
    })
    const subcarpetas: CarpetaListItem[] = []
    for (const c of subcarpetasRaw) {
      subcarpetas.push(await this.mapearCarpetaDesde(c))
    }

    // Documentos de este nivel
    const whereDoc: any = { casoId, carpetaId: carpetaId ?? null }
    if (opciones?.soloPublicos) whereDoc.esInterno = false

    const documentosRaw = await prisma.documento.findMany({
      where: whereDoc,
      include: { subidoPor: { select: { nombre: true, apellido: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    })
    const documentos = documentosRaw.map(d => this.mapearDocumento(d))

    return { carpetaActual, ruta, subcarpetas, documentos }
  }

  // Lista TODOS los documentos de un caso (para vista "todos", sin navegar carpetas).
  async getTodosLosDocumentos(
    casoId: string,
    opciones?: { soloPublicos?: boolean },
    ctx?: ContextoUsuario
  ): Promise<DocumentoListItem[]> {
    await this.verificarAccesoCaso(casoId, ctx)
    const where: any = { casoId }
    if (opciones?.soloPublicos) where.esInterno = false

    const docs = await prisma.documento.findMany({
      where,
      include: { subidoPor: { select: { nombre: true, apellido: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    })
    return docs.map(d => this.mapearDocumento(d))
  }

  // Lista las carpetas de un caso (para el selector del drawer de subida).
  async getCarpetasDelCaso(casoId: string, ctx?: ContextoUsuario): Promise<CarpetaListItem[]> {
    await this.verificarAccesoCaso(casoId, ctx)
    const carpetas = await prisma.carpeta.findMany({
      where: { casoId },
      orderBy: { nombre: 'asc' }
    })
    const items: CarpetaListItem[] = []
    for (const c of carpetas) {
      items.push(await this.mapearCarpetaDesde(c))
    }
    return items
  }

  // --------------------------------------------------------------------------
  // SUBIR DOCUMENTO
  // --------------------------------------------------------------------------
  async subirDocumento(input: DocumentoUploadInput, ctx?: ContextoUsuario) {
    const { casoId, subidoPorId, carpetaId, descripcion, esInterno, file } = input

    const validacion = this.validarArchivo(file.tipo, file.tamanio)
    if (!validacion.valido) throw new Error(validacion.error)

    await this.verificarAccesoCaso(casoId, ctx)

    // Si va dentro de una carpeta, validar que sea del mismo caso.
    let nombreCarpeta: string | null = null
    if (carpetaId) {
      const carpeta = await this.verificarCarpetaDelCaso(carpetaId, casoId)
      nombreCarpeta = carpeta.nombre
    }

    const nombreArchivo = repararNombreArchivo(file.nombre)
    const storageKey = buildStorageKey(casoId, carpetaId || 'raiz', nombreArchivo)
    const extension = nombreArchivo.split('.').pop()?.toLowerCase() || ''

    const resultado = await storage.upload(file.buffer, storageKey, file.tipo)

    const documento = await prisma.documento.create({
      data: {
        nombre: nombreArchivo,
        nombreOriginal: nombreArchivo,
        storageKey: resultado.storageKey,
        url: resultado.url,
        tipo: file.tipo,
        extension,
        tamanio: file.tamanio,
        descripcion: descripcion || null,
        esInterno: esInterno || false,
        casoId,
        carpetaId: carpetaId ?? null,
        subidoPorId
      }
    })

    await prisma.bitacora.create({
      data: {
        casoId,
        usuarioId: subidoPorId,
        documentoId: documento.id,
        accion: 'DOCUMENTO_SUBIDO',
        texto: `Documento subido: ${nombreArchivo}`,
        detalle: [
          `Tamaño: ${this.formatearTamanio(file.tamanio)}`,
          nombreCarpeta ? `Carpeta: ${nombreCarpeta}` : 'Carpeta: raíz del expediente',
          esInterno ? 'Visibilidad: solo interno' : 'Visibilidad: visible al cliente',
        ].join(' | '),
        tipo: 'sistema'
      }
    })

    return documento
  }

  // --------------------------------------------------------------------------
  // ELIMINAR DOCUMENTO
  // --------------------------------------------------------------------------
  // El orden importa: creamos la bitácora ANTES del delete físico, así
  // documentoId referencia al documento (que aún existe). Cuando borramos
  // el documento, el SetNull del schema deja la bitácora con documentoId=null
  // pero el texto/detalle conservan toda la info histórica.
  async eliminarDocumento(documentoId: string, usuarioId: string, ctx?: ContextoUsuario) {
    const documento = await prisma.documento.findUnique({
      where: { id: documentoId },
      select: { id: true, nombre: true, storageKey: true, casoId: true, tamanio: true }
    })
    if (!documento) throw new Error('Documento no encontrado')
    await this.verificarAccesoCaso(documento.casoId, ctx ?? { usuarioId })

    // 1. Crear bitácora primero, con la referencia al documento
    await prisma.bitacora.create({
      data: {
        casoId: documento.casoId,
        usuarioId,
        documentoId: documento.id,
        accion: 'DOCUMENTO_ELIMINADO',
        texto: `Documento eliminado: ${documento.nombre}`,
        detalle: `Tamaño: ${this.formatearTamanio(documento.tamanio)}`,
        tipo: 'sistema'
      }
    })

    // 2. Borrar físicamente. El SetNull del schema dejará la bitácora anterior
    //    con documentoId=null, lo cual es correcto (el doc ya no existe).
    await storage.delete(documento.storageKey)
    await prisma.documento.delete({ where: { id: documentoId } })

    return { success: true }
  }

  // --------------------------------------------------------------------------
  // MOVER DOCUMENTO a otra carpeta (o a la raíz)
  // --------------------------------------------------------------------------
  async moverDocumento(
    documentoId: string,
    nuevaCarpetaId: string | null,
    ctx?: ContextoUsuario
  ) {
    const documento = await prisma.documento.findUnique({
      where: { id: documentoId },
      select: { id: true, casoId: true, nombre: true, carpetaId: true }
    })
    if (!documento) throw new Error('Documento no encontrado')
    await this.verificarAccesoCaso(documento.casoId, ctx)

    // Resolver nombres de origen y destino para el detalle de la bitácora
    let nombreOrigen = 'raíz del expediente'
    if (documento.carpetaId) {
      const origen = await prisma.carpeta.findUnique({
        where: { id: documento.carpetaId },
        select: { nombre: true }
      })
      if (origen) nombreOrigen = `"${origen.nombre}"`
    }

    let nombreDestino = 'raíz del expediente'
    if (nuevaCarpetaId) {
      const destino = await this.verificarCarpetaDelCaso(nuevaCarpetaId, documento.casoId)
      nombreDestino = `"${destino.nombre}"`
    }

    // No-op si no cambió de ubicación
    if (documento.carpetaId === (nuevaCarpetaId ?? null)) return documento

    const actualizado = await prisma.documento.update({
      where: { id: documentoId },
      data: { carpetaId: nuevaCarpetaId ?? null }
    })

    await prisma.bitacora.create({
      data: {
        casoId: documento.casoId,
        usuarioId: ctx?.usuarioId || '',
        documentoId: documento.id,
        accion: 'DOCUMENTO_MOVIDO',
        texto: `Documento "${documento.nombre}" movido a ${nombreDestino}`,
        detalle: `Desde ${nombreOrigen} → ${nombreDestino}`,
        tipo: 'sistema'
      }
    })

    return actualizado
  }

  // --------------------------------------------------------------------------
  // ACTUALIZAR METADATA (descripción, visibilidad)
  // --------------------------------------------------------------------------
  async actualizarDocumento(
    documentoId: string,
    usuarioId: string,
    data: { descripcion?: string; esInterno?: boolean },
    ctx?: ContextoUsuario
  ) {
    const documento = await prisma.documento.findUnique({
      where: { id: documentoId },
      select: { id: true, casoId: true, nombre: true, descripcion: true, esInterno: true }
    })
    if (!documento) throw new Error('Documento no encontrado')
    await this.verificarAccesoCaso(documento.casoId, ctx ?? { usuarioId })

    const cambios: string[] = []
    if (data.descripcion !== undefined && data.descripcion !== documento.descripcion) {
      cambios.push('Descripción actualizada')
    }
    if (data.esInterno !== undefined && data.esInterno !== documento.esInterno) {
      cambios.push(data.esInterno ? 'Marcado como interno' : 'Marcado como visible al cliente')
    }

    const actualizado = await prisma.documento.update({
      where: { id: documentoId },
      data
    })

    await prisma.bitacora.create({
      data: {
        casoId: documento.casoId,
        usuarioId,
        documentoId: documento.id,
        accion: 'DOCUMENTO_ACTUALIZADO',
        texto: `Documento actualizado: ${documento.nombre}`,
        detalle: cambios.length > 0 ? cambios.join(' | ') : null,
        tipo: 'sistema'
      }
    })

    return actualizado
  }

  // --------------------------------------------------------------------------
  // MAPPERS
  // --------------------------------------------------------------------------
  private mapearDocumento(doc: any): DocumentoListItem {
    return {
      id: doc.id,
      nombre: doc.nombre,
      nombreOriginal: doc.nombreOriginal,
      tipo: doc.tipo,
      extension: doc.extension,
      tamanio: doc.tamanio,
      descripcion: doc.descripcion,
      esInterno: doc.esInterno,
      url: doc.url || '',
      storageKey: doc.storageKey,
      casoId: doc.casoId,
      carpetaId: doc.carpetaId ?? null,
      subidoPor: doc.subidoPor?.nombre && doc.subidoPor?.apellido
        ? `${doc.subidoPor.nombre} ${doc.subidoPor.apellido}`
        : (doc.subidoPor?.email?.split('@')[0] || 'Usuario'),
      subidoPorId: doc.subidoPorId,
      createdAt: doc.createdAt,
      diasSubido: differenceInDays(new Date(), doc.createdAt)
    }
  }

  private async mapearCarpeta(carpetaId: string): Promise<CarpetaListItem | null> {
    const c = await prisma.carpeta.findUnique({ where: { id: carpetaId } })
    if (!c) return null
    return this.mapearCarpetaDesde(c)
  }

  private async mapearCarpetaDesde(c: any): Promise<CarpetaListItem> {
    const [cantidadDocumentos, cantidadSubcarpetas] = await Promise.all([
      prisma.documento.count({ where: { carpetaId: c.id } }),
      prisma.carpeta.count({ where: { carpetaPadreId: c.id } })
    ])
    return {
      id: c.id,
      nombre: c.nombre,
      casoId: c.casoId,
      carpetaPadreId: c.carpetaPadreId ?? null,
      cantidadDocumentos,
      cantidadSubcarpetas,
      createdAt: c.createdAt
    }
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------
  formatearTamanio(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
}