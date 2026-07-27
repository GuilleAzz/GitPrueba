'use client'

import { useEffect, useState } from 'react'
import { FileText, ArrowLeft, Printer, Loader2, AlertCircle, Landmark, Info, Save, CheckCircle2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "src/components/ui/alert"
import { obtenerDatosCasoParaTelegrama, generarTelegramaPdfAction, DatosTelegrama } from './telegramaAction'
import { LIMITES_CUERPO, contarPalabras } from './limites-telegrama'
import { validarCuit } from "src/lib/utils/cuit"

interface TelegramaFormularioProps {
  casoId: string
  tipoTelegrama: 'renuncia' | 'hasta-30' | 'mas-30' | 'arca'
  onVolver: () => void
}

// Filtros de input
const soloNumeros = (v: string) => v.replace(/\D/g, '')
const soloLetras = (v: string) => v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '')

// ═══════════════════════════════════════════════════════════════════════════
// Extrae el DNI a partir de lo que venga del expediente.
//   • Si son 11 dígitos y el prefijo es de persona física (20/23/24/27),
//     el DNI son los 8 dígitos del medio del CUIT.
//   • Si son 11 dígitos pero es CUIT de empresa (30/33/34...), NO hay DNI →
//     devuelve '' (se completa a mano) y marca que hubo un CUIT de empresa.
//   • Si ya parece un DNI (7-8 dígitos), lo devuelve tal cual.
// Devuelve { dni, huboCuit } para poder avisar al usuario.
// ═══════════════════════════════════════════════════════════════════════════
function extraerDniDesdeExpediente(valor: string): { dni: string; huboCuit: boolean } {
  const d = (valor || '').replace(/\D/g, '')
  if (d.length === 11) {
    const prefijo = d.slice(0, 2)
    const esPersonaFisica = ['20', '23', '24', '27'].includes(prefijo)
    if (esPersonaFisica) {
      return { dni: d.slice(2, 10), huboCuit: true }  // 8 del medio
    }
    return { dni: '', huboCuit: true }  // CUIT de empresa: sin DNI
  }
  // Ya es un DNI (o algo corto): tal cual
  return { dni: d, huboCuit: false }
}

export function TelegramaFormulario({ casoId, tipoTelegrama, onVolver }: TelegramaFormularioProps) {
  const [loading, setLoading] = useState(true)
  const [procesandoPdf, setProcesandoPdf] = useState(false)
  const [error, setError] = useState('')
  // Avisa si el DNI del remitente se derivó de un CUIT (hay que chequear).
  const [dniDerivadoDeCuit, setDniDerivadoDeCuit] = useState(false)
  // [OCA] Feedback cuando la plantilla se guarda en el expediente
  const [mensajeExito, setMensajeExito] = useState('')
  // [OCA] Guardamos el PDF generado para poder imprimirlo después con un click real del usuario
  const [pdfGenerado, setPdfGenerado] = useState<string | null>(null)

  const esArca = tipoTelegrama === 'arca'

  const [formData, setFormData] = useState<DatosTelegrama>({
    casoId,
    tipoTelegrama,
    remitenteNombre: '',
    remitenteDni: '',
    remitenteDomicilio: '',
    remitenteLocalidad: '',
    remitenteProvincia: '',
    remitenteTelefono: '',
    destinatarioNombre: '',
    destinatarioCuit: '',
    destinatarioDomicilio: '',
    destinatarioLocalidad: '',
    destinatarioProvincia: '',
    destinatarioActividad: '',
    cuerpoTexto: ''
  })

  const limite = LIMITES_CUERPO[tipoTelegrama] ?? { unidad: 'caracteres' as const, max: 350 }
  const cantidadActual = limite.unidad === 'palabras'
    ? contarPalabras(formData.cuerpoTexto)
    : formData.cuerpoTexto.length
  const seePasa = cantidadActual > limite.max
  const unidadLabel = limite.unidad === 'palabras' ? 'palabras' : 'caracteres'

  useEffect(() => {
    async function cargarDatos() {
      try {
        const res = await obtenerDatosCasoParaTelegrama(casoId)
        if (!res.success || !res.caso) {
          setError(res.error || 'Error al recuperar datos.')
          return
        }

        const c = res.caso

        // El remitente pide DNI; del cliente puede venir un CUIT → extraemos.
        const { dni, huboCuit } = extraerDniDesdeExpediente(c.cliente.numeroDocumento || '')
        setDniDerivadoDeCuit(huboCuit)

        setFormData(prev => ({
          ...prev,
          remitenteNombre: `${c.cliente.nombre} ${c.cliente.apellido || ''}`.trim(),
          remitenteDni: dni,
          remitenteDomicilio: c.cliente.direccion || '',
          remitenteTelefono: (c.cliente.telefono || '').replace(/\D/g, ''),
          destinatarioNombre: esArca ? '' : (c.contraparte?.nombre || ''),
          destinatarioCuit: esArca ? '' : (c.contraparte?.documento || '').replace(/\D/g, ''),
          destinatarioDomicilio: esArca ? '' : (c.contraparte?.domicilio || ''),
          destinatarioLocalidad: esArca ? '' : (c.contraparte?.localidad || ''),
          destinatarioProvincia: esArca ? '' : (c.contraparte?.provincia || ''),
          destinatarioActividad: esArca ? '' : (c.contraparte?.rol || ''),
          cuerpoTexto: tipoTelegrama === 'renuncia'
            ? 'RENUNCIO A MI EMPLEO DESDE EL DIA... EN EL PUESTO DE... QUEDANDO USTED DEBIDAMENTE NOTIFICADO.'
            : tipoTelegrama === 'arca'
            ? 'COMUNICACIÓN ARCA (ART. 11) - INTIMACIÓN A ORGANISMO DE RECAUDACIÓN'
            : 'ANTE NEGATIVA DE TAREAS E INCUMPLIMIENTO DE REGISTRACIÓN...'
        }))
      } catch (err) {
        setError('Ocurrió un error inesperado al conectar el servidor.')
      } finally {
        setLoading(false)
      }
    }
    cargarDatos()
  }, [casoId, tipoTelegrama, esArca])

  // [OCA] Validación client-side del CUIT del destinatario (Opción B: bloquear si inválido)
  // ARCA no requiere destinatario, entonces siempre pasa la validación.
  const cuitDestRequerido = !esArca
  const cuitDestValido = esArca
    ? true
    : (formData.destinatarioCuit ? validarCuit(formData.destinatarioCuit) : false)
  
  const motivoBloqueoCuit = cuitDestRequerido && !cuitDestValido
    ? (!formData.destinatarioCuit || formData.destinatarioCuit.length === 0
      ? "Falta el CUIT del destinatario"
      : "El CUIT del destinatario no es válido (verificá el dígito verificador)")
    : null

const handleGuardarEnExpediente = async (e: React.FormEvent) => {
    e.preventDefault()
    setProcesandoPdf(true)
    setError('')
    setMensajeExito('')
    setPdfGenerado(null)

    try {
      const res = await generarTelegramaPdfAction(formData)
      if (!res.success || !res.pdfBase64) {
        setError(res.error || 'No se pudo estampar el PDF.')
        return
      }

      setPdfGenerado(res.pdfBase64)

      if ((res as any).warning) {
        setMensajeExito(`El PDF se generó pero NO se pudo guardar en el expediente. Imprimilo ahora para no perderlo. ${(res as any).warning}`)
      } else {
        setMensajeExito('La plantilla quedó guardada en el expediente, en el tab Documentación.')
      }
    } catch (err) {
      setError('Error al compilar el documento final.')
    } finally {
      setProcesandoPdf(false)
    }
  }

  // Abre el PDF en pestaña nueva. Se dispara con un click directo del usuario,
  // así el navegador no lo bloquea como popup.
  const abrirParaImprimir = () => {
    if (!pdfGenerado) return
    const bytes = Uint8Array.from(atob(pdfGenerado), c => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const ventana = window.open(url)
    if (ventana) ventana.focus()
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <p className="text-sm font-medium">Pre-cargando expediente desde la base de datos...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleGuardarEnExpediente} className="max-w-4xl mx-auto bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">

      <div className="flex items-center justify-between border-b pb-4">
        <Button type="button" variant="ghost" size="sm" onClick={onVolver} className="gap-1 text-slate-500">
          <ArrowLeft className="h-4 w-4" /> Volver al buscador
        </Button>
        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 text-xs font-semibold">
          <FileText className="h-3.5 w-3.5" /> Modelo Oficial Correo Argentino
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error operativo</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {mensajeExito && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Plantilla guardada</AlertTitle>
          <AlertDescription className="text-green-700">
            <p>{mensajeExito}</p>
            {pdfGenerado && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={abrirParaImprimir}
                className="mt-3 gap-2 bg-white"
              >
                <Printer className="h-4 w-4" /> Abrir para imprimir
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* [OCA] Warning si el CUIT del destinatario no es válido */}
      {motivoBloqueoCuit && !esArca && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>CUIT del destinatario inválido</AlertTitle>
          <AlertDescription>
            {motivoBloqueoCuit}. No se puede generar el telegrama hasta que el CUIT sea válido.
          </AlertDescription>
        </Alert>
      )}

      {/* Advertencia general sobre tipo de dato (DNI vs CUIT) */}
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
        <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <span className="font-semibold">Verificá los datos antes de guardar.</span> El sistema precarga la
          información del expediente, pero el telegrama puede pedir un tipo de dato distinto al cargado
          (por ejemplo, pide <strong>DNI</strong> y en el expediente cargaste un <strong>CUIT</strong>).
          Revisá que cada campo tenga el dato correcto.
        </p>
      </div>

      <div className={esArca ? "grid grid-cols-1 gap-6" : "grid grid-cols-1 md:grid-cols-2 gap-6"}>

        {/* Remitente */}
        <div className="space-y-4 bg-slate-50/50 p-4 rounded-lg border border-slate-100">
          <h4 className="font-semibold text-slate-900 text-sm border-b pb-1 text-blue-600">REMITENTE (Trabajador)</h4>
          <div className="space-y-2">
            <Label className="text-xs">Apellido y Nombre</Label>
            <Input
              value={formData.remitenteNombre}
              onChange={e => setFormData({...formData, remitenteNombre: soloLetras(e.target.value)})}
              required className="h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label className="text-xs">DNI N°</Label>
              <Input
                value={formData.remitenteDni}
                onChange={e => { setFormData({...formData, remitenteDni: soloNumeros(e.target.value)}); setDniDerivadoDeCuit(false) }}
                inputMode="numeric" maxLength={8}
                required className="h-8 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Teléfono</Label>
              <Input
                value={formData.remitenteTelefono}
                onChange={e => setFormData({...formData, remitenteTelefono: soloNumeros(e.target.value)})}
                inputMode="numeric" maxLength={13}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Aviso específico: el DNI se derivó de un CUIT */}
          {dniDerivadoDeCuit && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              El DNI se obtuvo a partir del CUIT cargado en el expediente. Verificá que sea correcto;
              si el expediente tenía un CUIT de empresa, completá el DNI a mano.
            </p>
          )}

          <div className="space-y-2">
            <Label className="text-xs">Domicilio Real</Label>
            <Input value={formData.remitenteDomicilio} onChange={e => setFormData({...formData, remitenteDomicilio: e.target.value})} required className="h-8 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label className="text-xs">Localidad</Label>
              <Input value={formData.remitenteLocalidad} onChange={e => setFormData({...formData, remitenteLocalidad: e.target.value})} required className="h-8 text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Provincia</Label>
              <Input value={formData.remitenteProvincia} onChange={e => setFormData({...formData, remitenteProvincia: e.target.value})} required className="h-8 text-sm" />
            </div>
          </div>
        </div>

        {/* Destinatario — solo si NO es ARCA */}
        {!esArca && (
          <div className="space-y-4 bg-slate-50/50 p-4 rounded-lg border border-slate-100">
            <h4 className="font-semibold text-slate-900 text-sm border-b pb-1 text-purple-600">DESTINATARIO (Empleador)</h4>
            <div className="space-y-2">
              <Label className="text-xs">Razón Social / Nombre</Label>
              <Input value={formData.destinatarioNombre} onChange={e => setFormData({...formData, destinatarioNombre: e.target.value})} required className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-xs">CUIT N° <span className="text-slate-400">(sin guiones)</span></Label>
                <Input
                  value={formData.destinatarioCuit}
                  onChange={e => setFormData({...formData, destinatarioCuit: soloNumeros(e.target.value)})}
                  inputMode="numeric" maxLength={11}
                  placeholder="30700033333"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Actividad Principal</Label>
                <Input value={formData.destinatarioActividad} onChange={e => setFormData({...formData, destinatarioActividad: e.target.value})} className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Domicilio Laboral</Label>
              <Input value={formData.destinatarioDomicilio} onChange={e => setFormData({...formData, destinatarioDomicilio: e.target.value})} required className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-xs">Localidad</Label>
                <Input value={formData.destinatarioLocalidad} onChange={e => setFormData({...formData, destinatarioLocalidad: e.target.value})} required className="h-8 text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Provincia</Label>
                <Input value={formData.destinatarioProvincia} onChange={e => setFormData({...formData, destinatarioProvincia: e.target.value})} required className="h-8 text-sm" />
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Cartel del destinatario fijo en ARCA */}
      {esArca && (
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <Landmark className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-xs text-emerald-800 leading-relaxed">
            <span className="font-semibold">Destinatario fijo:</span> en este formulario el destinatario es la Agencia
            de Recaudación y Control Aduanero (ARCA), que ya viene preimpresa en el modelo oficial. No es necesario
            completar datos del destinatario.
          </p>
        </div>
      )}

      {/* Cuerpo del Mensaje */}
      <div className="space-y-2 pt-2 border-t">
        <Label className="text-sm font-semibold text-slate-700">Texto de la comunicación</Label>
        <Textarea
          value={formData.cuerpoTexto}
          onChange={e => setFormData({...formData, cuerpoTexto: e.target.value})}
          required
          rows={limite.unidad === 'palabras' ? 4 : 8}
          className="font-mono text-sm uppercase bg-amber-50/20 border-amber-200"
          placeholder="Escribí acá el cuerpo de la intimación..."
        />

        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <p>
              {tipoTelegrama === 'renuncia'
                ? 'El texto se reparte en los 3 renglones oficiales del formulario.'
                : limite.unidad === 'palabras'
                ? 'Formulario oficial de hasta 30 palabras.'
                : 'El texto se acomoda en el recuadro del formulario.'}
            </p>
            <span className={seePasa ? "text-red-600 font-semibold" : "text-slate-500"}>
              {cantidadActual} / {limite.max} {unidadLabel}
              {limite.unidad === 'palabras' && (
                <span className="text-slate-400 font-normal ml-1.5">
                  · {formData.cuerpoTexto.length} caracteres
                </span>
              )}
            </span>
          </div>

          {seePasa && (
            <p className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md p-2 mt-1">
              {limite.unidad === 'palabras'
                ? `Este formulario admite hasta ${limite.max} palabras. Recortá ${cantidadActual - limite.max} palabra(s).`
                : `El texto supera el espacio del formulario. Recortá unos ${cantidadActual - limite.max} caracteres.`}
            </p>
          )}
        </div>

        <p className="text-xs text-slate-400 pt-1">Nota: El texto se estampará en mayúsculas de manera exacta en el cuerpo del formulario.</p>
      </div>

      <Button
        type="submit"
        disabled={procesandoPdf || seePasa || !!motivoBloqueoCuit}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 text-base font-medium shadow-md gap-2 disabled:opacity-50"
      >
        {procesandoPdf ? (
          <><Loader2 className="h-5 w-5 animate-spin" /> Generando y guardando...</>
        ) : (
          <><Save className="h-5 w-5" /> Guardar en el expediente</>
        )}
      </Button>

    </form>
  )
}