/**
 * Utilidades para validación de documentos de identificación.
 *
 * Este módulo unifica la validación de todos los tipos de documento que
 * el sistema acepta para clientes:
 *   - DNI (Documento Nacional de Identidad)
 *   - CUIT (Clave Única de Identificación Tributaria)
 *   - CUIL (Clave Única de Identificación Laboral)
 *   - PASAPORTE
 *   - OTRO (LC, LE, CI extranjera, etc.)
 *
 * Solo CUIT y CUIL tienen algoritmo de verificación matemática (módulo 11),
 * que está implementado en el módulo hermano `cuit.ts`. Los demás documentos
 * solo validan formato (longitud, caracteres permitidos).
 *
 * Este módulo se usa en:
 *   - Formulario de creación de cliente (validación client-side en tiempo real)
 *   - Server action de creación (validación server-side antes de guardar)
 *   - Generación de OCA (validación antes de generar el PDF)
 */

import {
  validarCuit,
  obtenerErrorCuit,
  formatearCuit,
  limpiarCuit,
} from "./cuit";

/**
 * Tipos de documento aceptados por el sistema.
 * Debe coincidir con los valores del enum en la base de datos.
 */
export type TipoDocumento = "DNI" | "CUIT" | "CUIL" | "PASAPORTE" | "OTRO";

/**
 * Resultado de validación de un documento.
 * - valido: true si el documento pasa todas las validaciones aplicables
 * - error: mensaje descriptivo si no es válido (null si es válido)
 */
export type ResultadoValidacion = {
  valido: boolean;
  error: string | null;
};

/**
 * Valida un DNI argentino.
 *
 * El DNI argentino NO tiene dígito verificador matemático (a diferencia del
 * CUIT). Solo podemos validar formato:
 *   - Solo dígitos (se ignoran puntos y espacios de miles)
 *   - Entre 7 y 8 dígitos (los actuales son de 8; algunos legacy tienen 7)
 */
export function validarDni(dni: string): ResultadoValidacion {
  const dniLimpio = dni.replace(/[.\s]/g, "");

  if (dniLimpio.length === 0) {
    return { valido: false, error: "El DNI es obligatorio" };
  }
  if (!/^\d+$/.test(dniLimpio)) {
    return { valido: false, error: "El DNI solo puede contener números" };
  }
  if (dniLimpio.length < 7 || dniLimpio.length > 8) {
    return {
      valido: false,
      error: `El DNI debe tener 7 u 8 dígitos (tiene ${dniLimpio.length})`,
    };
  }

  return { valido: true, error: null };
}

/**
 * Valida un pasaporte.
 *
 * Cada país tiene su propio formato de pasaporte. No hay algoritmo
 * matemático de verificación universal. Solo validamos formato razonable:
 *   - Entre 5 y 15 caracteres
 *   - Alfanumérico (letras y números)
 */
export function validarPasaporte(pasaporte: string): ResultadoValidacion {
  const pasaporteLimpio = pasaporte.replace(/\s/g, "");

  if (pasaporteLimpio.length === 0) {
    return { valido: false, error: "El pasaporte es obligatorio" };
  }
  if (!/^[A-Za-z0-9]+$/.test(pasaporteLimpio)) {
    return {
      valido: false,
      error: "El pasaporte solo puede contener letras y números",
    };
  }
  if (pasaporteLimpio.length < 5 || pasaporteLimpio.length > 15) {
    return {
      valido: false,
      error: `El pasaporte debe tener entre 5 y 15 caracteres (tiene ${pasaporteLimpio.length})`,
    };
  }

  return { valido: true, error: null };
}

/**
 * Valida un documento genérico bajo la categoría "Otro".
 *
 * Esta categoría aplica para documentos poco frecuentes:
 *   - LC (Libreta Cívica) - documento legacy femenino
 *   - LE (Libreta de Enrolamiento) - documento legacy masculino
 *   - CI extranjera (Cédula de Identidad de otros países)
 *   - Otros documentos legales
 *
 * Como no hay algoritmo estándar, solo validamos formato razonable.
 */
export function validarOtroDocumento(documento: string): ResultadoValidacion {
  const docLimpio = documento.trim();

  if (docLimpio.length === 0) {
    return { valido: false, error: "El documento es obligatorio" };
  }
  if (docLimpio.length < 5) {
    return {
      valido: false,
      error: "El documento debe tener al menos 5 caracteres",
    };
  }
  if (docLimpio.length > 20) {
    return {
      valido: false,
      error: "El documento no puede tener más de 20 caracteres",
    };
  }

  return { valido: true, error: null };
}

/**
 * Función principal: valida cualquier documento según su tipo.
 *
 * Delega a la función específica según el tipo:
 *   - CUIT y CUIL → validarCuit del módulo cuit.ts (algoritmo módulo 11)
 *   - DNI → validarDni (solo formato numérico)
 *   - PASAPORTE → validarPasaporte (formato alfanumérico)
 *   - OTRO → validarOtroDocumento (longitud mínima/máxima)
 *
 * Nota importante sobre CUIT vs CUIL: usan exactamente el mismo algoritmo
 * de verificación. La diferencia es semántica (uno es tributario, otro
 * laboral) pero matemáticamente son iguales.
 *
 * @param tipo tipo de documento
 * @param numero valor a validar (puede venir con formato: guiones, puntos)
 * @returns objeto con { valido: boolean, error: string | null }
 */
export function validarDocumento(
  tipo: TipoDocumento,
  numero: string
): ResultadoValidacion {
  switch (tipo) {
    case "DNI":
      return validarDni(numero);
    case "CUIT":
    case "CUIL": {
      const esValido = validarCuit(numero);
      const errorMsg = esValido ? null : obtenerErrorCuit(numero);
      return { valido: esValido, error: errorMsg };
    }
    case "PASAPORTE":
      return validarPasaporte(numero);
    case "OTRO":
      return validarOtroDocumento(numero);
    default:
      return {
        valido: false,
        error: `Tipo de documento desconocido: ${tipo}`,
      };
  }
}

/**
 * Devuelve el label descriptivo de un tipo de documento.
 * Útil para mostrar al usuario en mensajes de error o UI.
 */
export function getLabelTipoDocumento(tipo: TipoDocumento): string {
  switch (tipo) {
    case "DNI":
      return "DNI";
    case "CUIT":
      return "CUIT";
    case "CUIL":
      return "CUIL";
    case "PASAPORTE":
      return "Pasaporte";
    case "OTRO":
      return "Otro documento";
  }
}

/**
 * Devuelve el placeholder sugerido para el input según el tipo de documento.
 * Ayuda al usuario a entender el formato esperado.
 */
export function getPlaceholderDocumento(tipo: TipoDocumento): string {
  switch (tipo) {
    case "DNI":
      return "Ej: 12345678";
    case "CUIT":
    case "CUIL":
      return "Ej: 20-12345678-9";
    case "PASAPORTE":
      return "Ej: AAA123456";
    case "OTRO":
      return "Ej: LC 1234567, LE 987654, CI extranjera";
  }
}

/**
 * Devuelve un texto de ayuda que describe el formato esperado.
 * Se muestra debajo del input como hint contextual.
 */
export function getHintDocumento(tipo: TipoDocumento): string {
  switch (tipo) {
    case "DNI":
      return "7 u 8 dígitos, sin puntos ni espacios";
    case "CUIT":
    case "CUIL":
      return "11 dígitos con dígito verificador";
    case "PASAPORTE":
      return "5 a 15 caracteres alfanuméricos";
    case "OTRO":
      return "Libreta Cívica, Libreta de Enrolamiento, CI extranjera u otros";
  }
}

// ============================================================================
// Re-exports desde cuit.ts para conveniencia.
// Permite que otros módulos importen todo lo relacionado con documentos
// desde este archivo sin tener que conocer la existencia de cuit.ts.
// ============================================================================
export { validarCuit, formatearCuit, limpiarCuit, obtenerErrorCuit };