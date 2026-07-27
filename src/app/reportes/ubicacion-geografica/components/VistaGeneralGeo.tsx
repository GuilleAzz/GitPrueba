'use client'

// app/reportes/ubicacion-geografica/components/VistaGeneralGeo.tsx
// Vista gerencial — distribución de la cartera del estudio por ciudad.
// (El toggle que la activa está pendiente de habilitar en page.tsx)

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Building2 } from "lucide-react"

export type ZonaGeneral = {
  ciudad: string
  provincia: string
  totalCasos: number
  abogados: {
    id: string
    nombre: string
    cantidadCasos: number
  }[]
}

export function VistaGeneralGeo({ zonas }: { zonas: ZonaGeneral[] }) {
  if (zonas.length === 0) {
    return (
      <div className="p-12 bg-white border border-slate-200 rounded-lg text-center">
        <Users className="h-16 w-16 mx-auto text-slate-300 mb-4" />
        <p className="text-lg font-medium text-slate-600">Sin datos para la vista general</p>
        <p className="text-sm text-slate-400 mt-2">No hay expedientes activos con ubicación registrada.</p>
      </div>
    )
  }

  const totalCasos = zonas.reduce((s, z) => s + z.totalCasos, 0)
  const sorted = [...zonas].sort((a, b) => b.totalCasos - a.totalCasos)

  return (
    <Card className="bg-white border border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-600" />
          Carga por ciudad
        </CardTitle>
        <p className="text-xs text-slate-500">
          Concentración de expedientes del estudio por ubicación geográfica.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-y border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ciudad</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Provincia</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Casos</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">% del total</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Abogados</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((zona, idx) => {
              const pct = totalCasos > 0 ? Math.round((zona.totalCasos / totalCasos) * 100) : 0
              return (
                <tr
                  key={zona.ciudad + zona.provincia}
                  className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                >
                  <td className="px-4 py-3 font-semibold text-slate-800">{zona.ciudad}</td>
                  <td className="px-4 py-3 text-slate-500 text-sm">{zona.provincia}</td>
                  <td className="px-4 py-3 text-center font-bold text-slate-800">{zona.totalCasos}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 bg-slate-200 rounded-full h-2">
                        <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <span className="text-xs font-medium text-slate-600">{pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      {zona.abogados.map(a => (
                        <span key={a.id} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full" title={a.nombre}>
                          {a.nombre.split(' ')[0]}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}