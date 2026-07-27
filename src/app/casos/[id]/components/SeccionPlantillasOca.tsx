"use client";

import React, { useState, useMemo } from "react";
import {
  Mail, FileText, UserX, Landmark, Download, Trash2,
  ChevronDown, ChevronRight, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
// [OCA-FIX] Importar TIPO del archivo shared (los archivos 'use server'
// no pueden exportar tipos ni constantes, solo funciones async)
import { type PlantillaOcaConRelaciones } from "src/lib/actions/plantilla-oca-shared";
// La server action sí se importa desde el archivo actions
import { eliminarPlantillaOcaAction } from "src/lib/actions/plantilla-oca-actions";
import { useRouter } from "next/navigation";
import { TipoPlantillaOca } from "@prisma/client";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

const fmtTamanio = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

// Meta visual por tipo de plantilla — mismo estilo que TIPO_META de cálculos
const TIPO_META = {
  RENUNCIA: {
    label: "Comunicación de Renuncia",
    plural: "Comunicaciones de Renuncia",
    icon: FileText,
    color: "bg-blue-100 text-blue-700 border-blue-200",
    badge: "Renuncia",
  },
  AUSENCIA: {
    label: "Ausencia / Intimación Corta",
    plural: "Ausencias / Intimaciones Cortas",
    icon: UserX,
    color: "bg-amber-100 text-amber-700 border-amber-200",
    badge: "Ausencia",
  },
  OTRO: {
    label: "Otro Tipo de Comunicación",
    plural: "Otras Comunicaciones",
    icon: MessageSquare,
    color: "bg-purple-100 text-purple-700 border-purple-200",
    badge: "Otro",
  },
  ARCA: {
    label: "Comunicación ARCA (Art. 11)",
    plural: "Comunicaciones ARCA",
    icon: Landmark,
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    badge: "ARCA",
  },
} as const;

// Orden fijo de los grupos (mismo criterio que cálculos)
const ORDEN_TIPOS: TipoPlantillaOca[] = ["RENUNCIA", "AUSENCIA", "OTRO", "ARCA"];

// Umbral para colapso inicial (mismo criterio que cálculos)
const UMBRAL_COLAPSO_INICIAL = 5;

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

interface SeccionPlantillasOcaProps {
  casoId: string;
  plantillas: PlantillaOcaConRelaciones[];
  puedeEliminar: boolean;
}

export default function SeccionPlantillasOca({
  casoId,
  plantillas,
  puedeEliminar,
}: SeccionPlantillasOcaProps) {
  const router = useRouter();
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Agrupar plantillas por tipo (mismo patrón que cálculos) ──────────────
  const grupos = useMemo(() => {
    const map = new Map<TipoPlantillaOca, PlantillaOcaConRelaciones[]>();
    for (const p of plantillas) {
      const arr = map.get(p.tipoPlantilla) ?? [];
      arr.push(p);
      map.set(p.tipoPlantilla, arr);
    }
    return ORDEN_TIPOS
      .filter((t) => map.has(t))
      .map((t) => ({
        tipo: t,
        items: map.get(t)!,
        tamanioTotal: map.get(t)!.reduce((acc, p) => acc + p.archivoTamanio, 0),
      }));
  }, [plantillas]);

  // Estado de colapso — inicia cerrado si hay muchas plantillas
  const colapsoInicial = plantillas.length > UMBRAL_COLAPSO_INICIAL;
  const [colapsados, setColapsados] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const t of ORDEN_TIPOS) init[t] = colapsoInicial;
    return init;
  });

  const toggle = (tipo: string) =>
    setColapsados((prev) => ({ ...prev, [tipo]: !prev[tipo] }));

  const expandirTodos = () =>
    setColapsados(Object.fromEntries(ORDEN_TIPOS.map((t) => [t, false])));
  const colapsarTodos = () =>
    setColapsados(Object.fromEntries(ORDEN_TIPOS.map((t) => [t, true])));

  // ── Acciones ──────────────────────────────────────────────────────────────
  const handleEliminar = async (id: string) => {
    if (!confirm("¿Eliminar esta plantilla OCA? El archivo se borrará y quedará registrado en la auditoría.")) return;
    setError(null);
    setEliminando(id);
    const res = await eliminarPlantillaOcaAction(id);
    setEliminando(null);
    if (res.error) { setError(res.error); return; }
    router.refresh();
  };

  const handleDescargar = (url: string, nombre: string) => {
    // Abrimos el PDF en una pestaña nueva (el navegador decide si descarga o previsualiza)
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.target = "_blank";
    enlace.rel = "noopener noreferrer";
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
  };

  // ── Tamaño total del expediente ──────────────────────────────────────────
  const tamanioAcumulado = plantillas.reduce((acc, p) => acc + p.archivoTamanio, 0);

  // Helper para extraer destinatario del snapshot de datos
  const extraerDestinatario = (p: PlantillaOcaConRelaciones): string => {
    if (p.tipoPlantilla === "ARCA") return "ARCA (Organismo)";
    const nombre = p.datos?.destinatarioNombre;
    return nombre?.trim() || "Sin destinatario";
  };

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">

      {/* Header general de la sección */}
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Mail className="w-5 h-5 text-slate-600 shrink-0" />
          <h3 className="font-bold text-slate-800">Plantillas OCA</h3>
          <span className="text-xs text-slate-500">
            ({plantillas.length} {plantillas.length === 1 ? "plantilla" : "plantillas"})
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Atajos para colapsar/expandir todos (si hay 2+ grupos) */}
          {grupos.length > 1 && (
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={expandirTodos}
                className="text-slate-500 hover:text-slate-800 underline-offset-2 hover:underline"
              >
                Expandir todo
              </button>
              <span className="text-slate-300">·</span>
              <button
                onClick={colapsarTodos}
                className="text-slate-500 hover:text-slate-800 underline-offset-2 hover:underline"
              >
                Colapsar todo
              </button>
            </div>
          )}

          {plantillas.length > 0 && (
            <div className="text-xs text-slate-500">
              Tamaño total:{" "}
              <span className="font-bold font-mono text-slate-800">{fmtTamanio(tamanioAcumulado)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Error global */}
      {error && (
        <div className="px-5 py-2 bg-red-50 border-b border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Contenido: estado vacío o grupos */}
      {plantillas.length === 0 ? (
        <div className="px-5 py-10 text-center text-slate-400">
          <Mail className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">
            No hay plantillas OCA generadas para este expediente.
          </p>
          <p className="text-xs mt-1">
            Las plantillas oficiales del Correo Argentino (telegramas laborales, ARCA)
            se guardarán acá cuando las generes desde el menú de Plantillas.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {grupos.map(({ tipo, items, tamanioTotal }) => {
            const meta = TIPO_META[tipo];
            const GroupIcon = meta.icon;
            const isOpen = !colapsados[tipo];

            return (
              <div key={tipo}>
                {/* Header del grupo (clickeable) */}
                <button
                  onClick={() => toggle(tipo)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50/70 transition-colors text-left"
                >
                  {/* Chevron */}
                  <span className="text-slate-400 shrink-0">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>

                  {/* Ícono del tipo */}
                  <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${meta.color}`}>
                    <GroupIcon size={16} />
                  </div>

                  {/* Nombre del grupo + contador */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">
                      {items.length === 1 ? meta.label : meta.plural}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {items.length} {items.length === 1 ? "plantilla" : "plantillas"}
                      {plantillas.length > 0 && (
                        <> · {(items.length / plantillas.length * 100).toFixed(0)}% del total del expediente</>
                      )}
                    </p>
                  </div>

                  {/* Tamaño del grupo */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900 font-mono">{fmtTamanio(tamanioTotal)}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">tamaño</p>
                  </div>
                </button>

                {/* Items del grupo */}
                {isOpen && (
                  <ul className="bg-slate-50/30 divide-y divide-slate-100 border-t border-slate-100">
                    {items.map((plantilla) => {
                      const isEliminandoEste = eliminando === plantilla.id;
                      const destinatario = extraerDestinatario(plantilla);

                      return (
                        <li key={plantilla.id} className="px-5 py-2.5 pl-16 hover:bg-white transition-colors">
                          <div className="flex items-center gap-3 flex-wrap">

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">
                                Destinatario: <span className="text-slate-900 font-semibold">{destinatario}</span>
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {fmtFecha(plantilla.createdAt)} · {plantilla.creadoPor.nombre} {plantilla.creadoPor.apellido}
                                {plantilla.descripcion && (
                                  <span className="italic"> · "{plantilla.descripcion}"</span>
                                )}
                              </p>
                            </div>

                            {/* Tamaño del archivo */}
                            <div className="text-right shrink-0">
                              <p className="text-xs text-slate-500 font-mono">{fmtTamanio(plantilla.archivoTamanio)}</p>
                            </div>

                            {/* Acciones */}
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                onClick={() => handleDescargar(plantilla.archivoUrl, plantilla.archivoNombre)}
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600"
                                title="Descargar PDF"
                              >
                                <Download size={15} />
                              </Button>
                              {puedeEliminar && (
                                <Button
                                  onClick={() => handleEliminar(plantilla.id)}
                                  disabled={isEliminandoEste}
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 disabled:opacity-40"
                                  title="Eliminar plantilla"
                                >
                                  <Trash2 size={15} />
                                </Button>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer informativo (mismo estilo que cálculos) */}
      {plantillas.length > 0 && (
        <div className="px-5 py-2 bg-slate-50/50 border-t border-slate-100 text-[11px] text-slate-400 italic">
          Las plantillas eliminadas quedan registradas en la auditoría del expediente. El archivo físico del PDF se borra del almacenamiento.
        </div>
      )}
    </div>
  );
}