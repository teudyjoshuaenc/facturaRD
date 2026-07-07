import type {
  Emisor,
  Comprador,
  LineaDetalle,
  TipoPago,
  TipoIngresos,
  ValidationResult,
  ItemCalculado,
  Totales,
} from '../types';

export type { Emisor, Comprador, LineaDetalle, TipoPago, TipoIngresos, ValidationResult, ItemCalculado, Totales };

// ── Referencia obligatoria al e-CF original ───────────────────────────────────

/** CodigoModificacion según XSD oficial (CodigoModificacionType) */
export type CodigoModificacion =
  | 1  // Anulación total del NCF modificado
  | 2  // Corrección de montos del comprobante fiscal modificado
  | 3  // Corrección de texto del comprobante fiscal modificado
  | 4  // Reemplazo de NCF emitido en contingencia
  | 5; // Referencia a factura de consumo electrónica

export interface InformacionReferencia {
  /** e-NCF del comprobante original que se modifica */
  ncfModificado: string;
  /** DD-MM-YYYY — fecha de emisión del comprobante original */
  fechaNCFModificado: string;
  /** Código de la modificación que se está realizando */
  codigoModificacion: CodigoModificacion;
  /** RNC del otro contribuyente (opcional) */
  rncOtroContribuyente?: string;
  /** Razón de la modificación — opcional para E33/E34 */
  razonModificacion?: string;
}

// ── IdDoc E33 (Nota de Débito) ────────────────────────────────────────────────

export interface IdDoc33 {
  /** 13 alfanuméricos. Ej: E330000000001 */
  eNCF: string;
  /** DD-MM-YYYY — obligatorio=1 para E33 */
  fechaVencimientoSecuencia: string;
  tipoIngresos?: TipoIngresos;
  tipoPago?: TipoPago;
  /** DD-MM-YYYY — requerido cuando tipoPago = 2 */
  fechaLimitePago?: string;
  /** DD-MM-YYYY HH:MM:SS — si se omite se usa la fecha/hora actual */
  fechaHoraFirma?: string;
  /** 0 = precios sin ITBIS (default), 1 = con ITBIS incluido */
  indicadorMontoGravado?: 0 | 1;
}

// ── IdDoc E34 (Nota de Crédito) ───────────────────────────────────────────────
// E34 no tiene FechaVencimientoSecuencia (obligatoriedad=0 según PDF)

export interface IdDoc34 {
  eNCF: string;
  tipoIngresos?: TipoIngresos;
  tipoPago?: TipoPago;
  fechaLimitePago?: string;
  fechaHoraFirma?: string;
  indicadorMontoGravado?: 0 | 1;
  // Regla de 30 días (XSD e-CF 34 v.1.0, integer 0..1): 0 si el e-CF afectado
  // tiene <=30 días calendario respecto a la nota; 1 si >30 (no rebaja ITBIS).
  indicadorNotaCredito?: 0 | 1;
}

// ── Input E33 ─────────────────────────────────────────────────────────────────

export interface ECF33Input {
  idDoc: IdDoc33;
  emisor: Emisor;
  comprador: Comprador;
  items: LineaDetalle[];
  /** Referencia obligatoria al comprobante original (CodigoModificacion típico = 3) */
  referencia: InformacionReferencia;
}

// ── Input E34 ─────────────────────────────────────────────────────────────────

export interface ECF34Input {
  idDoc: IdDoc34;
  emisor: Emisor;
  comprador: Comprador;
  items: LineaDetalle[];
  /** Referencia obligatoria al comprobante original (CodigoModificacion típico = 1 o 2) */
  referencia: InformacionReferencia;
}

// ── Resultados ────────────────────────────────────────────────────────────────

export interface GenerarECF33Result {
  xml: string;
  totales: Totales;
  items: ItemCalculado[];
  validation: ValidationResult;
}

export interface GenerarECF34Result {
  xml: string;
  totales: Totales;
  items: ItemCalculado[];
  validation: ValidationResult;
}
