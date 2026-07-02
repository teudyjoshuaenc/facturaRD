import { calcularItems, calcularTotales } from './calculator';
import { buildECF31Xml } from './builder';
import { validateECF31 } from './validator';
import type {
  ECF31Input,
  ItemCalculado,
  Totales,
  ValidationResult,
} from './types';

export type { ECF31Input, ItemCalculado, Totales, ValidationResult };

// ── e-CF Tipo 32 ──────────────────────────────────────────────────────────────
export {
  generarECF32,
  generarECF32ParaRFCE,
  generarRFCE32,
  MONTO_LIMITE_RFCE,
} from './e32';
export type {
  ECF32Input,
  IdDoc32,
  CompradorConsumo,
  ReferenciaRFCE,
  GenerarECF32Result,
  GenerarRFCE32Result,
} from './e32';

// ── e-CF Tipo 33 (Nota de Débito) y 34 (Nota de Crédito) ─────────────────────
export { generarECF33, generarECF34 } from './e33-34';
export type {
  ECF33Input,
  ECF34Input,
  IdDoc33,
  IdDoc34,
  InformacionReferencia,
  CodigoModificacion,
  GenerarECF33Result,
  GenerarECF34Result,
} from './e33-34';

// ── e-CF Tipos 41, 43, 44, 45, 46, 47 ────────────────────────────────────────
export {
  generarECF41,
  generarECF43,
  generarECF44,
  generarECF45,
  generarECF46,
  generarECF47,
} from './e41-47';
export type {
  ECF41Input,
  ECF43Input,
  ECF44Input,
  ECF45Input,
  ECF46Input,
  ECF47Input,
  IdDoc41,
  IdDoc43,
  IdDoc44,
  IdDoc45,
  IdDoc46,
  IdDoc47,
  CompradorExportacion,
  BeneficiarioExterior,
  InformacionReferenciaOpcional,
  GenerarECFResult,
} from './e41-47';

export {
  INDICADOR_FACTURACION,
  ITBIS_TASA,
} from './types';
export type {
  IdDoc,
  Emisor,
  Comprador,
  LineaDetalle,
  IndicadorFacturacion,
  IndicadorBienoServicio,
  TipoPago,
  TipoIngresos,
} from './types';

export interface GenerarECF31Result {
  xml: string;
  totales: Totales;
  items: ItemCalculado[];
  validation: ValidationResult;
}

/**
 * Genera un XML de e-CF Tipo 31 (Factura de Crédito Fiscal) válido según el
 * esquema XSD de la DGII, listo para ser firmado con `firmarDocumento`.
 *
 * Lanza un error si el XML generado no pasa la validación XSD.
 */
export function generarECF31(input: ECF31Input): GenerarECF31Result {
  const items = calcularItems(input.items);
  const totales = calcularTotales(items);
  const xml = buildECF31Xml(input, items, totales);
  const validation = validateECF31(xml);

  if (!validation.valid) {
    throw new Error(
      `El XML generado no es válido según el XSD e-CF 31:\n${validation.errors.join('\n')}`,
    );
  }

  return { xml, totales, items, validation };
}
