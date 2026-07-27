"use client";

import React, { useState } from 'react';
import { Info, Truck, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface CalculatorViewProps {
  setCalculoResult: (result: any | null) => void;
  handleClear: () => void;
}

interface ResultadoLRT {
  articulo:            string;
  descripcionArticulo: string;
  indemnizacionBase:   number;
  adicional26773:      number;
  art11:               number;
  totalFinal:          number;
  coeficienteEdad:     number;
  esMuerte:            boolean;
}

// ─── LÓGICA DE CÁLCULO ────────────────────────────────────────────────────────

/**
 * Ley 24557 + Decreto 1694/09 + Ley 26773
 *
 * Fórmula general:
 *   C = IBM × 53 × (% incapacidad / 100) × (65 / edad)
 *
 * Artículo que aplica (criterio validado contra IusNet):
 *   ≤ 50%          → Art. 14 inc. 2a (IPP leve/moderada)
 *   51% a 66%      → Art. 14 inc. 2b (IPP grave)
 *   ≥ 67%          → Art. 15         (Incapacidad Total — sin factor %)
 *   Muerte         → Art. 18         (sin factor %, = IBM × 53 × 65/edad)
 *
 * Ley 26773 Art. 3: adicional del 20% sobre (base + Art. 11).
 * Validado: aplica tanto "en ocasión" como "in itinere".
 *
 * NOTA: el Art. 11 (prestación adicional de pago único) queda fuera del cálculo:
 * es un monto fijo actualizable por resolución de la SRT, y en IusNet arroja NaN.
 */
function calcularLRT(
  ibm: number,
  edad: number,
  incapacidad: number,
  murio: boolean,
  montoArt11: number,
): ResultadoLRT {
  const coeficienteEdad = 65 / edad;

  let indemnizacionBase: number;
  let articulo: string;
  let descripcionArticulo: string;

  if (murio) {
    // Art. 18 — Muerte del trabajador (sin factor %, como incapacidad total)
    indemnizacionBase   = ibm * 53 * coeficienteEdad;
    articulo            = '18';
    descripcionArticulo = 'Art. 18 Ley 24557 — Muerte del trabajador';
  } else if (incapacidad >= 67) {
    // Art. 15 — Incapacidad Permanente Total (IPT), sin factor %
    indemnizacionBase   = ibm * 53 * coeficienteEdad;
    articulo            = '15';
    descripcionArticulo = 'Art. 15 Ley 24557 — Incapacidad Permanente Total (≥ 67%)';
  } else if (incapacidad > 50) {
    // Art. 14 inc. 2b — IPP grave (> 50% y < 67%)
    indemnizacionBase   = ibm * 53 * (incapacidad / 100) * coeficienteEdad;
    articulo            = '14.2b';
    descripcionArticulo = 'Art. 14° inc. 2b Ley 24557 — Incapacidad Permanente Parcial grave (> 50%)';
  } else {
    // Art. 14 inc. 2a — IPP leve/moderada (≤ 50%)
    indemnizacionBase   = ibm * 53 * (incapacidad / 100) * coeficienteEdad;
    articulo            = '14.2a';
    descripcionArticulo = 'Art. 14° inc. 2a Ley 24557 — Incapacidad Permanente Parcial (≤ 50%)';
  }

  // Art. 11 inc. 4 — prestación adicional de pago único (monto fijo de la SRT,
  // cargado manualmente porque no se deduce de IBM/edad; varía por fecha del siniestro).
  const art11 = montoArt11 || 0;

  // Adicional 20% Ley 26773 (validado: aplica siempre, en ocasión e in itinere).
  // IMPORTANTE: se calcula sobre (base + Art. 11), no solo sobre la base.
  // Validado con IusNet: (344.500.000 + 24.755.211) × 0,20 = 73.851.042,20
  const adicional26773 = (indemnizacionBase + art11) * 0.20;

  const totalFinal = indemnizacionBase + adicional26773 + art11;

  return { articulo, descripcionArticulo, indemnizacionBase, adicional26773, art11, totalFinal, coeficienteEdad, esMuerte: murio };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Formato de miles para el input (1000000 → "1.000.000")
const fmtMiles = (v: number | ''): string =>
  v === '' ? '' : Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 });
const parseMiles = (s: string): number | '' => {
  const limpio = s.replace(/[^0-9]/g, '');
  return limpio === '' ? '' : Number(limpio);
};

function TooltipIcon({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative inline-block">
      <Info
        size={13}
        className="text-slate-400 cursor-help hover:text-slate-600 transition-colors"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      />
      {visible && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </span>
      )}
    </span>
  );
}

function ArticuloBadge({ articulo }: { articulo: string }) {
  const map: Record<string, { label: string; color: string }> = {
    '14.2a': { label: 'Art. 14 inc. 2a — IPP ≤ 50%',        color: 'bg-blue-100 text-blue-700 border-blue-200'   },
    '14.2b': { label: 'Art. 14 inc. 2b — IPP > 50% y < 67%', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    '15':    { label: 'Art. 15 — Incapacidad Total ≥ 67%',    color: 'bg-red-100 text-red-700 border-red-200'       },
    '18':    { label: 'Art. 18 — Muerte del trabajador',      color: 'bg-slate-800 text-white border-slate-800'     },
  };
  const { label, color } = map[articulo] ?? { label: articulo, color: 'bg-slate-100 text-slate-600 border-slate-200' };
  return (
    <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full border ${color}`}>
      {label}
    </span>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function LrtView({ setCalculoResult, handleClear }: CalculatorViewProps) {
  const [formData, setFormData] = useState({
    ibm:                   '' as number | '',
    edad:                  '' as number | '',
    porcentajeIncapacidad: '' as number | '',
    murio:                 false,
    tipoAccidente:         'ocasion' as 'ocasion' | 'itinere',
    montoArt11:            '' as number | '',
  });

  const [resultado, setResultado] = useState<ResultadoLRT | null>(null);
  const [errores, setErrores]     = useState<Record<string, string>>({});
  const [infoOpen, setInfoOpen]   = useState(false);

  // ── Validación ───────────────────────────────────────────────────────────
  const validar = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.ibm || Number(formData.ibm) <= 0)
      errs.ibm = 'Ingrese un IBM válido.';
    if (!formData.edad || Number(formData.edad) <= 0 || Number(formData.edad) >= 65)
      errs.edad = 'La edad debe estar entre 1 y 64 años.';
    // El % de incapacidad solo se exige si NO murió
    if (!formData.murio) {
      if (!formData.porcentajeIncapacidad || Number(formData.porcentajeIncapacidad) <= 0 || Number(formData.porcentajeIncapacidad) > 100)
        errs.incapacidad = 'El porcentaje debe estar entre 1 y 100.';
    }
    setErrores(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Calcular ─────────────────────────────────────────────────────────────
  const handleCalculate = () => {
    if (!validar()) return;

    const res = calcularLRT(
      Number(formData.ibm),
      Number(formData.edad),
      formData.murio ? 100 : Number(formData.porcentajeIncapacidad),
      formData.murio,
      Number(formData.montoArt11) || 0,
    );

    setResultado(res);
    setCalculoResult({
      indemnizacionBase: res.indemnizacionBase + res.art11,
      multas:            res.adicional26773,
      intereses:         0,
      total:             res.totalFinal,
      // ── snapshot para guardar y para PDF futuro ─────────────────────────────
      tipo: 'LRT',
      detalle: {
        // Parámetros de entrada (lo que el abogado cargó)
        parametros: {
          ibm:                   Number(formData.ibm),
          edad:                  Number(formData.edad),
          porcentajeIncapacidad: formData.murio ? null : Number(formData.porcentajeIncapacidad),
          murio:                 formData.murio,
          tipoAccidente:         formData.tipoAccidente,
          montoArt11:            Number(formData.montoArt11) || 0,
        },
        // Resultado completo del cálculo (con artículo aplicado, base, adicional, total)
        resultado: res,
        // Metadata
        calculadoEn: new Date().toISOString(),
        version:     '1.0',
      },
    });
  };
  // ── Limpiar ──────────────────────────────────────────────────────────────
  const handleClearLocal = () => {
    setFormData({
      ibm: '', edad: '', porcentajeIncapacidad: '',
      murio: false, tipoAccidente: 'ocasion', montoArt11: '',
    });
    setResultado(null);
    setErrores({});
    handleClear();
  };

  const setField = (field: keyof typeof formData, value: any) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const FieldError = ({ campo }: { campo: string }) =>
    errores[campo] ? <p className="text-xs text-red-500 mt-1">{errores[campo]}</p> : null;

  // Preview del artículo en tiempo real
  const inc = Number(formData.porcentajeIncapacidad);
  const articuloPreview = formData.murio
    ? '18'
    : inc > 0
      ? inc >= 67 ? '15' : inc > 50 ? '14.2b' : '14.2a'
      : null;

  return (
    <div className="space-y-6">

      {/* ── INGRESO DE DATOS ─────────────────────────────────────────────────── */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck size={18} className="text-slate-600" /> Ingreso de Datos — Accidente LRT
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">

          {/* Info colapsable */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setInfoOpen(!infoOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-blue-50 text-blue-700 text-xs font-medium"
            >
              <span>¿Cómo se calcula? — Ley 24557 + Dec. 1694/09 + Ley 26773</span>
              {infoOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {infoOpen && (
              <div className="px-4 py-3 text-xs text-slate-600 space-y-1 bg-blue-50/40">
                <p><strong>Fórmula:</strong> C = IBM × 53 × (% inc. / 100) × (65 / edad)</p>
                <p><strong>Art. 14 inc. 2a</strong> — IPP ≤ 50%.</p>
                <p><strong>Art. 14 inc. 2b</strong> — IPP entre 51% y 66%.</p>
                <p><strong>Art. 15</strong> — IPT ≥ 67%: sin factor %.</p>
                <p><strong>Art. 18</strong> — Muerte: sin factor % (IBM × 53 × 65/edad).</p>
                <p><strong>Ley 26773 Art. 3</strong> — adicional del 20% sobre la base.</p>
                <p className="text-slate-400 italic pt-1">Valores estimativos. No incluyen intereses ni actualización por índices.</p>
              </div>
            )}
          </div>

          {/* Campos */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                Ingreso Base Mensual — IBM ($)
                <TooltipIcon text="El IBM es el promedio mensual de todos los salarios del último año, incluidas horas extras y bonificaciones." />
              </label>
              <Input
                type="text" inputMode="numeric"
                value={fmtMiles(formData.ibm)}
                onChange={(e) => setField('ibm', parseMiles(e.target.value))}
                placeholder="Ej: 1.000.000"
                className={errores.ibm ? 'border-red-400' : ''}
              />
              <FieldError campo="ibm" />
            </div>

            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                Tipo de Accidente
                <TooltipIcon text="'En ocasión': ocurrido durante la jornada o en el lugar de trabajo. 'In itinere': ocurrido en el trayecto al/desde el trabajo." />
              </label>
              <select
                className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white"
                value={formData.tipoAccidente}
                onChange={(e) => setField('tipoAccidente', e.target.value)}
              >
                <option value="ocasion">En Ocasión del Trabajo</option>
                <option value="itinere">In Itinere (trayecto)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                Edad al momento del accidente
                <TooltipIcon text="Se usa para calcular el coeficiente de edad: 65 / edad. A menor edad, mayor indemnización." />
              </label>
              <Input
                type="number" min={1} max={64}
                value={formData.edad}
                onChange={(e) => setField('edad', e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ej: 35"
                className={errores.edad ? 'border-red-400' : ''}
              />
              <FieldError campo="edad" />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                Porcentaje de Incapacidad (%)
                <TooltipIcon text="Determina el artículo: ≤50% → Art. 14.2a, entre 51-66% → Art. 14.2b, ≥67% → Art. 15. Si el trabajador falleció, no aplica." />
              </label>
              <Input
                type="number" min={1} max={100}
                value={formData.murio ? '' : formData.porcentajeIncapacidad}
                disabled={formData.murio}
                onChange={(e) => setField('porcentajeIncapacidad', e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={formData.murio ? 'No aplica (muerte)' : 'Ej: 15'}
                className={`${errores.incapacidad ? 'border-red-400' : ''} ${formData.murio ? 'bg-slate-100' : ''}`}
              />
              <FieldError campo="incapacidad" />
              {articuloPreview && (
                <div className="pt-1">
                  <ArticuloBadge articulo={articuloPreview} />
                </div>
              )}
            </div>
          </div>

          {/* Muerte del trabajador */}
          <div
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
              ${formData.murio ? 'bg-slate-800 border-slate-800' : 'bg-white border-slate-200 hover:border-slate-300'}`}
            onClick={() => setField('murio', !formData.murio)}
          >
            <input
              type="checkbox"
              checked={formData.murio}
              onChange={(e) => setField('murio', e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="rounded text-slate-600 border-slate-300 focus:ring-slate-400"
            />
            <div>
              <p className={`text-sm font-medium ${formData.murio ? 'text-white' : 'text-slate-700'}`}>
                El trabajador falleció en el accidente
              </p>
              <p className={`text-xs ${formData.murio ? 'text-slate-300' : 'text-slate-400'}`}>
                Aplica Art. 18 (sin porcentaje de incapacidad).
              </p>
            </div>
          </div>

          {/* Art. 11 — prestación de pago único (opcional, casos graves) */}
          {(formData.murio || Number(formData.porcentajeIncapacidad) >= 50) && (
            <div className="space-y-1 p-3 rounded-lg border border-slate-200 bg-slate-50">
              <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                Art. 11 — Prestación de pago único (opcional)
                <TooltipIcon text="Compensación de pago único de la Ley 24.557 para casos graves (incapacidad ≥50%, gran invalidez o muerte). Es un monto fijo establecido por resolución de la SRT — cargalo según el valor vigente. Si no aplica, dejalo vacío." />
              </label>
              <Input
                type="text" inputMode="numeric"
                value={fmtMiles(formData.montoArt11)}
                onChange={(e) => setField('montoArt11', parseMiles(e.target.value))}
                placeholder="Monto vigente (resolución SRT) — opcional"
                className="bg-white"
              />
              <p className="text-[11px] text-slate-400">
                Monto fijo según resolución de la SRT. No se deduce del cálculo; cargalo si corresponde.
              </p>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-2">
            <Button onClick={handleCalculate} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white">
              Calcular Indemnización
            </Button>
            <Button onClick={handleClearLocal} variant="outline" className="text-slate-600 border-slate-300" size="icon">
              <RotateCcw size={16} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── RESULTADOS ───────────────────────────────────────────────────────── */}
      {resultado && (
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-3">
            <CardTitle className="text-base text-slate-700 flex items-center justify-between flex-wrap gap-2">
              <span>Desglose LRT</span>
              <ArticuloBadge articulo={resultado.articulo} />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-4 py-3 text-left">Rubro</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">

                {/* Detalle de la fórmula */}
                <tr className="bg-slate-50/40">
                  <td className="px-4 py-2 text-xs text-slate-400 italic" colSpan={2}>
                    {(resultado.articulo === '15' || resultado.articulo === '18')
                      ? `IBM × 53 × (65 / edad) = ${fmt(Number(formData.ibm))} × 53 × ${resultado.coeficienteEdad.toFixed(4)}`
                      : `IBM × 53 × (${formData.porcentajeIncapacidad}% / 100) × (65 / edad) = ${fmt(Number(formData.ibm))} × 53 × ${(Number(formData.porcentajeIncapacidad) / 100).toFixed(2)} × ${resultado.coeficienteEdad.toFixed(4)}`
                    }
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 font-medium text-slate-700">{resultado.descripcionArticulo}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(resultado.indemnizacionBase)}</td>
                </tr>

                {resultado.adicional26773 > 0 && (
                  <tr className="text-amber-700 bg-amber-50/50">
                    <td className="px-4 py-3 font-medium">Adicional 20% — Art. 3° Ley 26773</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(resultado.adicional26773)}</td>
                  </tr>
                )}

                {resultado.art11 > 0 && (
                  <tr className="text-slate-700 bg-slate-50/50">
                    <td className="px-4 py-3 font-medium">Art. 11 — Prestación de pago único</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(resultado.art11)}</td>
                  </tr>
                )}

                <tr className="bg-slate-900 text-white border-t-2 border-slate-700">
                  <td className="px-4 py-4 font-bold text-lg">TOTAL LRT ESTIMADO</td>
                  <td className="px-4 py-4 text-right font-bold text-lg font-mono">{fmt(resultado.totalFinal)}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-[11px] text-slate-400 px-4 py-3 italic">
              * Valores estimativos. No incluyen intereses ni actualización por RIPTE. El Art. 11 (pago único) se carga manualmente según la resolución vigente de la SRT. Sujetos a criterio judicial.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}