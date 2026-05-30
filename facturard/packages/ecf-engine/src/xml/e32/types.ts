import type { Emisor, LineaDetalle, TipoPago, TipoIngresos } from '../types';

export type { Emisor, LineaDetalle, TipoPago, TipoIngresos };

// ── Umbral de flujo ────────────────────────────────────────────────────────────

/** Facturas de consumo por debajo de este monto deben tramitar el RFCE primero */
export const MONTO_LIMITE_RFCE = 250_000;

// ── IdDoc del e-CF 32 ─────────────────────────────────────────────────────────
// Difiere del IdDoc del e-CF 31: no tiene FechaVencimientoSecuencia; tiene
// campos adicionales de forma de pago y paginación.

export interface IdDoc32 {
  /** 13 alfanuméricos. Ej: E320000000001 */
  eNCF: string;
  tipoIngresos?: TipoIngresos;
  tipoPago?: TipoPago;
  /** DD-MM-YYYY — requerido cuando tipoPago = 2 */
  fechaLimitePago?: string;
  /** DD-MM-YYYY HH:MM:SS — si se omite se usa la fecha/hora actual */
  fechaHoraFirma?: string;
  /** 0 = precios sin ITBIS (default), 1 = con ITBIS incluido */
  indicadorMontoGravado?: 0 | 1;
  /** 1 = servicio todo incluido (propina legal, etc.) */
  indicadorServicioTodoIncluido?: 1;
}

// ── Comprador del e-CF 32 ─────────────────────────────────────────────────────
// En e-CF 32 (B2C) todos los campos son opcionales: el consumidor puede ser anónimo.

export interface CompradorConsumo {
  /** RNC o cédula: 9 u 11 dígitos */
  rnc?: string;
  razonSocial?: string;
  contacto?: string;
  correo?: string;
  direccion?: string;
  municipio?: string;
  provincia?: string;
  identificadorExtranjero?: string;
}

// ── Referencia al RFCE aceptado (Flujo B) ────────────────────────────────────

export interface ReferenciaRFCE {
  /** eNCF del RFCE aceptado por la DGII */
  eNCF: string;
  /** DD-MM-YYYY — fecha de emisión del RFCE aceptado */
  fecha: string;
  /** RNC del otro contribuyente (opcional) */
  rnc?: string;
}

// ── Input principal ───────────────────────────────────────────────────────────

export interface ECF32Input {
  idDoc: IdDoc32;
  emisor: Emisor;
  /** Si se omite se genera un <Comprador> vacío (consumidor anónimo) */
  comprador?: CompradorConsumo;
  items: LineaDetalle[];
  /**
   * Requerido cuando montoTotal < MONTO_LIMITE_RFCE.
   * Debe contener los datos del RFCE previamente aceptado por la DGII.
   */
  rfce?: ReferenciaRFCE;
  /**
   * Código de seguridad de 6 caracteres requerido por el XSD del RFCE-32.
   * Hash derivado del contenido de la factura original.
   * Si se omite se usa '000000' (válido para pruebas).
   */
  codigoSeguridadeCF?: string;
}

// ── Resultados ────────────────────────────────────────────────────────────────

export interface GenerarECF32Result {
  xml: string;
  totales: import('../types').Totales;
  items: import('../types').ItemCalculado[];
  validation: import('../types').ValidationResult;
  /** 'A' = flujo directo (≥ 250 K), 'B' = con RFCE (< 250 K) */
  flujo: 'A' | 'B';
}

export interface GenerarRFCE32Result {
  xml: string;
  totales: import('../types').Totales;
  validation: import('../types').ValidationResult;
}
