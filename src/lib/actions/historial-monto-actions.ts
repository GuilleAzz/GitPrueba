'use server'

import { getUserSessionServer } from "@/auth/actions/auth-actions"
import prisma from "src/lib/db/prisma"

// ═════════════════════════════════════════════════════════════════════════
// Server actions para consultar el historial de montos de un expediente.
//
// La CREACIÓN de filas en el historial NO se hace desde acá — se hace desde
// la action de editar caso (actualizarCasoAction) cuando detecta un cambio
// en el monto. También se popula desde el seed cuando se cargan casos con
// monto inicial.
//
// Esta action se usa desde el frontend para mostrar el listado de cambios
// históricos en el resumen del expediente.
// ═════════════════════════════════════════════════════════════════════════

export type HistorialMontoItem = {
  id: string
  monto: string          // stringificado para pasar de Decimal a client
  motivo: string
  esInicial: boolean
  fechaCambio: string    // ISO
  registradoPor: {
    id: string
    nombre: string | null
    apellido: string | null
    rol: string
  }
}

/**
 * Chequeo de acceso al caso.
 * Mismo criterio que las demás actions del expediente:
 *   - ADMIN no accede
 *   - ASISTENTE sí (acceso general)
 *   - ABOGADO solo si es el titular del caso
 */
async function usuarioPuedeAccederCaso(
  casoId: string,
  userId: string,
  rol?: string | null
): Promise<boolean> {
  const rolUpper = rol?.toUpperCase()
  if (rolUpper === "ADMIN") return false
  const caso = await prisma.caso.findUnique({
    where: { id: casoId },
    select: { abogadoId: true },
  })
  if (!caso) return false
  if (rolUpper === "ASISTENTE") return true
  return caso.abogadoId === userId
}

/**
 * Lista el historial completo de montos de un expediente,
 * ordenado del más reciente al más antiguo.
 *
 * El más reciente es el "monto vigente" (coincide con caso.montoDisputa).
 * Los anteriores son solo consulta histórica.
 */
export async function getHistorialMontoDeCaso(casoId: string): Promise<HistorialMontoItem[]> {
  const user = await getUserSessionServer()
  if (!user) return []

  const puedeAcceder = await usuarioPuedeAccederCaso(casoId, user.id, user.rol)
  if (!puedeAcceder) return []

  const historial = await prisma.historialMonto.findMany({
    where: { casoId },
    include: {
      registradoPor: {
        select: { id: true, nombre: true, apellido: true, rol: true },
      },
    },
    orderBy: { fechaCambio: "desc" },
  })

  return historial.map(h => ({
    id: h.id,
    monto: h.monto.toString(),
    motivo: h.motivo,
    esInicial: h.esInicial,
    fechaCambio: h.fechaCambio.toISOString(),
    registradoPor: {
      id: h.registradoPor.id,
      nombre: h.registradoPor.nombre,
      apellido: h.registradoPor.apellido,
      rol: h.registradoPor.rol,
    },
  }))
}