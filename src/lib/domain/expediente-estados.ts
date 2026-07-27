/**
 * Máquina de estados del expediente jurídico.
 *
 * Define los estados válidos, el orden procesal y las transiciones permitidas.
 *
 * REGLAS DE NEGOCIO:
 *   1. Los estados están ordenados según el flujo procesal típico argentino.
 *   2. Las transiciones "hacia adelante" (índice mayor) son AVANCES normales.
 *      No requieren justificación, solo confirmación del usuario.
 *   3. Las transiciones "hacia atrás" (índice menor) son RETROCESOS
 *      EXCEPCIONALES. Legalmente se dan solo por reapertura, nulidad,
 *      corrección de error material o medida para mejor proveer que reabre
 *      una etapa. Por eso REQUIEREN motivo obligatorio.
 *   4. El estado "Ejecución de Sentencia" es terminal en el flujo activo:
 *      no avanza más porque el siguiente paso es el cierre del expediente,
 *      que se maneja con el flujo aparte (botón "Cerrar Expediente").
 *
 * Esta máquina de estados está pensada para ser CONSUMIDA:
 *   - Desde el frontend (EditarCasoForm) para mostrar solo transiciones válidas
 *     y abrir modal de motivo cuando corresponda.
 *   - Desde el server action (actualizarCasoAction) para validar server-side
 *     antes de escribir en BD.
 */

/**
 * Lista ordenada de estados del expediente en producción.
 * IMPORTANTE: el orden importa, define las transiciones permitidas.
 */
export const ESTADOS_EXPEDIENTE = [
  "Inicio / Demanda",
  "Mediación / Previo",
  "Prueba (Oficios/Pericias)",
  "Alegatos / Conclusiones",
  "Sentencia de 1ra Instancia",
  "Apelación / 2da Instancia",
  "Ejecución de Sentencia",
] as const;

export type EstadoExpediente = (typeof ESTADOS_EXPEDIENTE)[number];

/**
 * Tipo de transición entre dos estados.
 */
export type TipoTransicion = "avance" | "retroceso" | "mismo" | "invalido";

/**
 * Estructura de una opción de destino en el selector de estado.
 */
export type OpcionEstado = {
  estado: EstadoExpediente;
  tipo: "avance" | "retroceso";
};

/**
 * Devuelve el índice de un estado en el flujo procesal.
 * Devuelve -1 si el estado no existe en la máquina actual (estado legacy).
 */
export function getIndiceEstado(estado: string): number {
  return (ESTADOS_EXPEDIENTE as readonly string[]).indexOf(estado);
}

/**
 * Verifica si un estado existe en la máquina de estados actual.
 * Los estados legacy (ej: "Terminado", "Archivado") devuelven false.
 */
export function esEstadoValido(estado: string): boolean {
  return (ESTADOS_EXPEDIENTE as readonly string[]).includes(estado);
}

/**
 * Determina el tipo de una transición entre dos estados.
 * Devuelve uno de:
 *   - 'avance': el estado destino es posterior al de origen (índice mayor).
 *   - 'retroceso': el estado destino es anterior al de origen (índice menor).
 *   - 'mismo': ambos estados son iguales (no hay cambio real).
 *   - 'invalido': alguno de los dos estados no existe en la máquina.
 */
export function getTipoTransicion(
  estadoDesde: string,
  estadoHacia: string
): TipoTransicion {
  const idxDesde = getIndiceEstado(estadoDesde);
  const idxHacia = getIndiceEstado(estadoHacia);

  if (idxDesde === -1 || idxHacia === -1) return "invalido";
  if (idxDesde === idxHacia) return "mismo";
  return idxHacia > idxDesde ? "avance" : "retroceso";
}

/**
 * Devuelve la lista de estados alcanzables desde un estado dado.
 * Cada elemento incluye el nombre del estado y su tipo de transición.
 *
 * Si el estado actual es legacy (no está en la máquina), devuelve TODOS
 * los estados como avances (permite regularizar el caso).
 */
export function getSiguientesEstadosPermitidos(
  estadoActual: string
): OpcionEstado[] {
  const idxActual = getIndiceEstado(estadoActual);
  const opciones: OpcionEstado[] = [];

  // Estado legacy: permitir avanzar a cualquier estado (regularización)
  if (idxActual === -1) {
    ESTADOS_EXPEDIENTE.forEach((estado) => {
      opciones.push({ estado, tipo: "avance" });
    });
    return opciones;
  }

  ESTADOS_EXPEDIENTE.forEach((estado, idx) => {
    if (idx !== idxActual) {
      opciones.push({
        estado,
        tipo: idx > idxActual ? "avance" : "retroceso",
      });
    }
  });

  return opciones;
}

/**
 * Valida si una transición de estado es permitida.
 *
 * @param estadoDesde estado actual del expediente
 * @param estadoHacia estado propuesto
 * @param motivo motivo justificado (obligatorio solo en retrocesos)
 * @returns null si la transición es válida; string con mensaje de error si no.
 */
export function validarTransicion(
  estadoDesde: string,
  estadoHacia: string,
  motivo?: string | null
): string | null {
  const tipo = getTipoTransicion(estadoDesde, estadoHacia);

  if (tipo === "invalido") {
    return `Transición inválida: el estado destino "${estadoHacia}" no existe en el sistema.`;
  }

  if (tipo === "mismo") {
    return null; // No hay cambio real, no es un error, se ignora silenciosamente.
  }

  if (tipo === "retroceso" && (!motivo || !motivo.trim())) {
    return `El retroceso procesal de "${estadoDesde}" a "${estadoHacia}" es excepcional y requiere motivo justificado. Los retrocesos legítimos son: reapertura, declaración de nulidad, corrección de error material o medida para mejor proveer.`;
  }

  return null;
}

/**
 * Devuelve un mensaje descriptivo para mostrar al usuario sobre una transición.
 * Útil para el modal de confirmación en el frontend.
 */
export function getMensajeTransicion(
  estadoDesde: string,
  estadoHacia: string
): string {
  const tipo = getTipoTransicion(estadoDesde, estadoHacia);

  switch (tipo) {
    case "avance":
      return `Avance procesal de "${estadoDesde}" a "${estadoHacia}". Este cambio queda registrado en la bitácora del expediente.`;
    case "retroceso":
      return `RETROCESO EXCEPCIONAL de "${estadoDesde}" a "${estadoHacia}". Los retrocesos son legítimos únicamente en casos de reapertura, nulidad, corrección de error material o medida para mejor proveer. Requiere motivo justificado.`;
    case "mismo":
      return `Sin cambio de estado.`;
    case "invalido":
      return `Transición inválida.`;
  }
}