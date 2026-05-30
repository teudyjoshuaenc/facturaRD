import { calcularItems, calcularTotales } from '../calculator';
import { buildECF33Xml, buildECF34Xml } from './builder';
import { validateECF33, validateECF34 } from './validator';
import type {
  ECF33Input,
  ECF34Input,
  GenerarECF33Result,
  GenerarECF34Result,
} from './types';

export type {
  ECF33Input,
  ECF34Input,
  IdDoc33,
  IdDoc34,
  InformacionReferencia,
  CodigoModificacion,
  GenerarECF33Result,
  GenerarECF34Result,
} from './types';

/**
 * Genera un XML de e-CF Tipo 33 (Nota de Débito Electrónica) válido según el
 * XSD de la DGII. Incrementa el monto de la factura original referenciada.
 *
 * Requiere `referencia.codigoModificacion = 3` (corrección de montos).
 *
 * @throws {Error} si el monto sería mayor al del comprobante original (validación de negocio)
 * @throws {Error} si el XML generado no pasa la validación XSD
 */
export function generarECF33(input: ECF33Input): GenerarECF33Result {
  const items = calcularItems(input.items);
  const totales = calcularTotales(items);
  const xml = buildECF33Xml(input, items, totales);
  const validation = validateECF33(xml);

  if (!validation.valid) {
    throw new Error(
      `El e-CF 33 generado no es válido según el XSD:\n${validation.errors.join('\n')}`,
    );
  }

  return { xml, totales, items, validation };
}

/**
 * Genera un XML de e-CF Tipo 34 (Nota de Crédito Electrónica) válido según el
 * XSD de la DGII. Reduce o anula el monto de la factura original referenciada.
 *
 * - `indicadorNotaCredito = 1`: anulación total del comprobante original
 * - `indicadorNotaCredito = 2`: corrección parcial de texto o montos
 *
 * El monto de la nota de crédito no puede superar el del comprobante original.
 *
 * @throws {Error} si el XML generado no pasa la validación XSD
 */
export function generarECF34(input: ECF34Input): GenerarECF34Result {
  const items = calcularItems(input.items);
  const totales = calcularTotales(items);
  const xml = buildECF34Xml(input, items, totales);
  const validation = validateECF34(xml);

  if (!validation.valid) {
    throw new Error(
      `El e-CF 34 generado no es válido según el XSD:\n${validation.errors.join('\n')}`,
    );
  }

  return { xml, totales, items, validation };
}
