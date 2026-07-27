"use client";
 
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCcw, Info, Scale } from 'lucide-react';
 
// ─── TIPOS ────────────────────────────────────────────────────────────────────
 
interface CalculatorViewProps {
  setCalculoResult: (result: any | null) => void;
  handleClear: () => void;
}
 
interface ResultadoFormula {
  a: number;
  n: number;
  i: number;
  vn: number;
  capital: number;
}
 
// ─── FÓRMULAS ─────────────────────────────────────────────────────────────────
 
// Vⁿ = 1 / (1 + i)^n   →   igual en los 3 métodos
// C  = a × (1 − Vⁿ) / i →   igual en los 3 métodos
 
/**
 * VUOTTO
 *  a  = salario × 13 × (incapacidad / 100)
 *  n  = 65 − edad
 *  i  = 0,06
 */
function calcularVuotto(salario: number, edad: number, incapacidad: number): ResultadoFormula {
  const i  = 0.06;
  const a  = salario * 13 * (incapacidad / 100);
  const n  = 65 - edad;
  const vn = 1 / Math.pow(1 + i, n);
  const capital = a * (1 - vn) / i;
  return { a, n, i, vn, capital };
}
 
/**
 * MÉNDEZ
 *  a  = salario × (60 / edad) × 13 × (incapacidad / 100)
 *  n  = 75 − edad
 *  i  = 0,04
 */
function calcularMendez(salario: number, edad: number, incapacidad: number): ResultadoFormula {
  const i  = 0.04;
  const a  = salario * (60 / edad) * 13 * (incapacidad / 100);
  const n  = 75 - edad;
  const vn = 1 / Math.pow(1 + i, n);
  const capital = a * (1 - vn) / i;
  return { a, n, i, vn, capital };
}
 
/**
 * VERGARA
 *  a  = salario × (70 / edad) × 13 × (incapacidad / 100)
 *  n  = 77 − edad
 *  i  = 0,04
 */
function calcularVergara(salario: number, edad: number, incapacidad: number): ResultadoFormula {
  const i  = 0.04;
  const a  = salario * (70 / edad) * 13 * (incapacidad / 100);
  const n  = 77 - edad;
  const vn = 1 / Math.pow(1 + i, n);
  const capital = a * (1 - vn) / i;
  return { a, n, i, vn, capital };
}
 
// ─── TOOLTIPS ─────────────────────────────────────────────────────────────────
 
// ─── HELPERS DE FORMATO ───────────────────────────────────────────────────────

// Muestra el número con separador de miles (1000000 → "1.000.000")
const fmtMiles = (v: number | ''): string =>
  v === '' ? '' : Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 });
const parseMiles = (s: string): number | '' => {
  const limpio = s.replace(/[^0-9]/g, '');
  return limpio === '' ? '' : Number(limpio);
};

const TOOLTIPS: Record<string, Record<string, string>> = {
  vuotto: {
    vn: 'Vⁿ = 1 / (1 + i)ⁿ — Factor de descuento: cuánto vale hoy $1 dentro de n años.',
    a:  'a = Salario × 13 × (% Incapacidad / 100) — Renta anual afectada.',
    n:  'n = 65 − Edad — Años de vida laboral restantes hasta la jubilación.',
    i:  'i = 6% (0,06) — Tasa de interés aplicada por la fórmula Vuotto.',
    c:  'C = a × (1 − Vⁿ) / i — Capital indemnizatorio resultante.',
  },
  mendez: {
    vn: 'Vⁿ = 1 / (1 + i)ⁿ — Factor de descuento: cuánto vale hoy $1 dentro de n años.',
    a:  'a = Salario × (60 / Edad) × 13 × (% Incapacidad / 100) — Renta anual con factor de edad Méndez.',
    n:  'n = 75 − Edad — Años de vida laboral restantes según Méndez.',
    i:  'i = 4% (0,04) — Tasa de interés aplicada por la fórmula Méndez.',
    c:  'C = a × (1 − Vⁿ) / i — Capital indemnizatorio resultante.',
  },
  vergara: {
    vn: 'Vⁿ = 1 / (1 + i)ⁿ — Factor de descuento: cuánto vale hoy $1 dentro de n años.',
    a:  'a = Salario × (70 / Edad) × 13 × (% Incapacidad / 100) — Renta anual con factor de edad Vergara.',
    n:  'n = 77 − Edad — Años de vida laboral restantes según Vergara.',
    i:  'i = 4% (0,04) — Tasa de interés aplicada por la fórmula Vergara.',
    c:  'C = a × (1 − Vⁿ) / i — Capital indemnizatorio resultante.',
  },
};
 
// ─── TOOLTIP ICON ─────────────────────────────────────────────────────────────
 
function TooltipIcon({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative inline-block">
      <Info
        size={14}
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
 
// ─── TARJETA DE FÓRMULA ───────────────────────────────────────────────────────
 
const COLOR_MAP = {
  blue:   { border: 'border-blue-200',   header: 'bg-blue-50',   title: 'text-blue-800',   capital: 'bg-blue-100 text-blue-900',   badge: 'bg-blue-600' },
  green:  { border: 'border-green-200',  header: 'bg-green-50',  title: 'text-green-800',  capital: 'bg-green-100 text-green-900', badge: 'bg-green-600' },
  purple: { border: 'border-purple-200', header: 'bg-purple-50', title: 'text-purple-800', capital: 'bg-purple-100 text-purple-900',badge: 'bg-purple-600' },
};
 
interface FormulaCardProps {
  titulo: string;
  color: 'blue' | 'green' | 'purple';
  resultado: ResultadoFormula | null;
  tooltips: Record<string, string>;
}
 
function FormulaCard({ titulo, color, resultado, tooltips }: FormulaCardProps) {
  const c = COLOR_MAP[color];
 
  const Row = ({ label, value, tooltipKey }: { label: string; value: number | null; tooltipKey: string }) => (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs font-bold text-slate-500 uppercase">
        {label} <TooltipIcon text={tooltips[tooltipKey]} />
      </div>
      <div className="h-8 bg-slate-100 rounded px-3 flex items-center text-sm font-mono text-slate-700">
        {value !== null
          ? value.toLocaleString('es-AR', { maximumFractionDigits: 4 })
          : <span className="text-slate-300">—</span>
        }
      </div>
    </div>
  );
 
  return (
    <div className={`border ${c.border} rounded-xl overflow-hidden flex flex-col`}>
      <div className={`${c.header} px-4 py-3 border-b ${c.border}`}>
        <h4 className={`font-bold text-sm ${c.title} uppercase tracking-wide`}>{titulo}</h4>
      </div>
 
      <div className="p-4 space-y-3 flex-1">
        <Row label="Vⁿ" value={resultado?.vn   ?? null} tooltipKey="vn" />
        <Row label="a"  value={resultado?.a    ?? null} tooltipKey="a"  />
        <Row label="n"  value={resultado?.n    ?? null} tooltipKey="n"  />
 
        {/* Tasa i con badge */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs font-bold text-slate-500 uppercase">
            i <TooltipIcon text={tooltips['i']} />
          </div>
          <div className="h-8 bg-slate-100 rounded px-3 flex items-center justify-between text-sm font-mono text-slate-700">
            <span>{resultado !== null ? `${(resultado.i * 100).toFixed(0)}%` : <span className="text-slate-300">—</span>}</span>
            {resultado !== null && (
              <span className={`text-xs text-white ${c.badge} px-2 py-0.5 rounded-full font-bold`}>
                {(resultado.i * 100).toFixed(0)}%
              </span>
            )}
          </div>
        </div>
      </div>
 
      {/* Capital */}
      <div className={`${c.capital} px-4 py-3 border-t ${c.border}`}>
        <div className="flex items-center gap-1 text-xs font-bold uppercase mb-1">
          C (Capital) <TooltipIcon text={tooltips['c']} />
        </div>
        <p className="text-lg font-bold font-mono">
          {resultado !== null
            ? `$${resultado.capital.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
            : <span className="text-slate-300 text-base font-normal">Ingrese datos y calcule</span>
          }
        </p>
      </div>
    </div>
  );
}
 
// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
 
export default function CapitalizacionView({ setCalculoResult, handleClear }: CalculatorViewProps) {
  const [hasCalculated, setHasCalculated] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
 
  const [formData, setFormData] = useState({
    remuneracion: '' as number | '',
    edad:         '' as number | '',
    incapacidad:  '' as number | '',
  });
 
  const [resultados, setResultados] = useState<{
    vuotto:  ResultadoFormula | null;
    mendez:  ResultadoFormula | null;
    vergara: ResultadoFormula | null;
  }>({ vuotto: null, mendez: null, vergara: null });
 
  // ── Validación ───────────────────────────────────────────────────────────────
  const validar = (): boolean => {
    const errs: Record<string, string> = {};
    const { remuneracion, edad, incapacidad } = formData;
 
    if (remuneracion === '' || Number(remuneracion) <= 0)
      errs.remuneracion = 'Ingrese una remuneración válida.';
    if (edad === '' || Number(edad) <= 0 || Number(edad) >= 65)
      errs.edad = 'La edad debe estar entre 1 y 64 años.';
    if (incapacidad === '' || Number(incapacidad) <= 0 || Number(incapacidad) > 100)
      errs.incapacidad = 'El porcentaje debe estar entre 1 y 100.';
 
    setErrores(errs);
    return Object.keys(errs).length === 0;
  };
 
  // ── Calcular ──────────────────────────────────────────────────────────────────
const handleCalculate = () => {
    if (!validar()) return;
 
    const sal  = Number(formData.remuneracion);
    const edad = Number(formData.edad);
    const inc  = Number(formData.incapacidad);
 
    const vuotto  = calcularVuotto(sal, edad, inc);
    const mendez  = calcularMendez(sal, edad, inc);
    const vergara = calcularVergara(sal, edad, inc);
 
    setResultados({ vuotto, mendez, vergara });
    setHasCalculated(true);
 
    const mayorCapital = Math.max(vuotto.capital, mendez.capital, vergara.capital);
    // Identificar qué fórmula dio el capital mayor (para mostrarlo en el detalle/PDF)
    const formulaMayor =
      vuotto.capital  === mayorCapital ? 'VUOTTO'  :
      mendez.capital  === mayorCapital ? 'MENDEZ'  :
                                          'VERGARA';

    setCalculoResult({
      indemnizacionBase: mayorCapital,
      multas: 0,
      total: mayorCapital,
      // ── snapshot para guardar y para PDF futuro ─────────────────────────────
      tipo: 'CAPITALIZACION',
      detalle: {
        // Parámetros de entrada
        parametros: {
          remuneracion: sal,
          edad:         edad,
          incapacidad:  inc,
        },
        // Resultado completo: las TRES fórmulas con sus componentes
        resultados: {
          vuotto,
          mendez,
          vergara,
        },
        // Resumen comparativo: cuál ganó y por cuánto
        comparativa: {
          mayorCapital,
          formulaMayor,
        },
        // Metadata
        calculadoEn: new Date().toISOString(),
        version:     '1.0',
      },
    });
  };
 
  // ── Limpiar ───────────────────────────────────────────────────────────────────
  const handleClearLocal = () => {
    setFormData({ remuneracion: '', edad: '', incapacidad: '' });
    setResultados({ vuotto: null, mendez: null, vergara: null });
    setHasCalculated(false);
    setErrores({});
    handleClear();
  };
 
  const setField = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value === '' ? '' : Number(value) }));
    if (errores[field]) setErrores(prev => ({ ...prev, [field]: '' }));
  };
    const setFieldNum = (field: keyof typeof formData, value: number | '') => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errores[field]) setErrores(prev => ({ ...prev, [field]: '' }));
  };
 
  const FieldError = ({ campo }: { campo: string }) =>
    errores[campo] ? <p className="text-xs text-red-500 mt-1">{errores[campo]}</p> : null;
 
  return (
    <div className="space-y-6">
 
      {/* ── INGRESO DE DATOS ──────────────────────────────────────────────────── */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Scale size={18} className="text-slate-600" />
            Ingreso de Datos — Fórmulas de Capitalización
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
 
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-xs text-blue-700 font-medium">
            ℹ️ Estos valores son estimativos y pueden no ser exactos.
          </div>
 
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-500 uppercase">
                Remuneración Mensual ($)
              </label>
              <Input
                type="text"
                inputMode="numeric"
                value={fmtMiles(formData.remuneracion)}
                onChange={(e) => setFieldNum('remuneracion', parseMiles(e.target.value))}
                placeholder="Ej: 1.000.000"
                className={errores.remuneracion ? 'border-red-400 focus-visible:ring-red-400' : ''}
              />
              <FieldError campo="remuneracion" />
            </div>
 
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-500 uppercase">
                Edad al momento del daño
              </label>
              <Input
                type="number"
                min={1}
                max={64}
                value={formData.edad}
                onChange={(e) => setField('edad', e.target.value)}
                placeholder="Ej: 40"
                className={errores.edad ? 'border-red-400 focus-visible:ring-red-400' : ''}
              />
              <FieldError campo="edad" />
            </div>
 
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-500 uppercase">
                Porcentaje de Incapacidad (%)
              </label>
              <Input
                type="number"
                min={1}
                max={100}
                value={formData.incapacidad}
                onChange={(e) => setField('incapacidad', e.target.value)}
                placeholder="Ej: 30"
                className={errores.incapacidad ? 'border-red-400 focus-visible:ring-red-400' : ''}
              />
              <FieldError campo="incapacidad" />
            </div>
          </div>
 
          <div className="pt-2 flex gap-2">
            <Button onClick={handleCalculate} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white">
              Comparar y Calcular
            </Button>
            <Button onClick={handleClearLocal} variant="outline" className="text-slate-600 border-slate-300" size="icon" title="Limpiar">
              <RotateCcw size={16} />
            </Button>
          </div>
        </CardContent>
      </Card>
 
      {/* ── TARJETAS ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormulaCard titulo="Cálculo según Vuotto"  color="blue"   resultado={resultados.vuotto}  tooltips={TOOLTIPS.vuotto}  />
        <FormulaCard titulo="Cálculo según Méndez"  color="green"  resultado={resultados.mendez}  tooltips={TOOLTIPS.mendez}  />
        <FormulaCard titulo="Cálculo según Vergara" color="purple" resultado={resultados.vergara} tooltips={TOOLTIPS.vergara} />
      </div>
 
      {/* ── TABLA COMPARATIVA ─────────────────────────────────────────────────── */}
      {hasCalculated && resultados.vuotto && resultados.mendez && resultados.vergara && (
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-3">
            <CardTitle className="text-base text-slate-700">Comparativa de Capitales</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-4 py-3">Fórmula</th>
                  <th className="px-4 py-3 text-right">a (Renta anual)</th>
                  <th className="px-4 py-3 text-right">n (Años)</th>
                  <th className="px-4 py-3 text-right">i (Tasa)</th>
                  <th className="px-4 py-3 text-right">Vⁿ</th>
                  <th className="px-4 py-3 text-right font-bold">Capital (C)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {([
                  { label: 'Vuotto',  key: 'vuotto',  color: 'text-blue-700'   },
                  { label: 'Méndez',  key: 'mendez',  color: 'text-green-700'  },
                  { label: 'Vergara', key: 'vergara', color: 'text-purple-700' },
                ] as const).map(({ label, key, color }) => {
                  const r = resultados[key]!;
                  const mayorCapital = Math.max(
                    resultados.vuotto!.capital,
                    resultados.mendez!.capital,
                    resultados.vergara!.capital,
                  );
                  const esMayor = r.capital === mayorCapital;
                  return (
                    <tr key={key} className={esMayor ? 'bg-slate-50 font-semibold' : ''}>
                      <td className={`px-4 py-3 font-bold ${color}`}>
                        {label}
                        {esMayor && (
                          <span className="ml-2 text-[10px] bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-medium">
                            Mayor
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        ${r.a.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{r.n}</td>
                      <td className="px-4 py-3 text-right font-mono">{(r.i * 100).toFixed(0)}%</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {r.vn.toLocaleString('es-AR', { maximumFractionDigits: 6 })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        ${r.capital.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}