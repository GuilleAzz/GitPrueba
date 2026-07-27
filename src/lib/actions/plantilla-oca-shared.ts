// ═════════════════════════════════════════════════════════════════════════
// Constantes y tipos compartidos de plantillas OCA.
//
// Este archivo NO tiene 'use server' porque exporta constantes/tipos.
// Next.js NO permite que un archivo con 'use server' exporte objetos o
// constantes, solo funciones async.
//
// Se separa de `plantilla-oca-actions.ts` para que ese pueda exportar solo
// las server actions (funciones async) sin restricción.
//
// Los componentes cliente (como SeccionPlantillasOca.tsx) pueden importar
// este archivo directamente sin problema.
// ═════════════════════════════════════════════════════════════════════════

import { TipoPlantillaOca } from "@prisma/client"

// ═════════════════════════════════════════════════════════════════════════
// TIPOS
// ═════════════════════════════════════════════════════════════════════════

export type PlantillaOcaConRelaciones = {
  id: string
  tipoPlantilla: TipoPlantillaOca
  datos: any
  archivoUrl: string
  archivoStorageKey: string
  archivoNombre: string
  archivoTamanio: number
  descripcion: string | null
  casoId: string
  caso: { id: string; numero: string; titulo: string }
  creadoPorId: string
  creadoPor: { id: string; nombre: string | null; apellido: string | null }
  createdAt: string
  updatedAt: string
  eliminadoEn: string | null
}

// ═════════════════════════════════════════════════════════════════════════
// LABELS
// ═════════════════════════════════════════════════════════════════════════

// Labels descriptivos por tipo de plantilla (para mostrar en la UI)
export const TIPO_PLANTILLA_OCA_LABELS: Record<TipoPlantillaOca, string> = {
  RENUNCIA: "Comunicación de Renuncia",
  AUSENCIA: "Ausencia / Intimación Corta",
  OTRO: "Otro Tipo de Comunicación",
  ARCA: "Comunicación ARCA (Art. 11)",
}