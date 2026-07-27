"use client";

import React, { useState } from 'react';
import { RotateCcw, Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── TIPOS ────────────────────────────────────────────────────────────────────

interface CalculatorViewProps {
  setCalculoResult: (result: any | null) => void;
  handleClear: () => void;
}

interface Multas {
  ley24013_art8:  boolean;
  ley24013_art9:  boolean;
  ley24013_art10: boolean;
  ley24013_art15: boolean;
  ley25323_art45: boolean; // Art. 45 / 80 LCT — certificado de trabajo
  ley25323_art1:  boolean;
  ley25323_art2:  boolean;
}

interface ResultadoDespido {
  antiguedadAnios:          number;
  diasVacAntiguedad:        number;
  // Liquidación final
  proporcionalMes:          number;
  sacProporcional:          number;
  vacacionesProporcionales: number;
  sacVacacionesProp:        number;
  vacacionesNoGozadas:      number;
  sacVacacionesNoGozadas:   number;
  sueldosAdeudados:         number;
  subtotalLiquidacion:      number;
  // Indemnización
  indemnizacionAntiguedad:  number;
  preaviso:                 number;
  sacPreaviso:              number;
  integracionMes:           number;
  sacIntegracion:           number;
  subtotalIndemnizacion:    number;
  dobleIndemnizacion:       number;
  // Multas
  multa24013_art8:          number;
  multa24013_art9:          number;
  multa24013_art10:         number;
  multa24013_art15:         number;
  multa25323_art45:         number;
  multa25323_art1:          number;
  multa25323_art2:          number;
  totalMultas:              number;
  // Totales
  totalSinMultas:           number;
  total:                    number;
}

// ─── LÓGICA DE CÁLCULO ────────────────────────────────────────────────────────

/**
 * Antigüedad según LCT Art. 245:
 * fracción mayor a 3 meses se computa como año completo.
 */
function calcularAntiguedad(fechaIngreso: Date, fechaEgreso: Date): number {
  let anios = fechaEgreso.getFullYear() - fechaIngreso.getFullYear();
  let meses = fechaEgreso.getMonth() - fechaIngreso.getMonth();
  let dias  = fechaEgreso.getDate()  - fechaIngreso.getDate();

  if (dias < 0)  meses--;
  if (meses < 0) { anios--; meses += 12; }

  // Fracción > 3 meses → año completo (Art. 245)
  if (meses > 3 || (meses === 3 && dias > 0)) anios++;

  return Math.max(anios, 1);
}

/** Meses totales trabajados (para multas Ley 24013, art. 8). */
function mesesTotales(fechaIngreso: Date, fechaEgreso: Date): number {
  const anios = fechaEgreso.getFullYear() - fechaIngreso.getFullYear();
  const meses = fechaEgreso.getMonth() - fechaIngreso.getMonth();
  return anios * 12 + meses;
}

/**
 * Meses para art. 9 y 10: cuenta el mes en curso como completo si el día final
 * es mayor al día inicial (criterio de IusNet — el período devengado incluye
 * el mes que está corriendo). Validado: 01/01/2020 → 17/09/2024 = 57 meses.
 */
function mesesDevengados(desde: Date, hasta: Date): number {
  let m = (hasta.getFullYear() - desde.getFullYear()) * 12 + (hasta.getMonth() - desde.getMonth());
  if (hasta.getDate() >= desde.getDate()) m++; // mes en curso cuenta como completo
  return Math.max(0, m);
}

/** Días de vacaciones por antigüedad (Art. 150 LCT). */
function diasVacaciones(anios: number): number {
  if (anios < 5)  return 14;
  if (anios < 10) return 21;
  if (anios < 20) return 28;
  return 35;
}

/**
 * Calcula la liquidación final por despido replicando el criterio de IusNet.
 *
 * Validado contra IusNet con el caso:
 *   salario 100.000, ingreso 01/01/2020, egreso 30/06/2025, sin preaviso.
 *
 * NOTA (Franco): el SAC de cualquier rubro se calcula como (rubro / 12).
 */
function calcularDespido(
  salario: number,
  fechaIngresoStr: string,
  fechaEgresoStr: string,
  sinPreaviso: boolean,
  diasVacNoGozadas: number,
  cantSueldosAdeudados: number,
  aplicarDoble: boolean,
  multas: Multas,
  fechaFalsaStr: string,
  porcentajeAgravamiento: number,
): ResultadoDespido {
  const fi = new Date(fechaIngresoStr + 'T00:00:00');
  const fe = new Date(fechaEgresoStr  + 'T00:00:00');

  const antiguedadAnios   = calcularAntiguedad(fi, fe);
  const diasVacAntiguedad = diasVacaciones(antiguedadAnios);

  // Preaviso automático según antigüedad (Art. 231 LCT):
  // hasta 5 años → 1 mes; más de 5 años → 2 meses (como IusNet).
  const mesesPreaviso = antiguedadAnios > 5 ? 2 : 1;

  // ── LIQUIDACIÓN FINAL ──────────────────────────────────────────────────────

  // Proporcional mes trabajado: días trabajados del mes de egreso
  // IusNet: (salario/30) × (díaDeEgreso - 1)  → al 30/06 da 29 días = 96.666,67
  const proporcionalMes = (salario / 30) * (fe.getDate() - 1);

  // SAC proporcional: medio sueldo proporcional a los días del semestre.
  // IusNet cuenta el semestre completo como 182 días → al 30/06 da medio sueldo justo.
  const mesEgreso      = fe.getMonth();
  const inicioSemestre = mesEgreso < 6 ? new Date(fe.getFullYear(), 0, 1) : new Date(fe.getFullYear(), 6, 1);
  const diasSemestre   = Math.round((fe.getTime() - inicioSemestre.getTime()) / 86400000) + 1;
  const sacProporcional = (salario / 2) * (Math.min(diasSemestre, 182) / 182);

  // Vacaciones proporcionales: (salario/25) × díasVac × (díasAño / 365)
  const inicioAnio = new Date(fe.getFullYear(), 0, 1);
  const diasAnio   = Math.round((fe.getTime() - inicioAnio.getTime()) / 86400000);
  const vacacionesProporcionales = (salario / 25) * diasVacAntiguedad * (diasAnio / 365);

  // SAC de las vacaciones proporcionales = rubro / 12
  const sacVacacionesProp = vacacionesProporcionales / 12;

  // Vacaciones no gozadas (input manual): cantidad de días × (salario/25)
  const vacacionesNoGozadas = diasVacNoGozadas * (salario / 25);
  // SAC de vacaciones no gozadas: IusNet usa (salario/2) × (díasNoGozados/180).
  // Validado: salario 1.000.000, 10 días → 27.777,78
  const sacVacacionesNoGozadas = (salario / 2) * (diasVacNoGozadas / 180);

  // Sueldos adeudados (input manual): cantidad × salario
  const sueldosAdeudados = cantSueldosAdeudados * salario;

  const subtotalLiquidacion =
    proporcionalMes + sacProporcional + vacacionesProporcionales + sacVacacionesProp +
    vacacionesNoGozadas + sacVacacionesNoGozadas + sueldosAdeudados;

  // ── INDEMNIZACIÓN ──────────────────────────────────────────────────────────

  // Art. 245: salario × años (la fracción >3 meses ya está contemplada)
  const indemnizacionAntiguedad = salario * antiguedadAnios;

  // Sustitutiva de preaviso (solo si no se dio preaviso)
  const preaviso    = sinPreaviso ? salario * mesesPreaviso : 0;
  const sacPreaviso = preaviso / 12;

  // Integración mes de despido (Art. 233): días que faltan para terminar el mes.
  // IusNet incluye el propio día del despido → al 30/06 computa 1 día = salario/30.
  const ultimoDiaMes  = new Date(fe.getFullYear(), fe.getMonth() + 1, 0).getDate();
  const diasRestantes = (ultimoDiaMes - fe.getDate()) + 1; // +1: incluye el día del egreso
  const integracionMes = sinPreaviso ? (salario / 30) * diasRestantes : 0;
  const sacIntegracion = integracionMes / 12;

  const subtotalIndemnizacion =
    indemnizacionAntiguedad + preaviso + sacPreaviso + integracionMes + sacIntegracion;

  // Agravamiento Art. 245 bis (Ley 27.742 / Ley Bases 2024):
  // recargo por despido discriminatorio sobre la indemnización por antigüedad.
  // Piso 50% (discriminación probada), tope 100% (gravedad mayor, a criterio del juez).
  // Reemplaza la "doble indemnización" de emergencia, ya no vigente.
  const dobleIndemnizacion = aplicarDoble
    ? indemnizacionAntiguedad * (porcentajeAgravamiento / 100)
    : 0;

  // ── MULTAS ──────────────────────────────────────────────────────────────────
  const meses = mesesTotales(fi, fe);

  // Ley 24013: base = salario × meses × 25%
  const multa24013_art8  = multas.ley24013_art8  ? salario * meses * 0.25 : 0;

  // Art. 9 y 10 — dependen de la fecha de ingreso falsa consignada por el empleador.
  // Validado contra IusNet (salario 1.000.000, ingreso 01/01/2020, egreso 30/06/2025):
  //   Art. 9  = salario × meses(ingresoReal → fechaFalsa) × 0,25  (período ocultado)
  //   Art. 10 = salario × meses(fechaFalsa → egreso)      × 0,25  (período restante)
  // NOTA: IusNet arroja valores negativos si la fecha falsa cae fuera del período
  // real de trabajo. Acá se valida con Math.max(0, ...) para evitar ese error.
  let multa24013_art9 = 0;
  let multa24013_art10 = 0;
  if ((multas.ley24013_art9 || multas.ley24013_art10) && fechaFalsaStr) {
    const ff = new Date(fechaFalsaStr + 'T00:00:00');
    // Art. 9: período ocultado, cuenta el mes en curso como completo (57 meses en el caso validado).
    const mesesOcultados = mesesDevengados(fi, ff);
    // Art. 10: período restante. El mes en curso ya lo contó el art. 9, así que
    // se cuenta truncado para no solapar (9 meses en el caso validado).
    const mesesRestantes = mesesTotales(ff, fe);
    multa24013_art9  = multas.ley24013_art9  ? salario * mesesOcultados * 0.25 : 0;
    multa24013_art10 = multas.ley24013_art10 ? salario * Math.max(0, mesesRestantes) * 0.25 : 0;
  }

  // Art. 15: suma de indemnización por antigüedad + preaviso + integración
  const baseArt15        = indemnizacionAntiguedad + preaviso + integracionMes;
  const multa24013_art15 = multas.ley24013_art15 ? baseArt15 : 0;

  // Ley 25323
  // Art. 45 / 80 LCT: 3 sueldos (no entrega de certificado de trabajo)
  const multa25323_art45 = multas.ley25323_art45 ? salario * 3 : 0;
  // Art. 1: duplica la indemnización del Art. 245
  const multa25323_art1  = multas.ley25323_art1 ? indemnizacionAntiguedad : 0;
  // Art. 2: 50% de (antigüedad + preaviso + integración)
  const multa25323_art2  = multas.ley25323_art2 ? baseArt15 * 0.5 : 0;

  const totalMultas =
    multa24013_art8 + multa24013_art9 + multa24013_art10 + multa24013_art15 +
    multa25323_art45 + multa25323_art1 + multa25323_art2;

  const totalSinMultas = subtotalLiquidacion + subtotalIndemnizacion + dobleIndemnizacion;
  const total = totalSinMultas + totalMultas;

  return {
    antiguedadAnios, diasVacAntiguedad,
    proporcionalMes, sacProporcional, vacacionesProporcionales, sacVacacionesProp,
    vacacionesNoGozadas, sacVacacionesNoGozadas, sueldosAdeudados, subtotalLiquidacion,
    indemnizacionAntiguedad, preaviso, sacPreaviso, integracionMes, sacIntegracion,
    subtotalIndemnizacion, dobleIndemnizacion,
    multa24013_art8, multa24013_art9, multa24013_art10, multa24013_art15,
    multa25323_art45, multa25323_art1, multa25323_art2, totalMultas,
    totalSinMultas, total,
  };
}

// ─── HELPERS UI ───────────────────────────────────────────────────────────────

const fmt = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Muestra un número con separador de miles en el input (1000000 → "1.000.000")
const fmtMiles = (v: number | ''): string =>
  v === '' ? '' : Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 });

// Extrae el número de un texto con puntos de miles ("1.000.000" → 1000000)
const parseMiles = (s: string): number | '' => {
  const limpio = s.replace(/[^0-9]/g, '');
  return limpio === '' ? '' : Number(limpio);
};

function CheckRow({
  label, sublabel, checked, onChange, monto, disabled,
}: {
  label: string; sublabel?: string; checked: boolean;
  onChange: (v: boolean) => void; monto: number; disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border transition-colors
        ${disabled ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200'
          : checked ? 'bg-red-50 border-red-200 cursor-pointer' : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'}`}
      onClick={() => !disabled && onChange(!checked)}
    >
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="rounded text-red-500 border-slate-300 focus:ring-red-400"
        />
        <div>
          <p className="text-sm font-medium text-slate-700">{label}</p>
          {sublabel && <p className="text-xs text-slate-400">{sublabel}</p>}
        </div>
      </div>
      {checked && monto > 0 && (
        <span className="text-sm font-bold text-red-600 font-mono">{fmt(monto)}</span>
      )}
    </div>
  );
}

function Fila({ label, monto, indent }: { label: string; monto: number; indent?: boolean }) {
  return (
    <tr>
      <td className={`px-4 py-2.5 text-slate-700 ${indent ? 'pl-8 text-slate-500 text-xs' : 'font-medium'}`}>{label}</td>
      <td className="px-4 py-2.5 text-right font-mono">{fmt(monto)}</td>
    </tr>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function DespidoView({ setCalculoResult, handleClear }: CalculatorViewProps) {
  const [formData, setFormData] = useState({
    salarioBruto:        '' as number | '',
    fechaIngreso:        '',
    fechaEgreso:         '',
    sinPreaviso:         true,
    diasVacNoGozadas:    0,
    sueldosAdeudados:    0,
    aplicarDoble:        false,
    porcentajeAgravamiento: 50,
    fechaFalsaIngreso:   '',
  });

  const [multas, setMultas] = useState<Multas>({
    ley24013_art8: false, ley24013_art9: false, ley24013_art10: false, ley24013_art15: false,
    ley25323_art45: false, ley25323_art1: false, ley25323_art2: false,
  });

  const [resultado, setResultado]   = useState<ResultadoDespido | null>(null);
  const [errores, setErrores]       = useState<Record<string, string>>({});
  const [multasOpen, setMultasOpen] = useState(false);

  const validar = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.salarioBruto || Number(formData.salarioBruto) <= 0)
      errs.salario = 'Ingrese un salario válido.';
    if (!formData.fechaIngreso) errs.fechaIngreso = 'Ingrese la fecha de ingreso.';
    if (!formData.fechaEgreso)  errs.fechaEgreso = 'Ingrese la fecha de egreso.';
    if (formData.fechaIngreso && formData.fechaEgreso && formData.fechaIngreso >= formData.fechaEgreso)
      errs.fechaEgreso = 'La fecha de egreso debe ser posterior al ingreso.';
    // Si se aplica art. 9 o 10, la fecha falsa es obligatoria y debe estar en rango.
    if (multas.ley24013_art9 || multas.ley24013_art10) {
      if (!formData.fechaFalsaIngreso) {
        errs.fechaFalsa = 'Ingrese la fecha de ingreso consignada por el empleador.';
      } else if (formData.fechaIngreso && formData.fechaEgreso &&
        (formData.fechaFalsaIngreso < formData.fechaIngreso || formData.fechaFalsaIngreso > formData.fechaEgreso)) {
        errs.fechaFalsa = 'La fecha consignada debe estar entre el ingreso real y el egreso.';
      }
    }
    setErrores(errs);
    return Object.keys(errs).length === 0;
  };

    const handleCalculate = () => {
    if (!validar()) return;
    const res = calcularDespido(
      Number(formData.salarioBruto), formData.fechaIngreso, formData.fechaEgreso,
      formData.sinPreaviso,
      Number(formData.diasVacNoGozadas), Number(formData.sueldosAdeudados),
      formData.aplicarDoble, multas,
      formData.fechaFalsaIngreso,
      formData.porcentajeAgravamiento,
    );
    setResultado(res);
    setCalculoResult({
      indemnizacionBase: res.totalSinMultas,
      multas: res.totalMultas,
      total: res.total,
      // ── snapshot para guardar y para PDF futuro ─────────────────────────────
      tipo: 'DESPIDO',
      detalle: {
        // Parámetros de entrada (lo que el abogado cargó)
        parametros: {
          salarioBruto:          Number(formData.salarioBruto),
          fechaIngreso:          formData.fechaIngreso,
          fechaEgreso:           formData.fechaEgreso,
          sinPreaviso:           formData.sinPreaviso,
          diasVacNoGozadas:      Number(formData.diasVacNoGozadas),
          sueldosAdeudados:      Number(formData.sueldosAdeudados),
          aplicarDoble:          formData.aplicarDoble,
          porcentajeAgravamiento: formData.porcentajeAgravamiento,
          fechaFalsaIngreso:     formData.fechaFalsaIngreso || null,
          multas:                { ...multas },
        },
        // Resultado completo del cálculo (todos los rubros)
        resultado: res,
        // Metadata: cuándo se calculó y con qué versión de fórmulas
        calculadoEn: new Date().toISOString(),
        version:     '1.0',
      },
    });
  };

  const handleClearLocal = () => {
    setFormData({ salarioBruto: '', fechaIngreso: '', fechaEgreso: '', sinPreaviso: true, diasVacNoGozadas: 0, sueldosAdeudados: 0, aplicarDoble: false, porcentajeAgravamiento: 50, fechaFalsaIngreso: '' });
    setMultas({ ley24013_art8: false, ley24013_art9: false, ley24013_art10: false, ley24013_art15: false, ley25323_art45: false, ley25323_art1: false, ley25323_art2: false });
    setResultado(null);
    setErrores({});
    handleClear();
  };

  const setField = (field: keyof typeof formData, value: any) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const FieldError = ({ campo }: { campo: string }) =>
    errores[campo] ? <p className="text-xs text-red-500 mt-1">{errores[campo]}</p> : null;

  // ── Reglas de exclusión de multas (Ley 24013) ──────────────────────────────
  // Art. 8 excluye 9 y 10 (pero permite 15). 9 o 10 excluyen 8 (permiten 15).
  const art8Activo  = multas.ley24013_art8;
  const art910Activo = multas.ley24013_art9 || multas.ley24013_art10;

  const setMulta = (key: keyof Multas, v: boolean) => {
    setMultas(prev => {
      const next = { ...prev, [key]: v };
      // Si activo art 8, apago 9 y 10
      if (key === 'ley24013_art8' && v) { next.ley24013_art9 = false; next.ley24013_art10 = false; }
      // Si activo 9 o 10, apago 8
      if ((key === 'ley24013_art9' || key === 'ley24013_art10') && v) { next.ley24013_art8 = false; }
      return next;
    });
  };

  const m = resultado;

  return (
    <div className="space-y-6">

      {/* ── INGRESO DE DATOS ─────────────────────────────────────────────────── */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Briefcase size={18} className="text-slate-600" /> Ingreso de Datos (LCT)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className="block text-xs font-bold text-slate-500 uppercase">Mejor Salario Bruto ($)</label>
              <Input type="text" inputMode="numeric" value={fmtMiles(formData.salarioBruto)}
                onChange={(e) => setField('salarioBruto', parseMiles(e.target.value))}
                placeholder="Ej: 1.000.000" className={errores.salario ? 'border-red-400' : ''} />
              <FieldError campo="salario" />
            </div>

            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className="block text-xs font-bold text-slate-500 uppercase">Preaviso</label>
              <select className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white"
                value={formData.sinPreaviso ? 'sin' : 'con'}
                onChange={(e) => setField('sinPreaviso', e.target.value === 'sin')}>
                <option value="sin">Sin Preaviso (no notificado)</option>
                <option value="con">Con Preaviso (ya fue notificado)</option>
              </select>
              <p className="text-[11px] text-slate-400">Los meses (1 o 2) se calculan según la antigüedad.</p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-500 uppercase">Fecha de Ingreso</label>
              <Input type="date" value={formData.fechaIngreso}
                onChange={(e) => setField('fechaIngreso', e.target.value)}
                className={errores.fechaIngreso ? 'border-red-400' : ''} />
              <FieldError campo="fechaIngreso" />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-500 uppercase">Fecha de Egreso</label>
              <Input type="date" value={formData.fechaEgreso}
                onChange={(e) => setField('fechaEgreso', e.target.value)}
                className={errores.fechaEgreso ? 'border-red-400' : ''} />
              <FieldError campo="fechaEgreso" />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-500 uppercase">Vacaciones no gozadas (días)</label>
              <Input type="number" min={0} max={999} value={formData.diasVacNoGozadas}
                onChange={(e) => setField('diasVacNoGozadas', Number(e.target.value))} placeholder="0" />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-500 uppercase">Sueldos adeudados (cantidad)</label>
              <Input type="number" min={0} max={999} value={formData.sueldosAdeudados}
                onChange={(e) => setField('sueldosAdeudados', Number(e.target.value))} placeholder="0" />
            </div>
          </div>

          {/* Agravamiento Art. 245 bis (despido discriminatorio) */}
          <div className={`rounded-lg border transition-colors
              ${formData.aplicarDoble ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-3 p-3 cursor-pointer"
              onClick={() => setField('aplicarDoble', !formData.aplicarDoble)}>
              <input type="checkbox" checked={formData.aplicarDoble}
                onChange={(e) => setField('aplicarDoble', e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                className="rounded text-amber-500 border-slate-300 focus:ring-amber-400" />
              <div>
                <p className="text-sm font-medium text-slate-700">Agravamiento Art. 245 bis — Despido discriminatorio</p>
                <p className="text-xs text-slate-400">Recargo sobre la indemnización por antigüedad (Ley 27.742). La prueba está a cargo del trabajador.</p>
              </div>
            </div>

            {formData.aplicarDoble && (
              <div className="px-3 pb-3 pt-1 border-t border-amber-200/60">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Porcentaje de agravamiento</label>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setField('porcentajeAgravamiento', 50)}
                    className={`flex-1 text-sm py-2 rounded-md border transition-colors
                      ${formData.porcentajeAgravamiento === 50 ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-300 hover:border-amber-300'}`}>
                    50% — Piso (discriminación probada)
                  </button>
                  <button type="button"
                    onClick={() => setField('porcentajeAgravamiento', 100)}
                    className={`flex-1 text-sm py-2 rounded-md border transition-colors
                      ${formData.porcentajeAgravamiento === 100 ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-300 hover:border-amber-300'}`}>
                    100% — Tope (gravedad mayor)
                  </button>
                </div>
              </div>
            )}
          </div>

          <hr className="border-slate-100" />

          {/* Multas colapsables */}
          <div>
            <button type="button" onClick={() => setMultasOpen(!multasOpen)}
              className="w-full flex items-center justify-between text-sm font-bold text-red-600 uppercase pb-2 border-b border-red-100">
              <span>Multas Ley 24013 &amp; 25323 (opcional)</span>
              {multasOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {multasOpen && (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Ley 24013 — Empleo no registrado</p>
                  <div className="space-y-2">
                    <CheckRow label="Art. 8 — Relación no registrada"
                      sublabel="25% de remuneraciones devengadas. Excluye arts. 9 y 10."
                      checked={multas.ley24013_art8} onChange={(v) => setMulta('ley24013_art8', v)}
                      monto={m?.multa24013_art8 ?? 0} disabled={art910Activo} />
                    <CheckRow label="Art. 9 — Fecha de ingreso posterior a la real"
                      sublabel="Consignó fecha de ingreso falsa. Excluye art. 8."
                      checked={multas.ley24013_art9} onChange={(v) => setMulta('ley24013_art9', v)}
                      monto={m?.multa24013_art9 ?? 0} disabled={art8Activo} />
                    <CheckRow label="Art. 10 — Salario menor al real"
                      sublabel="Consignó remuneración menor. Excluye art. 8."
                      checked={multas.ley24013_art10} onChange={(v) => setMulta('ley24013_art10', v)}
                      monto={m?.multa24013_art10 ?? 0} disabled={art8Activo} />

                    {/* Fecha de ingreso falsa — requerida para art. 9 y 10 */}
                    {art910Activo && (
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase">
                          Fecha de ingreso consignada por el empleador
                        </label>
                        <Input type="date" value={formData.fechaFalsaIngreso}
                          onChange={(e) => setField('fechaFalsaIngreso', e.target.value)}
                          className={errores.fechaFalsa ? 'border-red-400 bg-white' : 'bg-white'} />
                        <p className="text-[11px] text-slate-400">
                          La fecha que el empleador registró (posterior a la real). Define el período de cada artículo.
                        </p>
                        {errores.fechaFalsa && <p className="text-xs text-red-500">{errores.fechaFalsa}</p>}
                      </div>
                    )}

                    <CheckRow label="Art. 15 — Despido tras intimación"
                      sublabel="Duplica indemnización + preaviso + integración. Compatible con 8, 9 y 10."
                      checked={multas.ley24013_art15} onChange={(v) => setMulta('ley24013_art15', v)}
                      monto={m?.multa24013_art15 ?? 0} />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Ley 25323</p>
                  <div className="space-y-2">
                    <CheckRow label="Art. 45 (80 LCT) — Certificado de trabajo"
                      sublabel="No entrega de certificado de remuneraciones y servicios (3 sueldos)."
                      checked={multas.ley25323_art45} onChange={(v) => setMulta('ley25323_art45', v)}
                      monto={m?.multa25323_art45 ?? 0} />
                    <CheckRow label="Art. 1 — Empleo no registrado al despido"
                      sublabel="Duplica la indemnización del Art. 245."
                      checked={multas.ley25323_art1} onChange={(v) => setMulta('ley25323_art1', v)}
                      monto={m?.multa25323_art1 ?? 0} />
                    <CheckRow label="Art. 2 — Falta de pago tras intimación"
                      sublabel="50% de antigüedad + preaviso + integración."
                      checked={multas.ley25323_art2} onChange={(v) => setMulta('ley25323_art2', v)}
                      monto={m?.multa25323_art2 ?? 0} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex gap-2">
            <Button onClick={handleCalculate} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white">
              Calcular Liquidación
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
            <CardTitle className="text-base text-slate-700 flex items-center justify-between">
              <span>Desglose de Liquidación</span>
              <span className="text-xs text-slate-400 font-normal">
                Antigüedad: {resultado.antiguedadAnios} {resultado.antiguedadAnios === 1 ? 'año' : 'años'} · {resultado.diasVacAntiguedad} días vac.
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">

                {/* Liquidación final */}
                <tr className="bg-slate-100"><td className="px-4 py-2 text-xs font-bold text-slate-500 uppercase" colSpan={2}>Liquidación Final</td></tr>
                <Fila label="Proporcional Mes Trabajado" monto={resultado.proporcionalMes} />
                <Fila label="SAC Proporcional" monto={resultado.sacProporcional} />
                <Fila label="Vacaciones Proporcionales" monto={resultado.vacacionesProporcionales} />
                <Fila label="SAC Vacaciones Proporcionales" monto={resultado.sacVacacionesProp} indent />
                {resultado.vacacionesNoGozadas > 0 && <Fila label="Vacaciones no gozadas" monto={resultado.vacacionesNoGozadas} />}
                {resultado.sacVacacionesNoGozadas > 0 && <Fila label="SAC Vacaciones no gozadas" monto={resultado.sacVacacionesNoGozadas} indent />}
                {resultado.sueldosAdeudados > 0 && <Fila label="Sueldos Adeudados" monto={resultado.sueldosAdeudados} />}
                <tr className="bg-slate-50 font-semibold border-t border-slate-200">
                  <td className="px-4 py-2.5 text-slate-800">Subtotal Liquidación</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmt(resultado.subtotalLiquidacion)}</td>
                </tr>

                {/* Indemnización */}
                <tr className="bg-slate-100"><td className="px-4 py-2 text-xs font-bold text-slate-500 uppercase" colSpan={2}>Indemnización</td></tr>
                <Fila label="Indemnización por Antigüedad (Art. 245)" monto={resultado.indemnizacionAntiguedad} />
                {resultado.preaviso > 0 && <Fila label={`Sustitutiva de Preaviso (${resultado.antiguedadAnios > 5 ? 2 : 1} ${resultado.antiguedadAnios > 5 ? 'meses' : 'mes'})`} monto={resultado.preaviso} />}
                {resultado.sacPreaviso > 0 && <Fila label="SAC Sustitutiva de Preaviso" monto={resultado.sacPreaviso} indent />}
                {resultado.integracionMes > 0 && <Fila label="Días de Integración (Art. 233)" monto={resultado.integracionMes} />}
                {resultado.sacIntegracion > 0 && <Fila label="SAC Días de Integración" monto={resultado.sacIntegracion} indent />}
                <tr className="bg-slate-50 font-semibold border-t border-slate-200">
                  <td className="px-4 py-2.5 text-slate-800">Subtotal Indemnización</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmt(resultado.subtotalIndemnizacion)}</td>
                </tr>
                {resultado.dobleIndemnizacion > 0 && <Fila label={`Agravamiento Art. 245 bis (${formData.porcentajeAgravamiento}%)`} monto={resultado.dobleIndemnizacion} />}

                {/* Total sin multas */}
                <tr className="bg-slate-200 font-bold border-t-2 border-slate-300">
                  <td className="px-4 py-3 text-slate-800">TOTAL (sin multas)</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(resultado.totalSinMultas)}</td>
                </tr>

                {/* Multas */}
                {resultado.totalMultas > 0 && (
                  <>
                    <tr className="bg-red-100"><td className="px-4 py-2 text-xs font-bold text-red-600 uppercase" colSpan={2}>Multas</td></tr>
                    {resultado.multa24013_art8  > 0 && <tr className="text-red-700 bg-red-50/50"><td className="px-4 py-2">Art. 8 Ley 24013</td><td className="px-4 py-2 text-right font-mono">{fmt(resultado.multa24013_art8)}</td></tr>}
                    {resultado.multa24013_art9  > 0 && <tr className="text-red-700 bg-red-50/50"><td className="px-4 py-2">Art. 9 Ley 24013</td><td className="px-4 py-2 text-right font-mono">{fmt(resultado.multa24013_art9)}</td></tr>}
                    {resultado.multa24013_art10 > 0 && <tr className="text-red-700 bg-red-50/50"><td className="px-4 py-2">Art. 10 Ley 24013</td><td className="px-4 py-2 text-right font-mono">{fmt(resultado.multa24013_art10)}</td></tr>}
                    {resultado.multa24013_art15 > 0 && <tr className="text-red-700 bg-red-50/50"><td className="px-4 py-2">Art. 15 Ley 24013</td><td className="px-4 py-2 text-right font-mono">{fmt(resultado.multa24013_art15)}</td></tr>}
                    {resultado.multa25323_art45 > 0 && <tr className="text-red-700 bg-red-50/50"><td className="px-4 py-2">Art. 45 (80 LCT) Ley 25323</td><td className="px-4 py-2 text-right font-mono">{fmt(resultado.multa25323_art45)}</td></tr>}
                    {resultado.multa25323_art1  > 0 && <tr className="text-red-700 bg-red-50/50"><td className="px-4 py-2">Art. 1 Ley 25323</td><td className="px-4 py-2 text-right font-mono">{fmt(resultado.multa25323_art1)}</td></tr>}
                    {resultado.multa25323_art2  > 0 && <tr className="text-red-700 bg-red-50/50"><td className="px-4 py-2">Art. 2 Ley 25323</td><td className="px-4 py-2 text-right font-mono">{fmt(resultado.multa25323_art2)}</td></tr>}
                    <tr className="bg-red-50 font-semibold text-red-700 border-t border-red-200">
                      <td className="px-4 py-2.5">Total Multas</td>
                      <td className="px-4 py-2.5 text-right font-mono">{fmt(resultado.totalMultas)}</td>
                    </tr>
                  </>
                )}

                {/* Total final */}
                <tr className="bg-slate-900 text-white border-t-2 border-slate-700">
                  <td className="px-4 py-4 font-bold text-lg">TOTAL {resultado.totalMultas > 0 ? 'CON MULTAS' : 'ESTIMADO'}</td>
                  <td className="px-4 py-4 text-right font-bold text-lg font-mono">{fmt(resultado.total)}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-[11px] text-slate-400 px-4 py-3 italic">
              * Valores estimativos. No incluyen intereses. Sujetos a criterio judicial.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}