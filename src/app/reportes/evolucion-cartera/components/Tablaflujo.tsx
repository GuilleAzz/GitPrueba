'use client'

// app/reportes/evolucion-cartera/components/Tablaflujo.tsx
//
// CAMBIOS respecto a la versión anterior:
//   - Se sacan los porcentajes de variación vs mes anterior (matemáticamente
//     confusos cuando el mes anterior tiene 0)
//   - Se reemplaza el "Neto" por "Crecimiento" (lenguaje más claro)
//   - Se agregan chips visuales con flecha para el crecimiento

import { ArrowUpRight, ArrowDownRight, Minus, ArrowRight } from "lucide-react"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

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

// ─── Chip de crecimiento: reemplaza los porcentajes vs anterior ─────────────
function ChipCrecimiento({ valor }: { valor: number }) {
  if (valor === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
        <ArrowRight className="w-3 h-3" />
        Sin cambios
      </span>
    )
  }
  if (valor > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
        <ArrowUpRight className="w-3 h-3" />
        +{valor}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5">
      <ArrowDownRight className="w-3 h-3" />
      {valor}
    </span>
  )
}

export function TablaFlujo({ filas }: { filas: FilaMensual[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead className="font-bold text-slate-700 py-3">Mes</TableHead>
            <TableHead className="font-bold text-emerald-700 text-right py-3">Ingresos</TableHead>
            <TableHead className="font-bold text-rose-700 text-right py-3">Cierres</TableHead>
            <TableHead className="font-bold text-slate-700 text-right py-3">Crecimiento</TableHead>
            <TableHead className="font-bold text-blue-700 text-right py-3">Cartera al final</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {filas.map(fila => (
            <TableRow key={fila.key} className="hover:bg-slate-50/50">
              <TableCell className="font-medium text-slate-800 py-2">
                {fila.label}
              </TableCell>

              <TableCell className="text-right py-2">
                <span className="font-semibold text-emerald-700">+{fila.ingresos}</span>
              </TableCell>

              <TableCell className="text-right py-2">
                <span className="font-semibold text-rose-700">
                  {fila.cierres > 0 ? '−' : ''}{fila.cierres}
                </span>
              </TableCell>

              <TableCell className="text-right py-2">
                <ChipCrecimiento valor={fila.balance} />
              </TableCell>

              <TableCell className="text-right py-2">
                <span className="font-bold text-blue-700 font-mono">
                  {fila.carteraAcumulada}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}