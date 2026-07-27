"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Calculator, Printer, ArrowLeft, Briefcase, Truck, Scale, RotateCcw, Save
} from 'lucide-react';
import { TipoLiquidacion } from "@prisma/client";
import dynamic from "next/dynamic";
// IMPORTACIONES REALES
import { Sidebar } from "@/app/components/sidebar";
import { Header } from "@/app/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Componentes de VISTA
import DespidoView from "./components/DespidosView";
import LrtView from "./components/LrtView";
import CapitalizacionView from "./components/CapitalizacionView";

// Diálogo de guardado
import DialogoGuardarLiquidacion from "./components/DialogoGuardarLiquidacion";

// ─── TIPOS ────────────────────────────────────────────────────────────────────
// CalculoResult se extiende con tipo + detalle (opcionales por compatibilidad
// con calculadoras que aún no los pasen; el botón Guardar se habilita
// únicamente si vienen ambos).

interface CalculoResult {
  indemnizacionBase: number;
  multas: number;
  total: number;
  tipo?: TipoLiquidacion;
  detalle?: any;                          // snapshot completo del cálculo
}

// Definición de las pestañas de navegación
const TABS = [
  { id: 'despido',        name: 'Despido',                    icon: Briefcase, component: DespidoView,         tipo: 'DESPIDO'        as TipoLiquidacion },
  { id: 'lrt',            name: 'Accidente - LRT',            icon: Truck,     component: LrtView,             tipo: 'LRT'            as TipoLiquidacion },
  { id: 'capitalizacion', name: 'Accidente - Capitalización', icon: Scale,     component: CapitalizacionView,  tipo: 'CAPITALIZACION' as TipoLiquidacion },
];

const BotonGenerarPdfLiquidacion = dynamic(
  () => import("src/lib/pdf/liquidacion/BotonGenerarPdfLiquidacion")
    .then(m => m.BotonGenerarPdfLiquidacion),
  {
    ssr: false,
    loading: () => (
      <button
        disabled
        className="w-full inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium px-4 py-2 bg-blue-600/50 text-white"
      >
        <Printer size={18} /> Cargando…
      </button>
    ),
  }
);

export default function CalculadoraIndemnizacionesClient() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [calculoResult, setCalculoResult] = useState<CalculoResult | null>(null);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);

  const tabActiva = TABS.find(tab => tab.id === activeTab) ?? TABS[0];
  const ActiveComponent = tabActiva.component;

  const handleClearGlobal = () => {
    setCalculoResult(null);
  };

  const handleAbrirGuardar = () => {
    if (!calculoResult) return;
    setDialogoAbierto(true);
  };

  // El botón Guardar se habilita solo si hay cálculo, tipo y detalle disponibles.
  // Mientras alguna calculadora aún no envíe estos campos, queda deshabilitado con tooltip.
  const puedeGuardar = !!(calculoResult && calculoResult.tipo && calculoResult.detalle);

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">

      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden">

        <Header />

        <main className="flex-1 overflow-auto p-6">

          {/* HEADER DE LA PÁGINA */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div className="flex items-center gap-4">
              <Link href="/reportes" className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Calculator className="w-6 h-6 text-blue-600" />
                  Calculadora de Liquidaciones
                </h1>
                <p className="text-slate-500 text-sm">Despido, accidentes y multas (Art. 8, 9, 15).</p>
              </div>
            </div>
            <Button onClick={handleClearGlobal} variant="outline" className="gap-2 text-slate-600 border-slate-300">
              <RotateCcw className="w-4 h-4" /> Limpiar Todo
            </Button>
          </div>

          {/* NAVEGACIÓN POR PESTAÑAS */}
          <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setCalculoResult(null); }}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2
                  ${activeTab === tab.id
                    ? 'border-slate-900 text-slate-900 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
              >
                <tab.icon size={16} />
                {tab.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* IZQUIERDA: ÁREA DE CÁLCULO */}
            <div className="lg:col-span-2">
              <ActiveComponent
                setCalculoResult={setCalculoResult}
                handleClear={handleClearGlobal}
              />
            </div>

            {/* DERECHA: PANEL DE RESULTADOS Y ACCIONES */}
            <div className="lg:col-span-1">
              <Card className="border-slate-200 shadow-sm h-full sticky top-0">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                  <CardTitle className="text-lg text-slate-700">
                    Resultado Final
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {calculoResult ? (
                    <>
                      {/* Total */}
                      <div className="bg-slate-900 p-4 rounded-lg shadow-md">
                        <p className="text-xs text-slate-300 font-bold uppercase mb-1">Total a Reclamar</p>
                        <p className="text-2xl font-bold text-white">
                          ${calculoResult.total.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                        </p>
                      </div>

                      {/* Desglose */}
                      <div className="space-y-2 text-sm">
                        {calculoResult.tipo === 'CAPITALIZACION' ? (
                          <>
                            <div className="flex justify-between text-slate-600">
                              <span>Fórmula aplicada:</span>
                              <span className="font-medium">
                                {calculoResult.detalle?.comparativa?.formulaMayor ?? '—'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 pt-1 leading-relaxed">
                              Se toma el capital más alto de las tres fórmulas comparadas. No son rubros
                              que se sumen: son criterios jurisprudenciales alternativos.
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between text-slate-600">
                              <span>Indemnización Base:</span>
                              <span className="font-medium">${calculoResult.indemnizacionBase.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>Multas / Adicionales:</span>
                              <span className="font-medium">${calculoResult.multas.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Acciones */}
                      <div className="pt-4 space-y-2">
                        <Button
                          onClick={handleAbrirGuardar}
                          disabled={!puedeGuardar}
                          title={puedeGuardar ? undefined : "Esta calculadora aún no soporta guardar (se habilita pronto)"}
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white gap-2 shadow-sm disabled:opacity-60"
                        >
                          <Save size={16} /> Guardar Cálculo
                        </Button>
                        {puedeGuardar ? (
                        <BotonGenerarPdfLiquidacion
                          tipo={calculoResult!.tipo!}
                          detalle={calculoResult!.detalle}
                          label="Generar PDF Final"
                          fullWidth
                        />
                      ) : (
                        <button
                          disabled
                          className="w-full inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium px-4 py-2 bg-blue-600/60 text-white"
                          title="Realice un cálculo primero"
                        >
                          <Printer size={18} /> Generar PDF Final
                        </button>
                      )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-10 text-slate-400">
                      <Calculator size={40} className="mx-auto mb-3" />
                      <p className="text-sm">Seleccione una pestaña e ingrese los datos para liquidar.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* Diálogo de guardado */}
      {calculoResult && calculoResult.tipo && calculoResult.detalle && (
        <DialogoGuardarLiquidacion
          open={dialogoAbierto}
          onClose={() => setDialogoAbierto(false)}
          tipo={calculoResult.tipo}
          montoTotal={calculoResult.total}
          detalle={calculoResult.detalle}
        />
      )}
    </div>
  );
}