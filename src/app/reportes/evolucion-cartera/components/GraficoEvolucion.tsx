'use client'

// app/reportes/evolucion-cartera/components/GraficoEvolucion.tsx
//
// Gráfico combinado de la evolución de cartera:
//   - Barras verdes: ingresos por período
//   - Barras rojas: cierres por período
//   - Línea azul: cartera activa acumulada al final de cada período
//
// Consume las mismas filas mensuales que Tablaflujo.

import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { LineChart as LineChartIcon } from "lucide-react"

interface FilaMensual {
  key: string
  label: string
  ingresos: number
  cierres: number
  balance: number
  carteraAcumulada: number
  ingresosMesAnterior: number
  cierresMesAnterior: number
}

export function GraficoEvolucion({
  filas,
  carteraInicial,
}: {
  filas: FilaMensual[]
  carteraInicial: number
}) {
  // Preparar datos para Recharts
  const datos = filas.map(f => ({
    periodo: f.label,
    Ingresos: f.ingresos,
    Cierres: f.cierres,
    'Cartera activa': f.carteraAcumulada,
  }))

  const hayDatos = filas.some(f => f.ingresos > 0 || f.cierres > 0)

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="border-b bg-slate-50/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <LineChartIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold text-slate-800">
              Evolución del flujo y tamaño de cartera
            </CardTitle>
            <CardDescription>
              Barras: movimientos por mes (ingresos y cierres). Línea: cómo evoluciona el total de expedientes activos.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {!hayDatos ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            No hay ingresos ni cierres en el rango seleccionado.
          </div>
        ) : (
          <>
            <div className="w-full" style={{ height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={datos} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="periodo"
                    stroke="#64748b"
                    style={{ fontSize: '11px' }}
                    angle={datos.length > 8 ? -30 : 0}
                    textAnchor={datos.length > 8 ? 'end' : 'middle'}
                    height={datos.length > 8 ? 60 : 30}
                  />
                  {/* Eje izquierdo: barras (movimientos) */}
                  <YAxis
                    yAxisId="left"
                    stroke="#64748b"
                    style={{ fontSize: '11px' }}
                    allowDecimals={false}
                    label={{
                      value: 'Movimientos',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: '11px', fill: '#64748b' }
                    }}
                  />
                  {/* Eje derecho: línea (cartera activa) */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#3b82f6"
                    style={{ fontSize: '11px' }}
                    allowDecimals={false}
                    label={{
                      value: 'Cartera activa',
                      angle: 90,
                      position: 'insideRight',
                      style: { fontSize: '11px', fill: '#3b82f6' }
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: 'white',
                    }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    iconType="circle"
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="Ingresos"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="Cierres"
                    fill="#f43f5e"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="Cartera activa"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#3b82f6' }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Nota de lectura */}
            <div className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
              <p className="text-xs text-blue-900">
                <strong>Cómo leerlo:</strong> las barras verdes son los nuevos expedientes que entraron
                y las rojas los que se cerraron en cada mes. La línea azul suma esos movimientos
                al tamaño de la cartera al inicio del rango ({carteraInicial} expedientes),
                mostrando cómo evolucionó el total activo. Si la línea sube, la cartera está
                creciendo; si baja, se está achicando.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}