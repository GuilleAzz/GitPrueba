'use client'

// components/HistorialMontoLista.tsx
//
// Se muestra en el tab Resumen del expediente, DEBAJO del monto vigente
// dentro de la sección "Información Financiera".
//
// Es un listado en gris con los montos anteriores, motivo y autor.
// El monto vigente NO se repite acá (ya se muestra arriba en la sección).

import { useEffect, useState } from "react"
import { History, ChevronDown, ChevronUp, Sparkles, PencilLine } from "lucide-react"
import { getHistorialMontoDeCaso, type HistorialMontoItem } from "src/lib/actions/historial-monto-actions"

const fmtMoneda = (montoString: string) => {
  const num = parseFloat(montoString)
  if (isNaN(num)) return "—"
  return num.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

export function HistorialMontoLista({ casoId }: { casoId: string }) {
  const [historial, setHistorial] = useState<HistorialMontoItem[] | null>(null)
  const [expandido, setExpandido] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    getHistorialMontoDeCaso(casoId)
      .then(r => { if (!cancelado) setHistorial(r) })
      .catch(err => {
        console.error("Error cargando historial de monto:", err)
        if (!cancelado) setHistorial([])
      })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [casoId])

  // Loading: mostramos un placeholder minimalista
  if (loading) {
    return (
      <div className="mt-3 text-xs text-slate-400 italic">
        Cargando historial de montos...
      </div>
    )
  }

  // Sin historial: no mostramos nada (el caso puede no tener montoDisputa)
  if (!historial || historial.length === 0) return null

  // El primer item es el vigente (más reciente). Los anteriores son los históricos.
  // Como el monto vigente ya se muestra arriba en Información Financiera,
  // sólo mostramos los ANTERIORES (del índice 1 en adelante).
  const anteriores = historial.slice(1)

  // Si solo hay un item (el vigente), no hay historial que mostrar
  if (anteriores.length === 0) {
    return (
      <div className="mt-3 text-[11px] text-slate-400 italic flex items-center gap-1">
        <History className="w-3 h-3" />
        Sin modificaciones previas del monto.
      </div>
    )
  }

  // Cantidad a mostrar cuando está colapsado
  const LIMITE_COLAPSADO = 3
  const mostrar = expandido ? anteriores : anteriores.slice(0, LIMITE_COLAPSADO)
  const hayOcultos = anteriores.length > LIMITE_COLAPSADO

  return (
    <div className="mt-3 pt-3 border-t border-slate-200">

      {/* Header del historial */}
      <div className="flex items-center gap-2 mb-2">
        <History className="w-3.5 h-3.5 text-slate-400" />
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Historial del monto
        </h4>
        <span className="text-[10px] text-slate-400">
          ({anteriores.length} {anteriores.length === 1 ? "cambio anterior" : "cambios anteriores"})
        </span>
      </div>

      {/* Timeline en gris */}
      <ul className="space-y-2">
        {mostrar.map((h) => (
          <li key={h.id} className="flex items-start gap-2 text-xs">
            {/* Ícono según sea inicial o modificación */}
            <div className="mt-0.5 shrink-0">
              {h.esInicial ? (
                <Sparkles className="w-3 h-3 text-slate-400" />
              ) : (
                <PencilLine className="w-3 h-3 text-slate-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* Monto anterior + fecha */}
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-mono font-semibold text-slate-600">
                  {fmtMoneda(h.monto)}
                </span>
                <span className="text-[10px] text-slate-400">
                  · {fmtFecha(h.fechaCambio)}
                </span>
                {h.esInicial && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium uppercase tracking-wider">
                    Inicial
                  </span>
                )}
              </div>

              {/* Motivo */}
              <p className="text-[11px] text-slate-500 italic mt-0.5 leading-relaxed">
                &ldquo;{h.motivo}&rdquo;
              </p>

              {/* Autor */}
              <p className="text-[10px] text-slate-400 mt-0.5">
                {h.registradoPor.nombre} {h.registradoPor.apellido}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {/* Botón para expandir / colapsar si hay más de LIMITE_COLAPSADO */}
      {hayOcultos && (
        <button
          onClick={() => setExpandido(v => !v)}
          className="mt-2 text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1 underline-offset-2 hover:underline"
        >
          {expandido ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Ocultar cambios más antiguos
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Ver {anteriores.length - LIMITE_COLAPSADO} cambios más antiguos
            </>
          )}
        </button>
      )}
    </div>
  )
}