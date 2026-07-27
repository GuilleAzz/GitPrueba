"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"

interface AbogadoOption {
  id: string
  nombre: string | null
  apellido: string | null
}

interface FiltrosCasosProps {
  abogadosDisponibles?: AbogadoOption[]
  mostrarFiltroAbogado?: boolean
}

export function FiltrosCasos({
  abogadosDisponibles = [],
  mostrarFiltroAbogado = false,
}: FiltrosCasosProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentTipo = searchParams.get("tipo") || "todos"
  const currentEtapa = searchParams.get("etapa") || "todas"
  const currentAbogado = searchParams.get("abogado") || "todos"

const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "todos" || value === "todas") {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    window.location.href = `${pathname}?${params.toString()}`
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
      {/* Selector de Tipo/Fuero */}
      <select
        className="flex h-10 w-full sm:w-[180px] items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 cursor-pointer"
        value={currentTipo}
        onChange={(e) => handleFilterChange("tipo", e.target.value)}
      >
        <option value="todos">Todos los fueros</option>
        <option value="CIVIL_COMERCIAL">Civil y Comercial</option>
        <option value="LABORAL">Laboral</option>
        <option value="FAMILIA">Familia</option>
        <option value="PENAL">Penal</option>
        <option value="CONT_ADM">Contencioso Admin.</option>
      </select>

      {/* Selector de Etapa Procesal */}
      <select
        className="flex h-10 w-full sm:w-[220px] items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 cursor-pointer"
        value={currentEtapa}
        onChange={(e) => handleFilterChange("etapa", e.target.value)}
      >
        <option value="todas">Todas las etapas</option>
        <option value="Inicio / Demanda">Inicio / Demanda</option>
        <option value="Mediación / Previo">Mediación / Previo</option>
        <option value="Prueba (Oficios/Pericias)">Prueba (Oficios/Pericias)</option>
        <option value="Alegatos / Conclusiones">Alegatos / Conclusiones</option>
        <option value="Sentencia / Resolución">Sentencia / Resolución</option>
        <option value="Ejecución de Sentencia">Ejecución de Sentencia</option>
        <option value="Terminado">Terminado</option>
        <option value="Archivado">Archivado</option>
      </select>

      {/* Selector de Abogado — solo visible para el rol ASISTENTE */}
      {mostrarFiltroAbogado && (
        <select
          className="flex h-10 w-full sm:w-[200px] items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 cursor-pointer"
          value={currentAbogado}
          onChange={(e) => handleFilterChange("abogado", e.target.value)}
        >
          <option value="todos">Todos los abogados</option>
          {abogadosDisponibles.map((a) => (
            <option key={a.id} value={a.id}>
              {`${a.apellido ?? ""} ${a.nombre ?? ""}`.trim() || "Sin nombre"}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}