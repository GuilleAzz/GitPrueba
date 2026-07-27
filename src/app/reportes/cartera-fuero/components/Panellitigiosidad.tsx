'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, TrendingDown, ArrowUpRight } from "lucide-react"

type LitigiosidadData = {
  etapaTemprana: number  // Inicio / Mediación
  etapaMedia: number     // Prueba / Alegatos
  etapaTardia: number    // Sentencia / Apelación / Ejecución
  totalActivos: number
}

export function PanelLitigiosidad({ data }: { data: LitigiosidadData }) {
  const pctTemprana = data.totalActivos > 0 ? Math.round((data.etapaTemprana / data.totalActivos) * 100) : 0
  const pctMedia = data.totalActivos > 0 ? Math.round((data.etapaMedia / data.totalActivos) * 100) : 0
  const pctTardia = data.totalActivos > 0 ? Math.round((data.etapaTardia / data.totalActivos) * 100) : 0

  // Insight automático
  const todoEnEjecucion = pctTardia > 60
  const todoAlInicio = pctTemprana > 60
  const equilibrado = !todoEnEjecucion && !todoAlInicio

  return (
    <Card className="bg-white border border-slate-200 mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-indigo-600" />
          Distribución por fase procesal
        </CardTitle>
        <p className="text-xs text-slate-500">
          Expedientes activos agrupados según la fase procesal en que se encuentran.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Temprana */}
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
            <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-blue-600 uppercase">Conocimiento</p>
              <span className="text-lg font-bold text-blue-700">{pctTemprana}%</span>
            </div>
            <p className="text-xs text-blue-500 mb-2">Inicio / Mediación / Previo</p>
            <div className="w-full bg-blue-200 rounded-full h-3">
              <div className="bg-blue-500 h-3 rounded-full transition-all" style={{ width: `${pctTemprana}%` }} />
            </div>
            <p className="text-xs text-blue-600 mt-1 font-medium">{data.etapaTemprana} expedientes</p>
          </div>

          {/* Media */}
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-amber-600 uppercase">Prueba</p>
              <span className="text-lg font-bold text-amber-700">{pctMedia}%</span>
            </div>
            <p className="text-xs text-amber-500 mb-2">Prueba / Alegatos</p>
            <div className="w-full bg-amber-200 rounded-full h-3">
              <div className="bg-amber-500 h-3 rounded-full transition-all" style={{ width: `${pctMedia}%` }} />
            </div>
            <p className="text-xs text-amber-600 mt-1 font-medium">{data.etapaMedia} expedientes</p>
          </div>

          {/* Tardía */}
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-emerald-600 uppercase">Resolución / Ejecución</p>
              <span className="text-lg font-bold text-emerald-700">{pctTardia}%</span>
            </div>
            <p className="text-xs text-emerald-500 mb-2">Sentencia / Apelación / Ejecución</p>
            <div className="w-full bg-emerald-200 rounded-full h-3">
              <div className="bg-emerald-500 h-3 rounded-full transition-all" style={{ width: `${pctTardia}%` }} />
            </div>
            <p className="text-xs text-emerald-600 mt-1 font-medium">{data.etapaTardia} expedientes</p>
          </div>
        </div>

        {/* Insight automático */}
        <div className={`p-3 rounded-lg border text-sm ${
          todoEnEjecucion
            ? "bg-red-50 border-red-200 text-red-700"
            : todoAlInicio
            ? "bg-blue-50 border-blue-200 text-blue-700"
            : "bg-emerald-50 border-emerald-200 text-emerald-700"
        }`}>
          {todoEnEjecucion && (
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>
                <span className="font-semibold">Atención:</span> El {pctTardia}% de los expedientes están en etapa tardía. 
                Cuando se resuelvan, puede haber un vacío de trabajo. Considerar captar nuevos expedientes.
              </p>
            </div>
          )}
          {todoAlInicio && (
            <div className="flex items-start gap-2">
              <ArrowUpRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>
                <span className="font-semibold">En crecimiento:</span> El {pctTemprana}% de los expedientes están en etapa temprana. 
                Buena captación pero la carga aumentará cuando avancen a prueba.
              </p>
            </div>
          )}
          {equilibrado && (
            <p>
              <span className="font-semibold">✓ equilibrado.</span> Hay distribución razonable entre etapas 
              tempranas ({pctTemprana}%), medias ({pctMedia}%) y tardías ({pctTardia}%).
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}