'use client'

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "src/components/ui/collapsible"
import { 
  MapPin, 
  ChevronDown, 
  ChevronRight,
  Building2,
  Car,
  AlertTriangle,
  FileText,
  Clock,
  User,
  Scale,
  Navigation
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { GenerarPDFButton } from "./GenerarPDFButton"

interface CasoUbicacion {
  id: string
  numero: string
  titulo: string
  tipo: string
  estado: string
  juzgado: string | null
  clienteNombre: string
  abogadoNombre: string
  abogadoId: string
  ultimoMovimiento: Date
  priority: string
  esUrgente: boolean
}

interface JuzgadoAgrupado {
  nombre: string
  casos: CasoUbicacion[]
  cantidadCasos: number
  urgentes: number
}

interface ZonaGeografica {
  id: string
  ciudad: string
  provincia: string
  coordenadas: { lat: number; lng: number } | null
  juzgados: JuzgadoAgrupado[]
  totalCasos: number
  casos: CasoUbicacion[]
}

interface AcordeonZonasProps {
  zonas: ZonaGeografica[]
  vistaGeneral: boolean
}

function ZonaItem({ zona, vistaGeneral, seleccionada, onToggle }: { 
  zona: ZonaGeografica
  vistaGeneral: boolean
  seleccionada: boolean
  onToggle: () => void
}) {
  const [expandida, setExpandida] = useState(false)

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden transition-all">
      <Collapsible open={expandida} onOpenChange={setExpandida}>
        <CardHeader className="p-0">
          <div className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
            {/* Checkbox para PDF */}
            <Checkbox 
              checked={seleccionada}
              onCheckedChange={onToggle}
              onClick={(e) => e.stopPropagation()}
              className="data-[state=checked]:bg-blue-600"
            />

            {/* Trigger para expandir */}
            <CollapsibleTrigger asChild>
              <div className="flex-1 flex items-center gap-4 cursor-pointer">
                {/* Icono */}

                <div className="p-2 rounded-lg bg-slate-100">
                  <Building2 className="h-5 w-5 text-slate-600" />
                </div>

                {/* Info principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-900">{zona.ciudad}</h3>
                    <span className="text-sm text-slate-500">{zona.provincia}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {zona.totalCasos} caso{zona.totalCasos > 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <Scale className="h-3 w-3" />
                      {zona.juzgados.length} juzgado{zona.juzgados.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Indicador expandir */}
                <div className="text-slate-400">
                  {expandida ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>
              </div>
            </CollapsibleTrigger>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">
            {/* Lista de juzgados */}
            <div className="space-y-4 mt-2">
              {zona.juzgados.map((juzgado, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* Header del juzgado */}
                  <div className="bg-slate-50 px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4 text-slate-500" />
                      <span className="font-medium text-slate-700">{juzgado.nombre}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {juzgado.cantidadCasos} caso{juzgado.cantidadCasos > 1 ? 's' : ''}
                      </Badge>
                      {juzgado.urgentes > 0 && (
                        <Badge className="bg-amber-100 text-amber-700 text-xs">
                          {juzgado.urgentes} urgente{juzgado.urgentes > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Lista de casos */}
                  <div className="divide-y divide-slate-100">
                    {juzgado.casos.map((caso) => (
                      <Link 
                        key={caso.id} 
                        href={`/casos/${caso.id}`}
                        className="block hover:bg-slate-50 transition-colors"
                      >
                        <div className="px-4 py-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-mono text-slate-500">
                                  {caso.numero}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {caso.tipo}
                                </Badge>
                                {caso.esUrgente && (
                                  <Badge className="bg-amber-100 text-amber-700 text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Urgente
                                  </Badge>
                                )}
                              </div>
                              <p className="font-medium text-slate-900 truncate">
                                {caso.titulo}
                              </p>
                              <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {caso.clienteNombre}
                                </span>
                                {vistaGeneral && (
                                  <span className="flex items-center gap-1 text-blue-600">
                                    <User className="h-3 w-3" />
                                    {caso.abogadoNombre}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(caso.ultimoMovimiento), "d MMM yyyy", { locale: es })}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  caso.priority === 'HIGH' 
                                    ? 'border-red-200 text-red-700 bg-red-50' 
                                    : caso.priority === 'LOW'
                                    ? 'border-slate-200 text-slate-500'
                                    : ''
                                }`}
                              >
                                {caso.estado}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

function ProvinciaGroup({ provincia, zonas, vistaGeneral, zonasSeleccionadas, onToggle }: {
  provincia: string
  zonas: ZonaGeografica[]
  vistaGeneral: boolean
  zonasSeleccionadas: Set<string>
  onToggle: (id: string) => void
}) {
  const [expandida, setExpandida] = useState(true)
const totalCasos = zonas.reduce((sum, z) => sum + z.totalCasos, 0)

  return (
    <div className="space-y-2">
      {/* Header de provincia */}
      <div 
        className="flex items-center gap-3 px-4 py-2 bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors"
        onClick={() => setExpandida(!expandida)}
      >
        <MapPin className="h-4 w-4 text-slate-500" />
        <span className="font-bold text-slate-700">{provincia}</span>
        <span className="text-xs text-slate-500">
          {zonas.length} ciudad{zonas.length > 1 ? 'es' : ''} · {totalCasos} caso{totalCasos > 1 ? 's' : ''}
        </span>
        <div className="ml-auto text-slate-400">
          {expandida ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </div>

      {/* Zonas de la provincia */}
      {expandida && (
        <div className="space-y-3 pl-4 border-l-2 border-slate-200 ml-2">
          {zonas.map(zona => (
            <ZonaItem
              key={zona.id}
              zona={zona}
              vistaGeneral={vistaGeneral}
              seleccionada={zonasSeleccionadas.has(zona.id)}
              onToggle={() => onToggle(zona.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function AcordeonZonas({ zonas, vistaGeneral }: AcordeonZonasProps) {
  const [zonasSeleccionadas, setZonasSeleccionadas] = useState<Set<string>>(
    new Set(zonas.map(z => z.id))
  )

  const toggleZona = (zonaId: string) => {
    setZonasSeleccionadas(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(zonaId)) nuevo.delete(zonaId)
      else nuevo.add(zonaId)
      return nuevo
    })
  }

  const seleccionarTodas = () => setZonasSeleccionadas(new Set(zonas.map(z => z.id)))
  const deseleccionarTodas = () => setZonasSeleccionadas(new Set())
  const zonasParaPDF = zonas.filter(z => zonasSeleccionadas.has(z.id))

  // Agrupar por provincia
const normalizarProvincia = (p: string) =>
  p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()

const provinciaMap = new Map<string, { display: string; zonas: ZonaGeografica[] }>()
zonas.forEach(zona => {
  const display = zona.provincia || 'Sin Especificar'
  const key = normalizarProvincia(display) || 'sin especificar'
  if (!provinciaMap.has(key)) provinciaMap.set(key, { display, zonas: [] })
  provinciaMap.get(key)!.zonas.push(zona)
})
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">
            {zonasSeleccionadas.size} de {zonas.length} zonas seleccionadas
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={seleccionarTodas}>Seleccionar todas</Button>
            <Button variant="ghost" size="sm" onClick={deseleccionarTodas}>Deseleccionar todas</Button>
          </div>
        </div>
        <GenerarPDFButton 
          zonas={zonasParaPDF} 
          vistaGeneral={vistaGeneral}
          disabled={zonasSeleccionadas.size === 0}
        />
      </div>

      {/* Agrupado por provincia */}
      <div className="space-y-6">
        {Array.from(provinciaMap.entries()).map(([key, { display, zonas: zonasEnProv }]) => (
          <ProvinciaGroup
            key={key}
            provincia={display}
            zonas={zonasEnProv}
            vistaGeneral={vistaGeneral}
            zonasSeleccionadas={zonasSeleccionadas}
            onToggle={toggleZona}
          />
        ))}
      </div>
    </div>
  )
}
