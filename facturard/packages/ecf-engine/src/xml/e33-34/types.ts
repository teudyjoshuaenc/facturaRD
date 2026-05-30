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
  | 1  // Anula el NCF modificado
  | 2  // Corrige texto del comprobante fiscal modificado
  | 3  // Corrige montos del NCF modificado
  | 4; // Reemplazo NCF emitido en contingencia

export interface InformacionReferencia {
  /** e-NCF del comprobante original que se modifica */
  ncfModificado: string;
  /** DD-MM-YYYY — fecha de emisión del comprobante original */
  fechaNCFModificado: string;
  /** Código de la modificación que se está realizando */
  codigoModificacion: CodigoModificacion;
  /** RNC del otro contribuyente (opcional) */
  rncOtroContribuyente?: string;
}

// ── IdDoc E33 (Nota de Débito) ────────────────────────────────────────────────

export interface IdDoc33 {
  /** 13 alfanuméricos. Ej: E330000000001 */
  eNCF: string;
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

export interface IdDoc34 extends IdDoc33 {
  /**
   * IndicadorNotaCredito:
   *   1 = Anulación (devuelve el valor total del original)
   *   2 = Corrección de texto o montos parciales
   */
  indicadorNotaCredito?: 1 | 2;
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
