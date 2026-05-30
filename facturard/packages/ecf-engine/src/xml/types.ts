// ──────────────────────────────────────────────────────────────────────────────
// Constantes del dominio DGII
// ──────────────────────────────────────────────────────────────────────────────

export const ITBIS_TASA = {
  TASA1: 0.18,  // 18% — tasa estándar
  TASA2: 0.16,  // 16% — productos agropecuarios y medicamentos (transición)
  TASA3: 0.00,  // 0%  — tasa cero
} as const;

/** IndicadorFacturacion según XSD oficial e-CF-31-v.1.0 */
export const INDICADOR_FACTURACION = {
  GRAVADO_I1: 1,  // ITBIS 18%
  GRAVADO_I2: 2,  // ITBIS 16%
  GRAVADO_I3: 3,  // ITBIS 0%
  EXENTO:     4,  // Exento de ITBIS
} as const;

/** Porcentaje entero que representa cada tasa — campo ITBIS1/2/3 en Totales */
export const ITBIS_PCT: Record<1 | 2 | 3, number> = { 1: 18, 2: 16, 3: 0 };

// ──────────────────────────────────────────────────────────────────────────────
// Tipos primitivos (alineados con XSD oficial)
// ──────────────────────────────────────────────────────────────────────────────

export type IndicadorFacturacion = 1 | 2 | 3 | 4;

/** IndicadorBienoServicioType: 1=Bien, 2=Servicio (el XSD no incluye 3) */
export type IndicadorBienoServicio = 1 | 2;

/** TipoPagoType: 1=Contado, 2=Crédito, 3=Gratuito (valores del XSD oficial) */
export type TipoPago = 1 | 2 | 3;

export type TipoIngresos = '01' | '02' | '03' | '04' | '05' | '06';

// ──────────────────────────────────────────────────────────────────────────────
// Interfaces de entrada
// ──────────────────────────────────────────────────────────────────────────────

export interface IdDoc {
  /** Formato: 13 alfanuméricos. Ej: E310000000001 */
  eNCF: string;
  /** DD-MM-YYYY */
  fechaVencimientoSecuencia: string;
  /** 0 = precios sin ITBIS (default), 1 = con ITBIS incluido */
  indicadorMontoGravado?: 0 | 1;
  tipoIngresos?: TipoIngresos;
  tipoPago?: TipoPago;
  /** DD-MM-YYYY — requerido cuando tipoPago = 2 (crédito) */
  fechaLimitePago?: string;
  /** DD-MM-YYYY HH:MM:SS — si se omite se usa la fecha/hora actual */
  fechaHoraFirma?: string;
}

export interface Emisor {
  /** RNC: 9 u 11 dígitos */
  rnc: string;
  razonSocial: string;
  nombreComercial?: string;
  sucursal?: string;
  /** Obligatorio */
  direccion: string;
  /** Código DGII de 6 dígitos (ProvinciaMunicipioType). Ej: "010101" */
  municipio?: string;
  /** Código DGII de 6 dígitos. Ej: "010000" */
  provincia?: string;
  /** Formato: 000-000-0000 */
  telefono?: string;
  /** Email válido ≤ 80 caracteres */
  correo?: string;
  actividadEconomica?: string;
  /** DD-MM-YYYY */
  fechaEmision: string;
}

export interface Comprador {
  /** RNC / cédula: 9 u 11 dígitos */
  rnc: string;
  razonSocial: string;
  contacto?: string;
  /** Email válido ≤ 80 caracteres */
  correo?: string;
  direccion?: string;
  /** Código DGII de 6 dígitos */
  municipio?: string;
  /** Código DGII de 6 dígitos */
  provincia?: string;
}

export interface LineaDetalle {
  nombre: string;
  descripcion?: string;
  cantidad: number;
  precioUnitario: number;
  indicadorFacturacion: IndicadorFacturacion;
  /** IndicadorBienoServicioType: 1=Bien, 2=Servicio */
  indicadorBienoServicio: IndicadorBienoServicio;
  /** Porcentaje de descuento 0-100 — se calcula internamente y sale como DescuentoMonto */
  descuentoPorcentaje?: number;
  /** Código de unidad DGII (UnidadMedidaType): entero 1-58 */
  unidadMedida?: number;
}

export interface ECF31Input {
  idDoc: IdDoc;
  emisor: Emisor;
  comprador: Comprador;
  items: LineaDetalle[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Tipos internos (calculados)
// ──────────────────────────────────────────────────────────────────────────────

export interface ItemCalculado extends LineaDetalle {
  numeroLinea: number;
  montoDescuento: number;
  /** Monto neto de la línea (después de descuento, antes de ITBIS) */
  montoItem: number;
  montoITBIS: number;
}

export interface Totales {
  /** Suma de I1+I2+I3 (MontoGravadoTotal en XSD oficial) */
  montoGravadoTotal: number;
  montoGravadoI1: number;
  montoGravadoI2: number;
  montoGravadoI3: number;
  montoExento: number;
  totalITBIS: number;
  totalITBIS1: number;
  totalITBIS2: number;
  totalITBIS3: number;
  montoTotal: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
