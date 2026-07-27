'use client'

import { crearClienteAction } from "../../../lib/actions/clientes-actions" 
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowLeft, Save, User, Building2, FileText, Phone, Mail, MapPin, Hash, AlertCircle, CheckCircle2, Briefcase, IdCard, Scale, ChevronRight } from 'lucide-react'
import Link from "next/link"
import { useFormState, useFormStatus } from "react-dom"
import { useState, useEffect } from "react"
import { validarDocumento, getPlaceholderDocumento, getHintDocumento, type TipoDocumento } from "src/lib/utils/documento"

function SubmitButton({ deshabilitado, motivoDeshabilitado }: { deshabilitado?: boolean; motivoDeshabilitado?: string }) {
  const { pending } = useFormStatus()
  return (
    <div className="flex flex-col items-end gap-1">
      <Button 
        type="submit" 
        disabled={pending || deshabilitado} 
        className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        title={deshabilitado ? motivoDeshabilitado : undefined}
      >
        <Save className="h-4 w-4 mr-2" />
        {pending ? "Creando..." : "Crear Cliente"}
      </Button>
      {deshabilitado && motivoDeshabilitado && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {motivoDeshabilitado}
        </p>
      )}
    </div>
  )
}

interface NuevoClienteFormProps {
  abogados: { id: string; email: string; nombre: string | null; apellido: string | null }[]
  userRol: string
}

export default function NuevoClienteForm({ abogados, userRol }: NuevoClienteFormProps) {
  const initialState = { message: null, error: null }
  const [state, dispatch] = useFormState(crearClienteAction, initialState)
  const [activo, setActivo] = useState(true)
  
  const [tipoPersona, setTipoPersona] = useState<"FISICA" | "JURIDICA">("FISICA")
  const [documentoTipo, setDocumentoTipo] = useState<string>("DNI")
  const [numeroDocumento, setNumeroDocumento] = useState<string>("")
  const [email, setEmail] = useState<string>("")
  const [telefono, setTelefono] = useState<string>("")
  const [direccion, setDireccion] = useState<string>("")
  
  const [validaciones, setValidaciones] = useState({
    email: { valido: true, mensaje: "" },
    telefono: { valido: true, mensaje: "" },
    documento: { valido: true, mensaje: "" },
    direccion: { valido: true, mensaje: "" }
  })

  useEffect(() => {
    if (email.length === 0) {
      setValidaciones(prev => ({ ...prev, email: { valido: true, mensaje: "" }}))
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const esValido = emailRegex.test(email)
    setValidaciones(prev => ({ ...prev, email: { valido: esValido, mensaje: esValido ? "" : "Formato de email inválido" }}))
  }, [email])

  useEffect(() => {
    if (telefono.length === 0) {
      setValidaciones(prev => ({ ...prev, telefono: { valido: true, mensaje: "" }}))
      return
    }
    const telefonoRegex = /^(\+?54)?[\s-]?(\d{2,4})[\s-]?\d{4}[\s-]?\d{4}$/
    const esValido = telefonoRegex.test(telefono)
    setValidaciones(prev => ({ ...prev, telefono: { valido: esValido, mensaje: esValido ? "" : "Formato sugerido: +54 9 11 1234-5678" }}))
  }, [telefono])

  useEffect(() => {
  if (direccion.length === 0) {
    setValidaciones(prev => ({ ...prev, direccion: { valido: true, mensaje: "" }}))
    return
  }
  const esValido = direccion.trim().length >= 5
  setValidaciones(prev => ({ 
    ...prev, 
    direccion: { 
      valido: esValido, 
      mensaje: esValido ? "" : "Ingresá una dirección válida (mínimo 5 caracteres)" 
    }
  }))
}, [direccion])

  useEffect(() => {
    if (numeroDocumento.length === 0) {
      setValidaciones(prev => ({ ...prev, documento: { valido: true, mensaje: "" }}))
      return
    }
    const resultado = validarDocumento(documentoTipo as TipoDocumento, numeroDocumento)
    setValidaciones(prev => ({ 
      ...prev, 
      documento: { 
        valido: resultado.valido, 
        mensaje: resultado.error || "" 
      }
    }))
  }, [numeroDocumento, documentoTipo])

   const formPuedeEnviarse = 
    validaciones.email.valido && email.length > 0 &&
    validaciones.telefono.valido && telefono.length > 0 &&
    validaciones.direccion.valido && direccion.length > 0 &&
    validaciones.documento.valido && numeroDocumento.length > 0

  // Mensaje explicativo de por qué no se puede enviar
  const motivoBloqueo = !formPuedeEnviarse ? (() => {
    if (!validaciones.documento.valido && numeroDocumento.length > 0) return "Verificá el número de documento"
    if (numeroDocumento.length === 0) return "Falta el número de documento"
    if (!validaciones.email.valido && email.length > 0) return "Verificá el email"
    if (email.length === 0) return "Falta el email"
    if (!validaciones.telefono.valido && telefono.length > 0) return "Verificá el teléfono"
    if (telefono.length === 0) return "Falta el teléfono"
    if (!validaciones.direccion.valido && direccion.length > 0) return "Verificá la dirección"
    if (direccion.length === 0) return "Falta la dirección"
    return "Revisá los campos marcados"
  })() : undefined

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ===== HEADER CON BREADCRUMB ===== */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-2">
          <Link href="/clientes">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/clientes" className="text-slate-500 hover:text-slate-700 transition-colors">
              Clientes
            </Link>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="text-slate-900 font-medium">Nuevo Cliente</span>
          </nav>
        </div>
      </div>
      {/* ================================= */}

      <div className="max-w-4xl mx-auto p-6">
        <Card className="shadow-md border-slate-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="h-8 w-8 text-blue-600" />
              <div>
                <CardTitle>Nuevo Cliente</CardTitle>
                <CardDescription>Complete la información del cliente para agregarlo al sistema</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {state?.error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded flex items-start gap-3">
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Error al crear cliente</p>
                  <p>{state.error}</p>
                </div>
              </div>
            )}

            {state?.message && (
              <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Éxito</p>
                  <p>{state.message}</p>
                </div>
              </div>
            )}

            <form action={dispatch} className="space-y-8">

              {/* SECCIÓN ABOGADO RESPONSABLE — solo ASISTENTE */}
              {userRol === 'ASISTENTE' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-sm">
                      <User className="h-4 w-4" />
                    </div>
                    <h2 className="text-lg font-semibold text-slate-800">Abogado Responsable</h2>
                    <span className="ml-auto text-xs text-slate-500">Obligatorio</span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <Label className="flex items-center gap-2 mb-2">
                      Asignar abogado<span className="text-red-500">*</span>
                    </Label>
                    <Select name="abogadoId" required>
                      <SelectTrigger className="border-slate-300">
                        <SelectValue placeholder="Seleccionar abogado..." />
                      </SelectTrigger>
                      <SelectContent>
                        {abogados.map((abogado) => (
                          <SelectItem key={abogado.id} value={abogado.id}>
                            {abogado.nombre} {abogado.apellido || ''} — {abogado.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 mt-2">
                      El cliente quedará asignado a este abogado y será visible en sus reportes.
                    </p>
                  </div>
                </div>
              )}
                            
              {/* SECCIÓN 1: TIPO DE PERSONA */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">1</div>
                  <h2 className="text-lg font-semibold text-slate-800">Tipo de Persona</h2>
                  <span className="ml-auto text-xs text-slate-500">Obligatorio</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${tipoPersona === 'FISICA' ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input type="radio" name="tipoPersona" value="FISICA" checked={tipoPersona === 'FISICA'} onChange={() => setTipoPersona('FISICA')} className="w-5 h-5 accent-blue-600" required />
                    <User className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-semibold text-slate-900">Persona Física</p>
                      <p className="text-xs text-slate-600">Individuo (requiere apellido)</p>
                    </div>
                  </Label>
                  <Label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${tipoPersona === 'JURIDICA' ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input type="radio" name="tipoPersona" value="JURIDICA" checked={tipoPersona === 'JURIDICA'} onChange={() => setTipoPersona('JURIDICA')} className="w-5 h-5 accent-purple-600" />
                    <Building2 className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="font-semibold text-slate-900">Persona Jurídica</p>
                      <p className="text-xs text-slate-600">Empresa / Sociedad</p>
                    </div>
                  </Label>
                </div>
              </div>

              {/* SECCIÓN 2: DATOS PERSONALES */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-sm">2</div>
                  <h2 className="text-lg font-semibold text-slate-800">{tipoPersona === 'FISICA' ? 'Datos Personales' : 'Razón Social'}</h2>
                  <span className="ml-auto text-xs text-slate-500">Obligatorio</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">{tipoPersona === 'FISICA' ? 'Nombre/s' : 'Razón Social'}<span className="text-red-500">*</span></Label>
                    <Input name="nombre" placeholder={tipoPersona === 'FISICA' ? "Ej: Juan Carlos" : "Ej: Acme Corporation S.A."} minLength={2} required className="border-slate-300" />
                  </div>
                  {tipoPersona === 'FISICA' ? (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">Apellido/s<span className="text-red-500">*</span></Label>
                      <Input name="apellido" placeholder="Ej: Pérez González" minLength={2} required className="border-slate-300" />
                    </div>
                  ) : (
                    <input type="hidden" name="apellido" value="" />
                  )}

                  {tipoPersona === 'JURIDICA' && (
                    <>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-purple-600" />Tipo de Sociedad<span className="text-red-500">*</span></Label>
                        <Select name="tipoSociedad" required>
                          <SelectTrigger className="border-slate-300"><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SA">S.A. — Sociedad Anónima</SelectItem>
                            <SelectItem value="SRL">S.R.L. — Sociedad de Resp. Limitada</SelectItem>
                            <SelectItem value="SAS">S.A.S. — Sociedad por Acciones Simplificada</SelectItem>
                            <SelectItem value="COOPERATIVA">Cooperativa</SelectItem>
                            <SelectItem value="ASOCIACION_CIVIL">Asociación Civil</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500">Requerido para redacción de demandas y documentos formales</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2"><IdCard className="h-4 w-4 text-purple-600" />Nombre del Representante Legal<span className="text-red-500">*</span></Label>
                        <Input name="representanteNombre" placeholder="Ej: Juan Pérez" required className="border-slate-300" />
                        <p className="text-xs text-slate-500">Presidente, gerente o apoderado de la sociedad</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2"><Hash className="h-4 w-4 text-purple-600" />DNI del Representante<span className="text-red-500">*</span></Label>
                        <Input name="representanteDni" placeholder="Ej: 12345678" required className="border-slate-300" />
                        <p className="text-xs text-slate-500">Necesario para escritos y poderes judiciales</p>
                      </div>
                    </>
                  )}

                  {tipoPersona === 'FISICA' && (
                    <>
                      <input type="hidden" name="tipoSociedad" value="" />
                      <input type="hidden" name="representanteNombre" value="" />
                      <input type="hidden" name="representanteDni" value="" />
                      <div className="space-y-2 md:col-span-2">
                        <Label className="flex items-center gap-2"><Scale className="h-4 w-4 text-blue-600" />Bienes Embargables</Label>
                        <div className="flex gap-3">
                          {[
                            { value: "SI", label: "Sí", desc: "Tiene bienes registrables" },
                            { value: "NO", label: "No", desc: "Sin bienes conocidos" },
                            { value: "NO_CORRESPONDE", label: "No corresponde", desc: "No aplica al caso" },
                          ].map(({ value, label, desc }) => (
                            <Label key={value} className="flex-1 flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all text-sm">
                              <input type="radio" name="bienesEmbargables" value={value} defaultChecked={value === "NO_CORRESPONDE"} className="w-4 h-4" />
                              <div>
                                <p className="font-medium text-slate-800">{label}</p>
                                <p className="text-xs text-slate-500">{desc}</p>
                              </div>
                            </Label>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500">Indica si el cliente tiene bienes sobre los cuales ejecutar una sentencia</p>
                      </div>
                    </>
                  )}

                  {tipoPersona === 'JURIDICA' && (
                    <input type="hidden" name="bienesEmbargables" value="" />
                  )}
                </div>
              </div>

              {/* SECCIÓN 3: DOCUMENTACIÓN */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm">3</div>
                  <h2 className="text-lg font-semibold text-slate-800">Documentación Fiscal</h2>
                  <span className="ml-auto text-xs text-slate-500">Obligatorio - Único en sistema</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><FileText className="h-4 w-4" />Tipo de Documento<span className="text-red-500">*</span></Label>
                    {tipoPersona === 'JURIDICA' && <input type="hidden" name="tipoDocumento" value="CUIT" />}
                    <Select
                      name={tipoPersona === 'JURIDICA' ? undefined : "tipoDocumento"}
                      value={tipoPersona === 'JURIDICA' ? 'CUIT' : documentoTipo}
                      onValueChange={tipoPersona === 'JURIDICA' ? undefined : setDocumentoTipo}
                      disabled={tipoPersona === 'JURIDICA'}
                      required
                    >
                      <SelectTrigger className={`border-slate-300 ${tipoPersona === 'JURIDICA' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}>
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DNI">DNI - Documento Nacional</SelectItem>
                        <SelectItem value="CUIT">CUIT - Clave Única Tributaria</SelectItem>
                        <SelectItem value="CUIL">CUIL - Clave Única Laboral</SelectItem>
                        <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                        <SelectItem value="OTRO">Otro (LC, LE, CI extranjera)</SelectItem>
                      </SelectContent>
                    </Select>
                    {tipoPersona === 'JURIDICA' && <p className="text-xs text-slate-500">Las personas jurídicas se identifican siempre con CUIT</p>}
                  </div>
<div className="space-y-2">
                    <Label className="flex items-center gap-2"><Hash className="h-4 w-4" />Número de Documento<span className="text-red-500">*</span></Label>
                    <Input
                      name="numeroDocumento"
                      placeholder={getPlaceholderDocumento(documentoTipo as TipoDocumento)}
                      value={numeroDocumento}
                      onChange={(e) => {
                        let valor = e.target.value
                        switch(documentoTipo) {
                          case 'DNI':
                            valor = valor.replace(/[^0-9]/g, '').slice(0, 8)
                            break
                          case 'CUIT':
                          case 'CUIL':
                            valor = valor.replace(/[^0-9-]/g, '').slice(0, 13) // 11 dígitos + 2 guiones
                            break
                          case 'PASAPORTE':
                            valor = valor.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 15)
                            break
                          default:
                            valor = valor.slice(0, 20)
                        }
                        setNumeroDocumento(valor)
                      }}
                      minLength={5}
                      required
                      className={`border-2 ${numeroDocumento.length > 0 ? validaciones.documento.valido ? 'border-green-500' : 'border-red-500' : 'border-slate-300'}`}
                    />
                    {/* [DOC-VAL] Mensaje de error si el documento no es válido */}
                    {numeroDocumento.length > 0 && !validaciones.documento.valido && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {validaciones.documento.mensaje}
                      </p>
                    )}
                    {/* [DOC-VAL] Hint del formato esperado */}
                    <p className="text-xs text-slate-500">
                      {getHintDocumento(documentoTipo as TipoDocumento)}
                    </p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="flex items-center gap-2">Condición frente al IVA<span className="text-red-500">*</span></Label>
                    <Select name="condicionIva" required>
                      <SelectTrigger className="border-slate-300"><SelectValue placeholder="Seleccionar condición..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RESPONSABLE_INSCRIPTO">Responsable Inscripto</SelectItem>
                        <SelectItem value="MONOTRIBUTISTA">Monotributista</SelectItem>
                        <SelectItem value="EXENTO">Exento</SelectItem>
                        <SelectItem value="CONSUMIDOR_FINAL">Consumidor Final</SelectItem>
                        <SelectItem value="NO_CATEGORIZADO">No Categorizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 4: CONTACTO */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">4</div>
                  <h2 className="text-lg font-semibold text-slate-800">Datos de Contacto</h2>
                  <span className="ml-auto text-xs text-slate-500">Opcional (recomendado)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Mail className="h-4 w-4" />Email</Label>
                    <Input type="email" name="email" placeholder="cliente@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} className={`border-2 ${email.length > 0 ? validaciones.email.valido ? 'border-green-500' : 'border-red-500' : 'border-slate-300'}`} />
                    {email.length > 0 && !validaciones.email.valido && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{validaciones.email.mensaje}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Phone className="h-4 w-4" />Teléfono</Label>
                    <Input 
                      type="tel" 
                      name="telefono" 
                      placeholder="+54 9 11 1234-5678" 
                      value={telefono} 
                      onChange={(e) => {
                        const valor = e.target.value.replace(/[^0-9+\s-]/g, '').slice(0, 13)
                        setTelefono(valor)
                      }}
                      required
                      className={`border-2 ${telefono.length > 0 ? validaciones.telefono.valido ? 'border-green-500' : 'border-yellow-500' : 'border-slate-300'}`} 
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="flex items-center gap-2"><MapPin className="h-4 w-4" />{tipoPersona === 'FISICA' ? 'Dirección' : 'Domicilio / Sede Social'}</Label>
                    <Input 
                        name="direccion" 
                        value={direccion}
                        onChange={(e) => setDireccion(e.target.value)}
                        placeholder={tipoPersona === 'FISICA' ? "Calle, número, localidad, provincia" : "Domicilio inscripto en IGJ/DPPJ"}
                        required
                        className={`border-2 ${
                          direccion.length > 0 
                            ? validaciones.direccion.valido 
                              ? 'border-green-500' 
                              : 'border-red-500' 
                            : 'border-slate-300'
                        }`}
                      />
                      {direccion.length > 0 && !validaciones.direccion.valido && (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {validaciones.direccion.mensaje}
                        </p>
                      )}
                    <p className="text-xs text-slate-500">{tipoPersona === 'FISICA' ? "Útil para logística y envíos de documentación" : "Domicilio inscripto en IGJ/DPPJ, válido para notificaciones legales"}</p>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 5: ADICIONAL */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-bold text-sm">5</div>
                  <h2 className="text-lg font-semibold text-slate-800">Información Adicional</h2>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Notas Internas</Label>
                    <Textarea name="notasInternas" rows={4} placeholder="Observaciones, contexto del cliente, preferencias de comunicación, etc." className="resize-none" />
                  </div>
                  <div className={`flex items-start gap-3 p-4 border-2 rounded-lg transition-all duration-200 ${
                    activo 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <input
                      type="checkbox"
                      name="activo"
                      id="activo"
                      checked={activo}
                      onChange={(e) => setActivo(e.target.checked)}
                      className={`w-5 h-5 mt-0.5 transition-colors ${activo ? 'accent-green-600' : 'accent-gray-500'}`}
                    />
                    <Label htmlFor="activo" className="cursor-pointer flex-1">
                      <p className={`font-semibold transition-colors ${activo ? 'text-green-900' : 'text-gray-900'}`}>
                        {activo ? 'Cliente Habilitado' : 'Cliente Archivado'}
                      </p>
                      <p className={`text-sm mt-1 transition-colors ${activo ? 'text-green-700' : 'text-gray-600'}`}>
                        {activo 
                          ? 'El perfil estará disponible inmediatamente para asignarle nuevos expedientes.' 
                          : 'Se creará el perfil pero nacerá oculto de los listados principales.'
                        }
                      </p>
                    </Label>
                  </div>
                </div>
              </div>

              {/* BOTONES */}
              <div className="flex justify-between items-center gap-3 pt-6 border-t-2 border-slate-200">
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  Los campos marcados con <span className="text-red-500 mx-1">*</span> son obligatorios
                </p>
                <div className="flex gap-3">
                  <Link href="/clientes">
                    <Button variant="outline" type="button" className="gap-2">
                      <ArrowLeft className="h-4 w-4" /> Cancelar
                    </Button>
                  </Link>
                  <SubmitButton
                    deshabilitado={!formPuedeEnviarse}
                    motivoDeshabilitado={motivoBloqueo}
                  />
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}