import { calcularItems, calcularTotales } from '../calculator';
import { buildECF32Xml } from './builder';
import { buildRFCE32Xml } from './rfce-builder';
import { validateECF32, validateRFCE32 } from './validator';
import { MONTO_LIMITE_RFCE } from './types';
import type {
  ECF32Input,
  GenerarECF32Result,
  GenerarRFCE32Result,
} from './types';

export { MONTO_LIMITE_RFCE };
export type { ECF32Input, GenerarECF32Result, GenerarRFCE32Result };
export type { IdDoc32, CompradorConsumo, ReferenciaRFCE } from './types';

/**
 * Genera el RFCE-32 (Resumen de Factura de Consumo Electrónica).
 *
 * Debe enviarse a la DGII y ser aceptado ANTES de llamar a `generarECF32`
 * cuando el monto total sea menor a RD$250,000.
 */
export function generarRFCE32(input: ECF32Input): GenerarRFCE32Result {
  const items = calcularItems(input.items);
  const totales = calcularTotales(items);
  const xml = buildRFCE32Xml(input, totales);
  const validation = validateRFCE32(xml);

  if (!validation.valid) {
    throw new Error(
      `El RFCE-32 generado no es válido según el XSD:\n${validation.errors.join('\n')}`,
    );
  }

  return { xml, totales, validation };
}

/**
 * Genera el XML del e-CF Tipo 32 (Factura de Consumo Electrónica).
 *
 * **Flujo A** (montoTotal ≥ RD$250,000): se puede llamar directamente.
 *
 * **Flujo B** (montoTotal < RD$250,000): requiere haber enviado y obtenido
 * la aceptación del RFCE-32 primero. Pasar los datos del RFCE aceptado en
 * `input.rfce`. Si `input.rfce` está ausente, lanza un error.
 *
 * @throws {Error} si el monto es < 250 K y no se proporcionó `input.rfce`
 * @throws {Error} si el XML generado no pasa la validación XSD
 */
export function generarECF32(input: ECF32Input): GenerarECF32Result {
  const items = calcularItems(input.items);
  const totales = calcularTotales(items);

  const flujo: 'A' | 'B' = totales.montoTotal >= MONTO_LIMITE_RFCE ? 'A' : 'B';

  if (flujo === 'B' && !input.rfce) {
    throw new Error(
      `e-CF 32 Flujo B: el monto total (${totales.montoTotal.toFixed(2)}) es menor a ` +
      `RD$${MONTO_LIMITE_RFCE.toLocaleString()}. ` +
      `Debe generar y enviar el RFCE-32 primero (generarRFCE32) y pasar el ` +
      `resultado aceptado en input.rfce antes de llamar a generarECF32.`,
    );
  }

  const xml = buildECF32Xml(input, items, totales);
  const validation = validateECF32(xml);

  if (!validation.valid) {
    throw new Error(
      `El e-CF 32 generado no es válido según el XSD:\n${validation.errors.join('\n')}`,
    );
  }

  return { xml, totales, items, validation, flujo };
}
