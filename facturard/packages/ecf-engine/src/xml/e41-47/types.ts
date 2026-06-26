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

// ── Referencia opcional (condicional=2 en E41/E43/E44/E45/E46/E47) ─────────────

export type CodigoModificacion = 1 | 2 | 3 | 4 | 5;

export interface InformacionReferenciaOpcional {
  ncfModificado: string;
  fechaNCFModificado: string;
  codigoModificacion: CodigoModificacion;
  rncOtroContribuyente?: string;
  razonModificacion?: string;
}

// ── E41 — Comprobante de Compras ─────────────────────────────────────────────
// RNCComprador=1 (proveedor obligatorio), TipoIngresos=0, TipoPago=1

export interface IdDoc41 {
  eNCF: string;
  fechaVencimientoSecuencia: string;
  tipoPago?: TipoPago;
  fechaLimitePago?: string;
  fechaHoraFirma?: string;
}

export interface ECF41Input {
  idDoc: IdDoc41;
  emisor: Emisor;
  /** En E41 el "comprador" representa al proveedor del que se compra */
  comprador: Comprador;
  items: LineaDetalle[];
  referencia?: InformacionReferenciaOpcional;
}

// ── E43 — Gastos Menores ──────────────────────────────────────────────────────
// Sin comprador, IndicadorFacturacion DEBE ser 4 (Exento), TipoIngresos=0

export interface IdDoc43 {
  eNCF: string;
  fechaVencimientoSecuencia: string;
  tipoPago?: TipoPago;
  fechaHoraFirma?: string;
}

export interface ECF43Input {
  idDoc: IdDoc43;
  emisor: Emisor;
  items: LineaDetalle[];
  referencia?: InformacionReferenciaOpcional;
}

// ── E44 — Regímenes Especiales ───────────────────────────────────────────────
// TipoIngresos=1, TipoPago=1, RNCComprador=2, RazonSocialComprador=1

export interface IdDoc44 {
  eNCF: string;
  fechaVencimientoSecuencia: string;
  tipoIngresos?: TipoIngresos;
  tipoPago?: TipoPago;
  fechaLimitePago?: string;
  fechaHoraFirma?: string;
}

export interface ECF44Input {
  idDoc: IdDoc44;
  emisor: Emisor;
  comprador: Comprador;
  items: LineaDetalle[];
  referencia?: InformacionReferenciaOpcional;
}

// ── E45 — Gubernamental ───────────────────────────────────────────────────────
// TipoIngresos=1, TipoPago=1, RNCComprador=1, RazonSocialComprador=1

export interface IdDoc45 {
  eNCF: string;
  fechaVencimientoSecuencia: string;
  tipoIngresos?: TipoIngresos;
  tipoPago?: TipoPago;
  fechaLimitePago?: string;
  fechaHoraFirma?: string;
}

export interface ECF45Input {
  idDoc: IdDoc45;
  emisor: Emisor;
  comprador: Comprador;
  items: LineaDetalle[];
  referencia?: InformacionReferenciaOpcional;
}

// ── E46 — Exportaciones ───────────────────────────────────────────────────────
// TipoIngresos=1, TipoPago=1, RazonSocialComprador=1, PaisComprador=2
// IndicadorFacturacion DEBE ser 3 (ITBIS tasa cero)

export interface CompradorExportacion {
  rnc?: string;
  identificadorExtranjero?: string;
  razonSocial: string;
  contacto?: string;
  correo?: string;
  direccion?: string;
  municipio?: string;
  provincia?: string;
  /** Código ISO del país — condicional=2 */
  paisComprador?: string;
}

export interface IdDoc46 {
  eNCF: string;
  fechaVencimientoSecuencia: string;
  tipoIngresos?: TipoIngresos;
  tipoPago?: TipoPago;
  fechaLimitePago?: string;
  fechaHoraFirma?: string;
}

export interface ECF46Input {
  idDoc: IdDoc46;
  emisor: Emisor;
  comprador: CompradorExportacion;
  items: LineaDetalle[];
  referencia?: InformacionReferenciaOpcional;
}

// ── E47 — Pagos al Exterior ───────────────────────────────────────────────────
// TipoIngresos=0, TipoPago=3(opcional), RNCComprador=0, PaisComprador=1(obligatorio)
// IdentificadorExtranjero=2(condicional), IndicadorBienoServicio DEBE ser 2 (Servicio)

export interface BeneficiarioExterior {
  identificadorExtranjero?: string;
  razonSocial?: string;
  /** Código ISO del país — obligatorio=1 */
  paisComprador: string;
}

export interface IdDoc47 {
  eNCF: string;
  fechaVencimientoSecuencia: string;
  tipoPago?: TipoPago;
  fechaHoraFirma?: string;
}

export interface ECF47Input {
  idDoc: IdDoc47;
  emisor: Emisor;
  beneficiario: BeneficiarioExterior;
  items: LineaDetalle[];
  referencia?: InformacionReferenciaOpcional;
}

// ── Resultados ────────────────────────────────────────────────────────────────

export interface GenerarECFResult {
  xml: string;
  totales: Totales;
  items: ItemCalculado[];
  validation: ValidationResult;
}
