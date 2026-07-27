'use client'

import { actualizarCasoAction } from "../../actions" 
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowLeft, Save, Star, AlertCircle, Scale, User, Lock, AlertTriangle, MapPin, Ban, TrendingDown, TrendingUp } from 'lucide-react'
import Link from "next/link"
import { useFormState, useFormStatus } from "react-dom"
import { useState, useEffect, FormEvent } from "react"
import { 
  getProvinciasParaSelect, 
  getDepartamentosParaSelect 
} from "src/lib/data/argentina-ubicaciones"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { useConfirmacion } from "src/components/confirmacion/ConfirmacionProvider"

// [MAQ.EST] Importar la máquina de estados
import {
  ESTADOS_EXPEDIENTE,
  getSiguientesEstadosPermitidos,
  getTipoTransicion,
} from "src/lib/domain/expediente-estados"

// ========== TIPOS DE CASO ACTUALIZADOS ==========
const TIPOS_CASO = [
  { value: "LABORAL", label: "Laboral" },
  { value: "CIVIL_COMERCIAL", label: "Civil y Comercial" },
  { value: "FAMILIA", label: "Familia" },
  { value: "PENAL", label: "Penal" },
  { value: "SUCESIONES", label: "Sucesiones" },
  { value: "CONTENCIOSO_ADMINISTRATIVO", label: "Contencioso Administrativo" },
  { value: "OTRO", label: "Otro" }
]

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="bg-blue-600 hover:bg-blue-700 text-white">
      <Save className="h-4 w-4 mr-2" />
      {pending ? "Guardando..." : "Guardar Cambios"}
    </Button>
  )
}

function extraerProvinciaYDepartamento(fuero: string | null): { provincia: string; departamento: string } {
  if (!fuero) return { provincia: '', departamento: '' }
  const partes = fuero.split(',').map(p => p.trim())
  if (partes.length >= 2) {
    return { departamento: partes[0], provincia: partes[1] }
  }
  return { provincia: '', departamento: partes[0] || '' }
}

export function EditarCasoForm({ caso, clientes }: { caso: any, clientes: any[] }) {
  const initialState = { message: null, error: null }
  // @ts-ignore
  const [state, dispatch] = useFormState(actualizarCasoAction, initialState)

  const [etapaActual, setEtapaActual] = useState(caso.estado)
  const etapaOriginal = caso.estado
  const casoCerrado = caso.estaCerrado === true

  // ========== ESTADOS PARA UBICACIÓN GEOGRÁFICA ==========
  const { provincia: provInicial, departamento: deptoInicial } = extraerProvinciaYDepartamento(caso.fuero)
  const [provinciaSeleccionada, setProvinciaSeleccionada] = useState(provInicial)
  const [departamentoSeleccionado, setDepartamentoSeleccionado] = useState(deptoInicial)
  const [departamentosDisponibles, setDepartamentosDisponibles] = useState<{value: string; label: string}[]>([])

  // Estados para modales de justificación
  const [modalJuzgado, setModalJuzgado] = useState(false)
  const [modalUbicacion, setModalUbicacion] = useState(false)
  const [modalMonto, setModalMonto] = useState(false)

  // [MAQ.EST] Modal + motivo para RETROCESO de estado procesal
  const [modalRetroceso, setModalRetroceso] = useState(false)
  const [estadoPendienteRetroceso, setEstadoPendienteRetroceso] = useState<string>('')
  const [motivoRetroceso, setMotivoRetroceso] = useState('')
  const [errorRetroceso, setErrorRetroceso] = useState('')
  const [motivoEstadoConfirmado, setMotivoEstadoConfirmado] = useState('')

  // [HIST-MONTO] Estados para el cambio de monto
  const [montoOriginal] = useState<string>(caso.montoDisputa?.toString() || '')
  const [nuevaMonto, setNuevaMonto] = useState(caso.montoDisputa || '')
  const [motivoMonto, setMotivoMonto] = useState('')
  const [montoConfirmado, setMontoConfirmado] = useState(caso.montoDisputa || '')
  const [errorMonto, setErrorMonto] = useState('')

  // Valores pendientes (lo que el usuario quiere cambiar)
  const [nuevoJuzgado, setNuevoJuzgado] = useState(caso.juzgado || '')
  const [motivoJuzgado, setMotivoJuzgado] = useState('')
  const [motivoUbicacion, setMotivoUbicacion] = useState('')

  // Valores confirmados (lo que se enviará al form)
  const [juzgadoConfirmado, setJuzgadoConfirmado] = useState(caso.juzgado || '')
  const [ubicacionConfirmada, setUbicacionConfirmada] = useState({
    provincia: provInicial,
    ciudad: deptoInicial,
    fuero: caso.fuero || ''
  })
  
  const { confirm: confirmar } = useConfirmacion()
  const [yaConfirmoCambioEtapa, setYaConfirmoCambioEtapa] = useState(false)

  const [errorJuzgado, setErrorJuzgado] = useState('')
  const [errorUbicacion, setErrorUbicacion] = useState('')

  // [MAQ.EST] Lista de estados posibles como destino desde el estado actual
  const opcionesEstado = getSiguientesEstadosPermitidos(etapaOriginal)
  const tipoTransicionActual = getTipoTransicion(etapaOriginal, etapaActual)

  const provincias: { value: string; label: string }[] = getProvinciasParaSelect()

  useEffect(() => {
    if (provinciaSeleccionada) {
      const deptos = getDepartamentosParaSelect(provinciaSeleccionada)
      setDepartamentosDisponibles(deptos)
      
      if (departamentoSeleccionado && !deptos.find(d => d.value === departamentoSeleccionado)) {
        if (deptoInicial && provinciaSeleccionada === provInicial) {
          // No limpiar, mantener el valor original
        } else {
          setDepartamentoSeleccionado('')
        }
      }
    } else {
      setDepartamentosDisponibles([])
    }
  }, [provinciaSeleccionada])

  const formatDateForInput = (dateString: string | null) => {
    if (!dateString) return ""
    try {
      return new Date(dateString).toISOString().split('T')[0]
    } catch {
      return ""
    }
  }

  const [requisitos, setRequisitos] = useState<{ description: string; dueDate: string; isCompleted?: boolean }[]>(
    caso.requirements ? caso.requirements.map((r: any) => ({
        description: r.description,
        dueDate: formatDateForInput(r.dueDate),
        isCompleted: r.isCompleted
    })) : []
  )

  const handleSelectEstado = (nuevoEstado: string) => {
    const tipo = getTipoTransicion(etapaOriginal, nuevoEstado)
    if (tipo === 'retroceso') {
      setEstadoPendienteRetroceso(nuevoEstado)
      setMotivoRetroceso('')
      setErrorRetroceso('')
      setModalRetroceso(true)
    } else {
      setEtapaActual(nuevoEstado)
      setMotivoEstadoConfirmado('')
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    if (etapaActual === etapaOriginal) return
    if (yaConfirmoCambioEtapa) return

    e.preventDefault()
    const formEl = e.currentTarget
    const esRetroceso = tipoTransicionActual === 'retroceso'
    
    const ok = await confirmar({
      titulo: esRetroceso ? 'Retroceso procesal excepcional' : 'Cambio de etapa procesal',
      descripcion: esRetroceso
        ? `Estás RETROCEDIENDO el expediente de "${etapaOriginal}" a "${etapaActual}".\n\nMotivo registrado: ${motivoEstadoConfirmado}\n\nEste retroceso queda marcado como EXCEPCIONAL en la bitácora del expediente.`
        : `Estás moviendo el expediente de "${etapaOriginal}" a "${etapaActual}".\n\nEste cambio queda registrado en la bitácora del expediente y puede impactar en los reportes de seguimiento. ¿Confirmás que el expediente avanzó de fase?`,
      textoConfirmar: esRetroceso ? 'Sí, retroceder etapa' : 'Sí, avanzar etapa',
      textoCancelar: 'Cancelar',
      variante: 'warning',
    })

    if (ok) {
      setYaConfirmoCambioEtapa(true)
      formEl.requestSubmit()
    }
  }

  const getTipoLabel = (tipoValue: string) => {
    if (tipoValue === 'CIVIL' || tipoValue === 'COMERCIAL') {
      return 'Civil y Comercial (Legacy)'
    }
    const tipo = TIPOS_CASO.find(t => t.value === tipoValue)
    return tipo?.label || tipoValue
  }

  if (casoCerrado) {
    return (
      <Card className="shadow-md border-red-200 max-w-5xl mx-auto">
        <CardHeader className="bg-red-50">
          <div className="flex items-center gap-3">
            <Ban className="h-8 w-8 text-red-600" />
            <div className="flex-1">
              <CardTitle className="text-red-800">Expediente Cerrado</CardTitle>
              <CardDescription className="text-red-600">
                Este expediente ha sido cerrado y no puede editarse
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">
                <strong>Motivo de cierre:</strong> {caso.motivoCierre || 'No especificado'}
              </p>
              {caso.fechaCierre && (
                <p className="text-red-700 text-sm mt-2">
                  Cerrado el: {new Date(caso.fechaCierre).toLocaleDateString('es-AR')}
                </p>
              )}
              {caso.observacionCierre && (
                <p className="text-red-700 text-sm mt-2">
                  <strong>Observaciones:</strong> {caso.observacionCierre}
                </p>
              )}
            </div>
            
            <p className="text-sm text-slate-600">
              Si necesita reabrir este expediente, contacte al Administrador del sistema.
            </p>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link href={`/casos/${caso.id}`}>
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver al expediente
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-md border-slate-200 max-w-5xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Scale className="h-8 w-8 text-blue-600" />
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                Editar Caso: {caso.numero}
                {caso.isFavorite && <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />}
              </CardTitle>
              <CardDescription>Modifique los datos, prioridades o requisitos del expediente</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          
          {state?.error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded">
                <p className="font-bold">Error</p>
                <p>{state.error}</p>
            </div>
          )}

          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
            <strong>💡 Tip:</strong> Para cerrar o archivar este expediente, use el botón 
            <span className="font-semibold"> "Cerrar Expediente"</span> en la vista del expediente. 
            El cierre requiere información adicional (motivo, monto final, etc.) para los reportes.
          </div>

          <form action={dispatch} onSubmit={handleSubmit} className="space-y-8">
            
            <input type="hidden" name="id" value={caso.id} />
            <input type="hidden" name="motivo_estado" value={motivoEstadoConfirmado} />

            {/* SECCIÓN 1: IDENTIFICACIÓN */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">1</div>
                <h2 className="text-lg font-semibold text-slate-800">Identificación del Expediente</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="numero" className="flex items-center gap-2">
                    Nº Expediente <Lock className="w-3 h-3 text-slate-400"/>
                  </Label>
                  <Input 
                    id="numero" 
                    defaultValue={caso.numero} 
                    disabled 
                    className="bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed"
                  />
                  <input type="hidden" name="numero" value={caso.numero} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo" className="flex items-center gap-2">
                    Materia / Tipo <Lock className="w-3 h-3 text-slate-400"/>
                  </Label>
                  <Input 
                    id="tipo-display" 
                    value={getTipoLabel(caso.tipo)} 
                    disabled 
                    className="bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed"
                  />
                  <input type="hidden" name="tipo" value={caso.tipo} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estado" className="font-bold text-blue-700">Etapa Procesal (Modificable)</Label>
                  <Select name="estado" value={etapaActual} onValueChange={handleSelectEstado}>
                    <SelectTrigger className="bg-white border-blue-300 ring-offset-0 focus:ring-2 focus:ring-blue-500">
                        <SelectValue placeholder="Estado actual" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={etapaOriginal}>
                        {etapaOriginal} (actual)
                      </SelectItem>
                      {opcionesEstado.filter(op => op.tipo === 'avance').map(op => (
                        <SelectItem key={op.estado} value={op.estado}>
                          <span className="flex items-center gap-2">
                            <TrendingUp className="h-3 w-3 text-green-600" />
                            {op.estado}
                          </span>
                        </SelectItem>
                      ))}
                      {opcionesEstado.filter(op => op.tipo === 'retroceso').map(op => (
                        <SelectItem key={op.estado} value={op.estado}>
                          <span className="flex items-center gap-2">
                            <TrendingDown className="h-3 w-3 text-amber-600" />
                            {op.estado} <span className="text-xs text-amber-700">(retroceso)</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    Los avances son directos. Los retrocesos requieren motivo justificado.
                  </p>
                </div>
              </div>

              {etapaActual !== etapaOriginal && tipoTransicionActual === 'avance' && (
                <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-800 text-sm animate-in fade-in slide-in-from-top-1">
                    <TrendingUp className="w-5 h-5 shrink-0 text-blue-600" />
                    <div>
                        <span className="font-bold block">Avance procesal</span>
                        Moviendo el expediente de <strong>{etapaOriginal}</strong> a <strong>{etapaActual}</strong>. 
                        Se solicitará confirmación al guardar.
                    </div>
                </div>
              )}

              {etapaActual !== etapaOriginal && tipoTransicionActual === 'retroceso' && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-300 rounded-md text-amber-900 text-sm animate-in fade-in slide-in-from-top-1">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-amber-700" />
                    <div>
                        <span className="font-bold block">Retroceso procesal excepcional</span>
                        Retrocediendo el expediente de <strong>{etapaOriginal}</strong> a <strong>{etapaActual}</strong>.
                        {motivoEstadoConfirmado && (
                          <div className="mt-1">
                            <strong>Motivo registrado:</strong> {motivoEstadoConfirmado}
                          </div>
                        )}
                    </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="titulo">Carátula / Título del Expediente</Label>
                <Input id="titulo" name="titulo" defaultValue={caso.titulo} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea id="descripcion" name="descripcion" defaultValue={caso.descripcion} rows={4} />
              </div>
            </div>

            {/* SECCIÓN 2: CLIENTE */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-sm">2</div>
                <h2 className="text-lg font-semibold text-slate-800">Cliente (Vinculado)</h2>
              </div>

              <div className="grid grid-cols-1 gap-4 p-4 bg-slate-50 rounded-lg">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Cliente Asignado <Lock className="w-3 h-3 text-slate-400"/>
                  </Label>
                  
                  <Select defaultValue={caso.clienteId} disabled>
                    <SelectTrigger className="bg-slate-100 text-slate-500 border-slate-200">
                        <SelectValue placeholder="Seleccionar cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((cliente) => (
                          <SelectItem key={cliente.id} value={cliente.id}>
                              {cliente.nombre} {cliente.apellido}
                          </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <input type="hidden" name="clienteId" value={caso.clienteId} />
                  <p className="text-xs text-slate-500 mt-1">
                    * El cliente no puede modificarse una vez creado el expediente.
                  </p>
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: RADICACIÓN Y DATOS FINANCIEROS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
  
              <div className="space-y-2 md:col-span-2">
                <Label className="flex items-center gap-2">
                  Juzgado / Secretaría <Lock className="w-3 h-3 text-slate-400" />
                </Label>
                <div className="flex gap-2">
                  <Input 
                    value={juzgadoConfirmado || 'Sin especificar'}
                    disabled
                    className="bg-slate-100 text-slate-500 border-slate-200 flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setModalJuzgado(true)}
                    className="shrink-0"
                  >
                    Modificar
                  </Button>
                </div>
                <input type="hidden" name="juzgado" value={juzgadoConfirmado} />
                <input type="hidden" name="motivo_juzgado" value={motivoJuzgado} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Ubicación Geográfica <Lock className="w-3 h-3 text-slate-400" />
                </Label>
                <div className="flex gap-2">
                  <Input 
                    value={ubicacionConfirmada.fuero || 'Sin especificar'}
                    disabled
                    className="bg-slate-100 text-slate-500 border-slate-200 flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setModalUbicacion(true)}
                    className="shrink-0"
                  >
                    Modificar
                  </Button>
                </div>
                <input type="hidden" name="fuero" value={ubicacionConfirmada.fuero} />
                <input type="hidden" name="provincia" value={ubicacionConfirmada.provincia} />
                <input type="hidden" name="ciudad" value={ubicacionConfirmada.ciudad} />
                <input type="hidden" name="motivo_ubicacion" value={motivoUbicacion} />
              </div>

              {/* MONTO — CORREGIDO EL INPUT HIDDEN PARA QUE LLEGUE AL BACKEND */}
              <div className="space-y-2 md:col-span-2">
                <Label className="flex items-center gap-2">
                  Monto en Disputa ($) <Lock className="w-3 h-3 text-slate-400" />
                </Label>
                <div className="flex gap-2">
                  <Input 
                    value={montoConfirmado ? `$ ${Number(montoConfirmado).toLocaleString('es-AR')}` : 'Sin especificar'}
                    disabled
                    className="bg-slate-100 text-slate-500 border-slate-200 flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setModalMonto(true)}
                    className="shrink-0"
                  >
                    Modificar
                  </Button>
                </div>
                {/* ⚠️ ESTO ERA LO QUE ESTABA MAL ("monto_disputa"), AHORA DICE "montoDisputa" */}
                <input type="hidden" name="montoDisputa" value={montoConfirmado} />
                <input type="hidden" name="motivo_monto" value={motivoMonto} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Ubicación Física del Expediente</Label>
                <Input 
                  name="ubicacionFisica" 
                  placeholder="Ej: Bibliorato A - Estante 2"
                  defaultValue={caso.ubicacionFisica || ""}
                />
              </div>
            </div>

            {/* SECCIÓN 4: PRIORIDAD */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">4</div>
                <h2 className="text-lg font-semibold text-slate-800">Prioridad y Seguimiento</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                  <Label htmlFor="priority" className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" /> Prioridad
                  </Label>
                  <Select name="priority" defaultValue={caso.priority || "NORMAL"}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Nivel de prioridad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HIGH">Alta (Urgente)</SelectItem>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="LOW">Baja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    name="isFavorite" 
                    id="isFavorite" 
                    defaultChecked={caso.isFavorite}
                    className="w-5 h-5 accent-yellow-500 cursor-pointer" 
                  />
                  <Label htmlFor="isFavorite" className="flex items-center gap-2 cursor-pointer">
                    <Star className="h-5 w-5 text-yellow-500" />
                    <div>
                      <p className="font-medium">Marcar como Favorito</p>
                      <p className="text-xs text-slate-600">Destacado en dashboard</p>
                    </div>
                  </Label>
                </div>
              </div>
            </div>

            <input type="hidden" name="requirements" value={JSON.stringify(requisitos)} />

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Link href={`/casos/${caso.id}`}>
            <Button variant="outline" type="button">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Cancelar
            </Button>
          </Link>
          <SubmitButton />
        </div>

      </form>

      {/* MODAL RETROCESO PROCESAL */}
      <Dialog open={modalRetroceso} onOpenChange={setModalRetroceso}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Retroceso Procesal Excepcional
            </DialogTitle>
            <DialogDescription>
              Estás intentando retroceder el expediente de <strong>{etapaOriginal}</strong> a <strong>{estadoPendienteRetroceso}</strong>.
              Requieren motivo justificado y quedan registrados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Motivo del retroceso <span className="text-red-500">*</span></Label>
              <Textarea
                value={motivoRetroceso}
                onChange={(e) => setMotivoRetroceso(e.target.value)}
                placeholder="Ej: Se decretó nulidad de la prueba pericial..."
                rows={4}
              />
              {errorRetroceso && (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {errorRetroceso}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalRetroceso(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (motivoRetroceso.trim().length < 10) {
                  setErrorRetroceso('El motivo debe tener al menos 10 caracteres')
                  return
                }
                setErrorRetroceso('')
                setEtapaActual(estadoPendienteRetroceso)
                setMotivoEstadoConfirmado(motivoRetroceso.trim())
                setModalRetroceso(false)
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Confirmar retroceso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL JUZGADO */}
      <Dialog open={modalJuzgado} onOpenChange={setModalJuzgado}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modificar Juzgado</DialogTitle>
            <DialogDescription>Este cambio quedará registrado en la bitácora del expediente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nuevo Juzgado / Secretaría</Label>
              <Input 
                value={nuevoJuzgado}
                onChange={(e) => setNuevoJuzgado(e.target.value)}
                placeholder="Ej: Juzgado Nº 45 Civ. y Com."
              />
            </div>
            <div className="space-y-2">
              <Label>Motivo del cambio <span className="text-red-500">*</span></Label>
              <Textarea
                value={motivoJuzgado}
                onChange={(e) => setMotivoJuzgado(e.target.value)}
                placeholder="Ej: Excusación del juez, cambio de sede..."
                rows={3}
              />
              {errorJuzgado && (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {errorJuzgado}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalJuzgado(false)}>Cancelar</Button>
            <Button 
              onClick={() => {
                if (!motivoJuzgado.trim()) {
                  setErrorJuzgado('El motivo es obligatorio')
                  return
                }
                setErrorJuzgado('')
                setJuzgadoConfirmado(nuevoJuzgado)
                setModalJuzgado(false)
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Confirmar cambio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL UBICACIÓN */}
      <Dialog open={modalUbicacion} onOpenChange={setModalUbicacion}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modificar Ubicación Geográfica</DialogTitle>
            <DialogDescription>Este cambio quedará registrado en la bitácora del expediente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Provincia</Label>
              <Select 
                value={provinciaSeleccionada}
                onValueChange={(v) => {
                  setProvinciaSeleccionada(v)
                  setDepartamentoSeleccionado('')
                }}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar provincia..." /></SelectTrigger>
                <SelectContent>
                  {provincias.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ciudad / Departamento</Label>
              <Select
                value={departamentoSeleccionado}
                onValueChange={setDepartamentoSeleccionado}
                disabled={!provinciaSeleccionada}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar ciudad..." /></SelectTrigger>
                <SelectContent>
                  {departamentosDisponibles.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Motivo del cambio <span className="text-red-500">*</span></Label>
              <Textarea
                value={motivoUbicacion}
                onChange={(e) => setMotivoUbicacion(e.target.value)}
                placeholder="Ej: Inhibición del juzgado, cambio de jurisdicción..."
                rows={3}
              />
              {errorUbicacion && (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-1"><AlertCircle className="h-3 w-3" />{errorUbicacion}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalUbicacion(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!motivoUbicacion.trim() || !provinciaSeleccionada || !departamentoSeleccionado) {
                  setErrorUbicacion('Seleccioná provincia, ciudad y escribí un motivo')
                  return
                }
                setErrorUbicacion('')
                const provinciaLabel = provincias.find(p => p.value === provinciaSeleccionada)?.label || provinciaSeleccionada
                setUbicacionConfirmada({
                  provincia: provinciaSeleccionada,
                  ciudad: departamentoSeleccionado,
                  fuero: `${departamentoSeleccionado}, ${provinciaLabel}`
                })
                setModalUbicacion(false)
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Confirmar cambio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL MONTO - CON LA LÓGICA DE CLAUDE ADAPTADA A TU SISTEMA */}
      <Dialog open={modalMonto} onOpenChange={setModalMonto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modificar Monto en Disputa</DialogTitle>
            <DialogDescription>
              Este cambio impacta en los reportes financieros y quedará registrado en la bitácora.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nuevo monto ($)</Label>
              <Input 
                type="number"
                step="0.01"
                value={nuevaMonto}
                onChange={(e) => setNuevaMonto(e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* CAJA ÁMBAR DE CLAUDE INYECTADA EN TU MODAL */}
            <div className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-900">
                  <p className="font-semibold">Estás modificando el monto en disputa</p>
                  <p className="mt-0.5 text-amber-700">
                    {montoOriginal 
                      ? `Valor anterior guardado: $${Number(montoOriginal).toLocaleString('es-AR')}` 
                      : 'El expediente no tenía monto cargado hasta ahora.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motivo del cambio <span className="text-red-500">*</span></Label>
              <Textarea
                value={motivoMonto}
                onChange={(e) => setMotivoMonto(e.target.value)}
                placeholder="Ej: Actualización por inflación, pericia determinó nuevo valor..."
                rows={3}
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] text-slate-500">Mínimo 5 caracteres.</p>
                <p className={`text-[10px] font-mono ${motivoMonto.trim().length < 5 ? 'text-red-500' : 'text-green-600'}`}>
                  {motivoMonto.trim().length} / 5
                </p>
              </div>
              {errorMonto && (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {errorMonto}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setModalMonto(false);
              setNuevaMonto(montoConfirmado); // Si cancela, volvemos a lo de antes
              setErrorMonto('');
            }}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (motivoMonto.trim().length < 5) {
                  setErrorMonto('El motivo es obligatorio y debe tener mínimo 5 caracteres')
                  return
                }
                setErrorMonto('')
                setMontoConfirmado(nuevaMonto)
                setModalMonto(false)
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Confirmar cambio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

        </CardContent>
      </Card>
  )
}