/**
 * Utilidades para validación y formateo de CUIT/CUIL.
 *
 * El CUIT (Código Único de Identificación Tributaria) es un identificador de
 * 11 dígitos usado en Argentina. El último dígito es un dígito verificador
 * calculado con módulo 11, lo que permite detectar la mayoría de los errores
 * de tipeo o números inventados.
 */

/**
 * Multiplicadores para el algoritmo de cálculo del dígito verificador.
 * Se aplican a los primeros 10 dígitos del CUIT.
 */
const MULTIPLICADORES_CUIT = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

/**
 * Limpia un CUIT dejando solo dígitos.
 * Ej: "20-12345678-9" → "20123456789"
 * Ej: "20 12345678 9" → "20123456789"
 */
export function limpiarCuit(cuit: string): string {
  return cuit.replace(/[^\d]/g, "");
}

/**
 * Calcula el dígito verificador de un CUIT a partir de los primeros 10 dígitos.
 * Devuelve un número del 0 al 9.
 * Casos especiales del algoritmo:
 *   - resto === 0 → dígito verificador es 0
 *   - resto === 1 → dígito verificador es 9 (algunos autores lo consideran inválido)
 *   - resto > 1  → dígito verificador es 11 - resto
 */
function calcularDigitoVerificador(primeros10Digitos: number[]): number {
  const suma = primeros10Digitos.reduce(
    (acc, digito, i) => acc + digito * MULTIPLICADORES_CUIT[i],
    0
  );
  const resto = suma % 11;

  if (resto === 0) return 0;
  if (resto === 1) return 9;
  return 11 - resto;
}

/**
 * Valida si una cadena es un CUIT/CUIL sintácticamente válido.
 *
 * Acepta formatos:
 *   - "20123456789"
 *   - "20-12345678-9"
 *   - "20 12345678 9"
 *
 * Devuelve true si:
 *   1. Tiene exactamente 11 dígitos.
 *   2. Los primeros dos dígitos corresponden a un tipo válido
 *      (20, 23, 24, 27 para personas físicas; 30, 33, 34 para jurídicas).
 *   3. El dígito verificador coincide con el calculado por módulo 11.
 */
export function validarCuit(cuit: string): boolean {
  const cuitLimpio = limpiarCuit(cuit);

  // Validación 1: longitud
  if (cuitLimpio.length !== 11) return false;

  // Validación 2: todos numéricos (redundante con limpiarCuit, pero explícito)
  if (!/^\d{11}$/.test(cuitLimpio)) return false;

  // Validación 3: prefijo válido
  const prefijo = cuitLimpio.substring(0, 2);
  const prefijosValidos = ["20", "23", "24", "27", "30", "33", "34"];
  if (!prefijosValidos.includes(prefijo)) return false;

  // Validación 4: dígito verificador
  const digitos = cuitLimpio.split("").map(Number);
  const digitoVerificadorEsperado = calcularDigitoVerificador(digitos.slice(0, 10));
  const digitoVerificadorReal = digitos[10];

  return digitoVerificadorEsperado === digitoVerificadorReal;
}

/**
 * Formatea un CUIT al formato canónico "XX-XXXXXXXX-X".
 * Si el CUIT no tiene 11 dígitos, lo devuelve tal cual (sin romper).
 */
export function formatearCuit(cuit: string): string {
  const cuitLimpio = limpiarCuit(cuit);
  if (cuitLimpio.length !== 11) return cuit;
  return `${cuitLimpio.substring(0, 2)}-${cuitLimpio.substring(2, 10)}-${cuitLimpio.substring(10)}`;
}

/**
 * Devuelve un mensaje descriptivo del error de un CUIT inválido.
 * Útil para mostrar en formularios. Devuelve null si el CUIT es válido.
 */
export function obtenerErrorCuit(cuit: string): string | null {
  const cuitLimpio = limpiarCuit(cuit);

  if (cuitLimpio.length === 0) {
    return "El CUIT es obligatorio";
  }
  if (cuitLimpio.length !== 11) {
    return `El CUIT debe tener 11 dígitos (tiene ${cuitLimpio.length})`;
  }
  if (!/^\d{11}$/.test(cuitLimpio)) {
    return "El CUIT solo puede contener números";
  }

  const prefijo = cuitLimpio.substring(0, 2);
  const prefijosValidos = ["20", "23", "24", "27", "30", "33", "34"];
  if (!prefijosValidos.includes(prefijo)) {
    return `El prefijo "${prefijo}" no es válido. Los prefijos válidos son: 20, 23, 24, 27 (personas físicas) y 30, 33, 34 (personas jurídicas)`;
  }

  const digitos = cuitLimpio.split("").map(Number);
  const digitoVerificadorEsperado = calcularDigitoVerificador(digitos.slice(0, 10));
  const digitoVerificadorReal = digitos[10];

  if (digitoVerificadorEsperado !== digitoVerificadorReal) {
    return `El dígito verificador no coincide. Verificá que el CUIT esté bien tipeado`;
  }

  return null;
}