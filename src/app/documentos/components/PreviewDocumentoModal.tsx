'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, FileText, Lock, Calendar, User, HardDrive, Loader2 } from "lucide-react"
import { DocumentoListItem } from "@/lib/aplication/services/documento.types"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useEffect, useState } from "react"

interface Props {
  documento: DocumentoListItem
  onCerrar: () => void
}

const EXTENSIONES_PREVIEW = ['pdf', 'jpg', 'jpeg', 'png', 'webp']

export function PreviewDocumentoModal({ documento, onCerrar }: Props) {
  // const tienePreview = EXTENSIONES_PREVIEW.includes(documento.extension.toLowerCase())
  // const esImagen = ['jpg', 'jpeg', 'png', 'webp'].includes(documento.extension.toLowerCase())

  const ext        = documento.extension.toLowerCase()
const tienePreview = EXTENSIONES_PREVIEW.includes(ext)
const esImagen   = ['jpg', 'jpeg', 'png', 'webp'].includes(ext)
const esPdf      = ext === 'pdf'

// PDFs: los traemos como blob para evitar problemas con Content-Disposition: attachment
// del backend, que rompe el render inline en el iframe.
const [pdfBlobUrl,   setPdfBlobUrl]   = useState<string | null>(null)
const [pdfError,     setPdfError]     = useState<string | null>(null)
const [cargandoPdf,  setCargandoPdf]  = useState(false)

useEffect(() => {
  if (!esPdf) return

  let cancelado = false
  let blobUrlLocal: string | null = null

  setCargandoPdf(true)
  setPdfError(null)

  fetch(documento.url)
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      // Forzar Content-Type por si el backend devolvió octet-stream u otra cosa
      const pdfBlob = blob.type === 'application/pdf'
        ? blob
        : new Blob([blob], { type: 'application/pdf' })
      blobUrlLocal = URL.createObjectURL(pdfBlob)
      if (!cancelado) setPdfBlobUrl(blobUrlLocal)
    })
    .catch((err) => {
      if (!cancelado) setPdfError(err?.message ?? 'Error al cargar el PDF')
    })
    .finally(() => {
      if (!cancelado) setCargandoPdf(false)
    })

  return () => {
    cancelado = true
    if (blobUrlLocal) URL.revokeObjectURL(blobUrlLocal)
  }
}, [documento.url, esPdf])

  const handleDescargar = () => {
    const link = document.createElement('a')
    link.href = documento.url
    link.download = documento.nombreOriginal
    link.click()
  }

  return (
    <Dialog open onOpenChange={onCerrar}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base pr-8">
            <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <span className="truncate">{documento.nombre}</span>
            {documento.esInterno && (
              <Badge className="bg-slate-100 text-slate-600 text-xs gap-1 flex-shrink-0">
                <Lock className="h-2.5 w-2.5" />
                Interno
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Metadata */}
        <div className="flex flex-wrap gap-4 py-3 border-y border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            {format(documento.createdAt, "dd 'de' MMMM 'de' yyyy", { locale: es })}
          </div>
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-slate-400" />
            {documento.subidoPor}
          </div>
          <div className="flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5 text-slate-400" />
            {(documento.tamanio / (1024 * 1024)).toFixed(2)} MB
          </div>
        </div>

        {/* Preview o mensaje sin preview */}
        <div className="flex-1 min-h-0 overflow-hidden bg-slate-50 rounded-lg">
          {tienePreview ? (
            esImagen ? (
              <div className="w-full h-full overflow-auto">
              <img
                src={documento.url}
                alt={documento.nombre}
                className="max-w-full h-auto mx-auto block"
              />
              </div>
            ) : esPdf ? (
              cargandoPdf ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-12 text-center text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin mb-2" />
                  <p className="text-sm">Cargando vista previa…</p>
                </div>
              ) : pdfError ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-12 text-center">
                  <FileText className="h-16 w-16 text-slate-300 mb-4" />
                  <p className="text-slate-600 font-medium mb-1">
                    No se pudo cargar la vista previa
                  </p>
                  <p className="text-slate-400 text-sm">
                    {pdfError}. Probá descargar el archivo.
                  </p>
                </div>
              ) : pdfBlobUrl ? (
                <iframe
                  src={`${pdfBlobUrl}#toolbar=1`}
                  className="w-full h-full rounded-lg"
                  title={documento.nombre}
                />
              ) : null
            ) : null
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-12 text-center">
              <FileText className="h-16 w-16 text-slate-300 mb-4" />
              <p className="text-slate-600 font-medium mb-1">Vista previa no disponible</p>
              <p className="text-slate-400 text-sm">
                Este tipo de archivo no se puede previsualizar directamente. Descargalo para abrirlo.
              </p>
            </div>
          )}
        </div>

        {/* Descripción */}
        {documento.descripcion && (
          <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
            {documento.descripcion}
          </p>
        )}

        {/* Acciones */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
          <Button
            onClick={handleDescargar}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Download className="h-4 w-4" />
            Descargar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}