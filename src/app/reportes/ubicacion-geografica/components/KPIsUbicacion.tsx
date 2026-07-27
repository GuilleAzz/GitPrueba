'use client'

import { Card, CardContent } from "@/components/ui/card"
import { 
  MapPin, 
  Building2, 
  AlertTriangle, 
  Car,
  Navigation
} from "lucide-react"

interface KPIsData {
  totalCasos: number
  ciudadesActivas: number
}

export function KPIsUbicacion({ data }: { data: KPIsData }) {
  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      
      {/* Total Casos */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-blue-50 rounded">
              <MapPin className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-xs text-slate-500">Total Expedientes</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{data.totalCasos}</p>
          <p className="text-xs text-slate-500">activos</p>
        </CardContent>
      </Card>

      {/* Ciudades Activas */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-indigo-50 rounded">
              <Building2 className="h-4 w-4 text-indigo-600" />
            </div>
            <span className="text-xs text-slate-500">Ciudades</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{data.ciudadesActivas}</p>
          <p className="text-xs text-slate-500">con expedientes</p>
        </CardContent>
      </Card>

      {/* Casos Urgentes */}
      {/* <Card className={`shadow-sm ${
        data.casosUrgentes > 0 
          ? 'border-amber-200 bg-amber-50/30' 
          : 'border-slate-200'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded ${
              data.casosUrgentes > 0 ? 'bg-amber-100' : 'bg-slate-100'
            }`}>
              <AlertTriangle className={`h-4 w-4 ${
                data.casosUrgentes > 0 ? 'text-amber-600' : 'text-slate-400'
              }`} />
            </div>
            <span className="text-xs text-slate-500">Urgentes</span>
          </div>
          <p className={`text-2xl font-bold ${
            data.casosUrgentes > 0 ? 'text-amber-600' : 'text-slate-900'
          }`}>
            {data.casosUrgentes}
          </p>
          <p className="text-xs text-slate-500">requieren atención</p>
        </CardContent>
      </Card> */}

      {/* Requieren Viaje */}
      {/* <Card className={`shadow-sm ${
        data.requierenViaje > 0 
          ? 'border-orange-200 bg-orange-50/30' 
          : 'border-slate-200'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded ${
              data.requierenViaje > 0 ? 'bg-orange-100' : 'bg-slate-100'
            }`}>
              <Car className={`h-4 w-4 ${
                data.requierenViaje > 0 ? 'text-orange-600' : 'text-slate-400'
              }`} />
            </div>
            <span className="text-xs text-slate-500">Viaje</span>
          </div>
          <p className={`text-2xl font-bold ${
            data.requierenViaje > 0 ? 'text-orange-600' : 'text-slate-900'
          }`}>
            {data.requierenViaje}
          </p>
          <p className="text-xs text-slate-500">ciudades fuera</p>
        </CardContent>
      </Card> */}

      {/* Distancia Promedio */}
      {/* <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-slate-100 rounded">
              <Navigation className="h-4 w-4 text-slate-600" />
            </div>
            <span className="text-xs text-slate-500">Dist. Prom.</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{data.distanciaPromedio}</p>
          <p className="text-xs text-slate-500">km desde Cba</p>
        </CardContent>
      </Card> */}
    </div>
  )
}
