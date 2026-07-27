'use server'

import { PDFDocument, StandardFonts, PDFFont } from 'pdf-lib'
import fs from 'fs/promises'
import path from 'path'
import prisma from "src/lib/db/prisma"
import { getUserSessionServer } from "src/auth/actions/auth-actions"
// [OCA] Validación de CUIT con dígito verificador (Opción B: bloquear si inválido)
import { validarCuit } from "src/lib/utils/cuit"
// [OCA] Guardar automáticamente la plantilla en el expediente
import { guardarPlantillaOcaAction } from "src/lib/actions/plantilla-oca-actions"
import { TipoPlantillaOca } from "@prisma/client"

// ═══════════════════════════════════════════════════════════════════════════
// ACTION DE TELEGRAMAS — versión con persistencia automática
// ═══════════════════════════════════════════════════════════════════════════
//   • CUIT del destinatario: se VALIDA con dígito verificador (módulo 11)
//     antes de generar. Si no valida, se rechaza (excepto ARCA que no tiene
//     destinatario). Se escribe sin guiones, al imprimir se formatea como
//     XX-XXXXXXXX-X (si tiene 11 dígitos).
//   • Fecha: automática (la del día). El formulario ya no la pide.
//   • Límites: Renuncia/Ausencia 30 palabras, Otro 1568, ARCA 1187 caracteres.
//   • Seguridad: sesión + ownership. Aplanado final.
//   • Persistencia [NUEVO]: después de generar el PDF, se guarda automática-
//     mente en la tabla plantilla_oca del expediente (tercera esfera del tab
//     Documentación). El archivo va a Vercel Blob.
// ═══════════════════════════════════════════════════════════════════════════

export interface DatosTelegrama {
  casoId: string
  tipoTelegrama: 'renuncia' | 'hasta-30' | 'mas-30' | 'arca' | 'comunicacion-renuncia' | 'ausencia' | 'comunicacion-ausencia-23789' | 'otro' | 'otro-tipo-comunicacion-laboral' | 'comunicacion-ARCA-articulo-11'
  remitenteNombre: string
  remitenteDni: string
  remitenteDomicilio: string
  remitenteLocalidad: string
  remitenteProvincia: string
  remitenteTelefono?: string
  remitenteCp?: string
  destinatarioNombre: string
  destinatarioCuit?: string
  destinatarioDomicilio: string
  destinatarioLocalidad: string
  destinatarioProvincia: string
  destinatarioActividad?: string
  destinatarioCp?: string
  cuerpoTexto: string
  descripcion?: string  // [OCA] opcional, para agregar contexto al guardar
}

const TAMANO_FUENTE = 10
const MARGEN_ANCHO = 0.95

type LimiteCuerpo = { unidad: 'palabras' | 'caracteres'; max: number }
type RenglonConfig = { nombre: string; ancho: number }
type CuerpoConfig =
  | { tipo: 'renglones'; renglones: RenglonConfig[]; limite: LimiteCuerpo }
  | { tipo: 'multilinea'; campo: string; limite: LimiteCuerpo; fontSize?: number }

interface MapeoCampos {
  remitenteNombre?: string
  remitenteDni?: string
  remitenteDomicilio?: string
  remitenteLocalidad?: string
  remitenteProvincia?: string
  remitenteTelefono?: string
  remitenteCp?: string
  destinatarioNombre?: string
  destinatarioCuit?: string
  destinatarioDomicilio?: string
  destinatarioLocalidad?: string
  destinatarioProvincia?: string
  destinatarioActividad?: string
  destinatarioCp?: string
  fecha?: string
  cuerpo: CuerpoConfig
}

const MAPEOS: Record<string, MapeoCampos> = {
  'comunicacion-renuncia.pdf': {
    remitenteNombre: 'Apellido y Nombre REMITENTE',
    remitenteDni: 'N° DNI REMITENTE',
    remitenteDomicilio: 'Domicilio real REMITENTE',
    remitenteLocalidad: 'Localidad REMITENTE',
    remitenteProvincia: 'Provincia REMITENTE',
    remitenteTelefono: 'Teléfono',
    remitenteCp: 'CP REMITENTE',
    destinatarioNombre: 'Apellido y Nombre o Razón Social',
    destinatarioCuit: 'N° CUIT',
    destinatarioDomicilio: 'Domicilio Laboral',
    destinatarioLocalidad: 'Localidad',
    destinatarioProvincia: 'Provincia',
    destinatarioActividad: 'Ramo o actividad principal',
    destinatarioCp: 'CP',
    fecha: 'Fecha',
    cuerpo: {
      tipo: 'renglones',
      limite: { unidad: 'palabras', max: 30 },
      renglones: [
        { nombre: 'Texto cuerpo 1', ancho: 267 },
        { nombre: 'Texto cuerpo 2', ancho: 532 },
        { nombre: 'Texto cuerpo 3', ancho: 262 },
      ],
    },
  },
  'comunicacion-ausencia-23789.pdf': {
    remitenteNombre: 'Apellido y nombre REMITENTE',
    remitenteDni: 'DNI',
    remitenteDomicilio: 'Domicilio real',
    remitenteLocalidad: 'Localidad REMITENTE',
    remitenteProvincia: 'Provincia REMITENTE',
    remitenteTelefono: 'Teléfono',
    remitenteCp: 'CP REMITENTE',
    destinatarioNombre: 'Apellido y nombre o razón social',
    destinatarioCuit: 'N° CUIT',
    destinatarioDomicilio: 'Domicilio laboral',
    destinatarioLocalidad: 'Localidad',
    destinatarioProvincia: 'Provincia',
    destinatarioActividad: 'Ramo o actividad principal',
    destinatarioCp: 'CP',
    fecha: 'Fecha',
    cuerpo: { tipo: 'multilinea', campo: 'Campo de texto', limite: { unidad: 'palabras', max: 30 }, fontSize: 8 },
  },
  'otro-tipo-comunicacion-laboral.pdf': {
    remitenteNombre: 'Apellido y nombre REMITENTE',
    remitenteDni: 'N° DNI REMITENTE',
    remitenteDomicilio: 'Domicilio real',
    remitenteLocalidad: 'Localidad REMITENTE',
    remitenteProvincia: 'Provincia REMITENTE',
    remitenteCp: 'CP REMITENTE',
    destinatarioNombre: 'Apellido y nombre o razón social',
    destinatarioDomicilio: 'Domicilio laboral',
    destinatarioLocalidad: 'Localidad',
    destinatarioProvincia: 'Provincia',
    destinatarioActividad: 'Ramo o actividad principal',
    destinatarioCp: 'CP',
    fecha: 'Fecha',
    cuerpo: { tipo: 'multilinea', campo: 'Campo de texto', limite: { unidad: 'caracteres', max: 1568 } },
  },
  'comunicacion-ARCA-articulo-11.pdf': {
    remitenteNombre: 'Apellido y nombre',
    remitenteDni: 'DNI N',
    remitenteDomicilio: 'Domicilio real',
    remitenteLocalidad: 'Localidd',
    remitenteProvincia: 'Provincia',
    remitenteCp: 'Código Postal',
    fecha: 'Fecha',
    cuerpo: { tipo: 'multilinea', campo: 'Texto8', limite: { unidad: 'caracteres', max: 1187 } },
  },
}

function resolverArchivo(tipo: DatosTelegrama['tipoTelegrama']): string {
  switch (tipo) {
    case 'renuncia':
    case 'comunicacion-renuncia':
      return 'comunicacion-renuncia.pdf'
    case 'ausencia':
    case 'hasta-30':
    case 'comunicacion-ausencia-23789':
      return 'comunicacion-ausencia-23789.pdf'
    case 'otro':
    case 'mas-30':
    case 'otro-tipo-comunicacion-laboral':
      return 'otro-tipo-comunicacion-laboral.pdf'
    case 'arca':
    case 'comunicacion-ARCA-articulo-11':
      return 'comunicacion-ARCA-articulo-11.pdf'
    default:
      return 'comunicacion-renuncia.pdf'
  }
}

// [OCA] Mapea el tipo del formulario al enum de Prisma
function mapearTipoPlantilla(tipo: DatosTelegrama['tipoTelegrama']): TipoPlantillaOca {
  switch (tipo) {
    case 'renuncia':
    case 'comunicacion-renuncia':
      return 'RENUNCIA'
    case 'ausencia':
    case 'hasta-30':
    case 'comunicacion-ausencia-23789':
      return 'AUSENCIA'
    case 'otro':
    case 'mas-30':
    case 'otro-tipo-comunicacion-laboral':
      return 'OTRO'
    case 'arca':
    case 'comunicacion-ARCA-articulo-11':
      return 'ARCA'
    default:
      return 'OTRO'
  }
}

// [OCA] Los tipos que requieren CUIT del destinatario (todos menos ARCA)
function requiereCuitDestinatario(tipo: DatosTelegrama['tipoTelegrama']): boolean {
  return !['arca', 'comunicacion-ARCA-articulo-11'].includes(tipo)
}

function contarPalabras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length
}

function formatearCuit(valor?: string): string {
  if (!valor) return ''
  const soloDigitos = valor.replace(/\D/g, '')
  if (soloDigitos.length === 11) {
    return `${soloDigitos.slice(0, 2)}-${soloDigitos.slice(2, 10)}-${soloDigitos.slice(10)}`
  }
  return valor
}

function validarLimiteCuerpo(texto: string, limite: LimiteCuerpo): string | null {
  if (limite.unidad === 'palabras') {
    const p = contarPalabras(texto)
    if (p > limite.max) {
      return `Este formulario admite hasta ${limite.max} palabras (escribiste ${p}). Recortá ${p - limite.max} palabra(s).`
    }
  } else {
    const c = texto.length
    if (c > limite.max) {
      return `El texto supera el espacio del formulario (máximo ${limite.max} caracteres, escribiste ${c}). Recortá ${c - limite.max} caracteres.`
    }
  }
  return null
}

async function usuarioPuedeAccederCaso(
  casoId: string,
  userId: string,
  rol?: string | null
): Promise<boolean> {
  const rolUpper = rol?.toUpperCase()
  if (rolUpper === "ADMIN") return false

  const caso = await prisma.caso.findUnique({
    where: { id: casoId },
    select: { abogadoId: true }
  })
  if (!caso) return false

  if (rolUpper === "ASISTENTE") return true
  return caso.abogadoId === userId
}

export async function generarTelegramaPdfAction(datos: DatosTelegrama) {
  try {
    const user = await getUserSessionServer()
    if (!user?.id) return { success: false, error: "No autorizado" }

    const puedeAcceder = await usuarioPuedeAccederCaso(datos.casoId, user.id, user.rol)
    if (!puedeAcceder) return { success: false, error: "No tenés permiso para generar documentos de este expediente" }

    // [OCA] VALIDACIÓN DE CUIT DEL DESTINATARIO (Opción B: bloquear si inválido)
    // Se aplica a todos los tipos menos ARCA (que no tiene destinatario editable).
    if (requiereCuitDestinatario(datos.tipoTelegrama)) {
      if (!datos.destinatarioCuit || datos.destinatarioCuit.trim().length === 0) {
        return {
          success: false,
          error: "El CUIT del destinatario es obligatorio para este tipo de telegrama."
        }
      }
      if (!validarCuit(datos.destinatarioCuit)) {
        return {
          success: false,
          error: "El CUIT del destinatario no es válido. Verificá que tenga 11 dígitos con dígito verificador correcto (algoritmo módulo 11)."
        }
      }
    }

    const nombreArchivoPdf = resolverArchivo(datos.tipoTelegrama)
    const mapeo = MAPEOS[nombreArchivoPdf]
    if (!mapeo) return { success: false, error: "No hay mapeo de campos para este tipo de telegrama" }

    if (datos.cuerpoTexto?.trim()) {
      const errorLimite = validarLimiteCuerpo(datos.cuerpoTexto, mapeo.cuerpo.limite)
      if (errorLimite) return { success: false, error: errorLimite }
    }

    const urlsModelos: Record<string, string> = {
      'comunicacion-ARCA-articulo-11.pdf': 'https://cyfouzxlqfgip4ew.public.blob.vercel-storage.com/comunicacion-ARCA-articulo-11.pdf',
      'comunicacion-ausencia-23789.pdf': 'https://cyfouzxlqfgip4ew.public.blob.vercel-storage.com/comunicacion-ausencia-23789.pdf',
      'comunicacion-renuncia.pdf': 'https://cyfouzxlqfgip4ew.public.blob.vercel-storage.com/comunicacion-renuncia.pdf',
      'otro-tipo-comunicacion-laboral.pdf': 'https://cyfouzxlqfgip4ew.public.blob.vercel-storage.com/otro-tipo-comunicacion-laboral.pdf'
    };

    const urlPdf = urlsModelos[nombreArchivoPdf];
    if (!urlPdf) throw new Error("No se encontró el modelo de PDF en la nube");

    const response = await fetch(urlPdf);
    const pdfBytesOriginales = await response.arrayBuffer();

    const pdfDoc = await PDFDocument.load(pdfBytesOriginales);
    const form = pdfDoc.getForm()
    const fuente = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const safeUpper = (txt?: string) => (txt || '').toUpperCase()

    const rellenar = (nombreCampoEnPdf: string | undefined, valor?: string) => {
      if (!nombreCampoEnPdf) return
      if (valor === undefined || valor === null || valor === '') return
      try {
        const campo = form.getTextField(nombreCampoEnPdf)
        if (campo) campo.setText(safeUpper(valor))
      } catch { /* el PDF no tiene ese campo */ }
    }

    // ── Remitente ──
    rellenar(mapeo.remitenteNombre, datos.remitenteNombre)
    rellenar(mapeo.remitenteDni, datos.remitenteDni)
    rellenar(mapeo.remitenteDomicilio, datos.remitenteDomicilio)
    rellenar(mapeo.remitenteLocalidad, datos.remitenteLocalidad)
    rellenar(mapeo.remitenteProvincia, datos.remitenteProvincia)
    rellenar(mapeo.remitenteTelefono, datos.remitenteTelefono)
    rellenar(mapeo.remitenteCp, datos.remitenteCp)

    // ── Destinatario (CUIT formateado con guiones) ──
    rellenar(mapeo.destinatarioNombre, datos.destinatarioNombre)
    rellenar(mapeo.destinatarioCuit, formatearCuit(datos.destinatarioCuit))
    rellenar(mapeo.destinatarioDomicilio, datos.destinatarioDomicilio)
    rellenar(mapeo.destinatarioLocalidad, datos.destinatarioLocalidad)
    rellenar(mapeo.destinatarioProvincia, datos.destinatarioProvincia)
    rellenar(mapeo.destinatarioActividad, datos.destinatarioActividad)
    rellenar(mapeo.destinatarioCp, datos.destinatarioCp)

    // ── Fecha automática (la del día) ──
    rellenar(mapeo.fecha, new Date().toLocaleDateString('es-AR'))

    // ═══════════════════════════════════════════════════════════════════════
    // CUERPO
    // ═══════════════════════════════════════════════════════════════════════
    if (datos.cuerpoTexto?.trim()) {
      if (mapeo.cuerpo.tipo === 'multilinea') {
        try {
          const campoPdf = form.getTextField(mapeo.cuerpo.campo)
          if (campoPdf) {
            campoPdf.enableMultiline()
            // Sin tamaño explícito el campo usa el default del AcroForm, que en
            // algunos modelos es tan grande que el texto se recorta al aplanar.
            if (mapeo.cuerpo.fontSize) campoPdf.setFontSize(mapeo.cuerpo.fontSize)
            campoPdf.setText(safeUpper(datos.cuerpoTexto))
          }
        } catch (e) {
          console.error(`[OCA] No se pudo escribir el cuerpo en "${mapeo.cuerpo.campo}" de ${nombreArchivoPdf}:`, e)
          return {
            success: false,
            error: `No se pudo escribir el texto en el formulario oficial (campo "${mapeo.cuerpo.campo}").`,
          }
        }
      } else {
        const renglonesCfg = mapeo.cuerpo.renglones
        const pals = safeUpper(datos.cuerpoTexto).split(/\s+/).filter(Boolean)
        const textosPorRenglon: string[] = []
        let idxRenglon = 0
        let lineaActual = ''
        let sobrante = ''

        for (let i = 0; i < pals.length; i++) {
          const palabra = pals[i]
          const anchoMax = renglonesCfg[idxRenglon].ancho * MARGEN_ANCHO
          const tentativa = lineaActual ? `${lineaActual} ${palabra}` : palabra
          const ancho = fuente.widthOfTextAtSize(tentativa, TAMANO_FUENTE)
          if (ancho > anchoMax && lineaActual) {
            textosPorRenglon.push(lineaActual)
            lineaActual = palabra
            idxRenglon++
            if (idxRenglon >= renglonesCfg.length) {
              sobrante = [lineaActual, ...pals.slice(i + 1)].join(' ')
              lineaActual = ''
              break
            }
          } else {
            lineaActual = tentativa
          }
        }
        if (lineaActual && idxRenglon < renglonesCfg.length) textosPorRenglon.push(lineaActual)

        if (sobrante.trim().length > 0) {
          return {
            success: false,
            error: `El texto no entra en los renglones del formulario. Recortá aprox. ${sobrante.length} caracteres.`,
          }
        }

        renglonesCfg.forEach((r, idx) => rellenar(r.nombre, textosPorRenglon[idx] || ''))
      }
    }

    form.flatten()

    const pdfBytesModificados = await pdfDoc.save()
    const pdfBase64 = Buffer.from(pdfBytesModificados).toString('base64')

    // [OCA] PERSISTENCIA AUTOMÁTICA
    // Después de generar el PDF exitosamente, lo guardamos en el expediente.
    // Si el guardado falla, NO fallamos toda la operación: al menos el usuario
    // pudo imprimir su OCA. El error se loguea y se devuelve como warning.
    const pdfBuffer = Buffer.from(pdfBytesModificados)
    const tipoPlantilla = mapearTipoPlantilla(datos.tipoTelegrama)
    
    const resultadoGuardado = await guardarPlantillaOcaAction({
      casoId: datos.casoId,
      tipoPlantilla,
      datos: {
        // Snapshot completo del formulario (excepto el buffer del PDF)
        remitenteNombre: datos.remitenteNombre,
        remitenteDni: datos.remitenteDni,
        remitenteDomicilio: datos.remitenteDomicilio,
        remitenteLocalidad: datos.remitenteLocalidad,
        remitenteProvincia: datos.remitenteProvincia,
        remitenteTelefono: datos.remitenteTelefono,
        remitenteCp: datos.remitenteCp,
        destinatarioNombre: datos.destinatarioNombre,
        destinatarioCuit: datos.destinatarioCuit,
        destinatarioDomicilio: datos.destinatarioDomicilio,
        destinatarioLocalidad: datos.destinatarioLocalidad,
        destinatarioProvincia: datos.destinatarioProvincia,
        destinatarioActividad: datos.destinatarioActividad,
        destinatarioCp: datos.destinatarioCp,
        cuerpoTexto: datos.cuerpoTexto,
        fechaGeneracion: new Date().toISOString(),
      },
      pdfBuffer,
      descripcion: datos.descripcion,
    })

    if (!resultadoGuardado.success) {
      // El PDF se generó pero no se pudo guardar. Devolvemos el PDF con warning.
      console.error("[OCA] PDF generado pero falló el guardado:", resultadoGuardado.error)
      return {
        success: true,
        pdfBase64,
        warning: `PDF generado correctamente pero no se pudo guardar en el expediente: ${resultadoGuardado.error}`
      }
    }

    return { 
      success: true, 
      pdfBase64,
      plantillaOcaId: resultadoGuardado.plantillaOcaId,
    }

  } catch (error: any) {
    console.error('Error al generar el PDF del telegrama:', error)
    return { success: false, error: error.message || 'Error interno al procesar el PDF' }
  }
}

export async function obtenerDatosCasoParaTelegrama(casoId: string) {
  try {
    const user = await getUserSessionServer()
    if (!user?.id) return { success: false, error: "No autorizado" }

    const puedeAcceder = await usuarioPuedeAccederCaso(casoId, user.id, user.rol)
    if (!puedeAcceder) return { success: false, error: "No tenés permiso para acceder a este expediente" }

    const caso = await prisma.caso.findUnique({
      where: { id: casoId },
      include: { cliente: true, contraparte: true },
    })
    if (!caso) return { success: false, error: 'No se encontró el expediente en el sistema.' }

    return { success: true, caso }
  } catch (error: any) {
    console.error('Error crítico en base de datos:', error)
    return { success: false, error: `Error de base de datos: ${error.message || 'Error interno'}` }
  }
}