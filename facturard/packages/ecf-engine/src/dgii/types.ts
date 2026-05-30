// ──────────────────────────────────────────────────────────────────────────────
// Tipos del cliente DGII e-CF — basados en la API real (Swagger definitions)
// Endpoints confirmados del portal Paso 2 de certificación
// ──────────────────────────────────────────────────────────────────────────────

export interface DgiiEndpoints {
  /** Servicio de autenticación (semilla / token) */
  auth: string;
  /** Servicio de recepción de e-CF */
  recepcion: string;
  /** Servicio de consulta de estado */
  consulta: string;
  /** Servicio de recepción de resúmenes FC (fc.dgii.gov.do) */
  fc: string;
  /** Servicio de aprobación comercial (Paso 3 certificación) */
  aprobacion: string;
}

/** Ambiente de certificación (certecf) */
export const ENDPOINTS_CERTECF: DgiiEndpoints = {
  auth:       'https://ecf.dgii.gov.do/CerteCF/Autenticacion',
  recepcion:  'https://ecf.dgii.gov.do/CerteCF/Recepcion',
  consulta:   'https://ecf.dgii.gov.do/CerteCF/ConsultaResultado',
  fc:         'https://fc.dgii.gov.do/CerteCF/RecepcionFC',
  aprobacion: 'https://ecf.dgii.gov.do/CerteCF/AprobacionComercial',
};

/** Ambiente de producción (ecf) */
export const ENDPOINTS_ECF: DgiiEndpoints = {
  auth:       'https://ecf.dgii.gov.do/ECF/Autenticacion',
  recepcion:  'https://ecf.dgii.gov.do/ECF/Recepcion',
  consulta:   'https://ecf.dgii.gov.do/ECF/ConsultaResultado',
  fc:         'https://fc.dgii.gov.do/ECF/RecepcionFC',
  aprobacion: 'https://ecf.dgii.gov.do/ECF/AprobacionComercial',
};

export type DgiiEnv = 'certecf' | 'ecf';

export interface DgiiClientConfig {
  /** Ruta al P12 en disco — usar certPath O p12Buffer, no ambos */
  certPath?: string;
  /** Buffer del P12 en memoria (alternativa a certPath) */
  p12Buffer?: Buffer;
  /** Passphrase del P12 */
  passphrase: string;
  /** Ambiente: 'certecf' (default) o 'ecf' */
  env?: DgiiEnv;
}

export function resolveEndpoints(env: DgiiEnv | undefined): DgiiEndpoints {
  return env === 'ecf' ? ENDPOINTS_ECF : ENDPOINTS_CERTECF;
}

// ── Autenticación ─────────────────────────────────────────────────────────────
// GET  {auth}/api/Autenticacion/Semilla
// POST {auth}/api/Autenticacion/ValidarSemilla

export interface DgiiTokenResponse {
  token: string;
  expira: string;
  expedido: string;
}

// ── Recepción e-CF ────────────────────────────────────────────────────────────
// POST {recepcion}/api/FacturasElectronicas

export interface DgiiRecepcionResponse {
  trackId: string | null;
  error: string | null;
  mensaje: string | null;
}

// ── Recepción Resúmenes FC ────────────────────────────────────────────────────
// POST {fc}/api/recepcion/ecf
// Respuesta sincrónica — sin trackId

export interface DgiiRecepcionFCResponse {
  codigo: number | null;
  estado: string | null;
  mensajes: DgiiMensaje[] | null;
  encf: string | null;
  secuenciaUtilizada: boolean;
}

// ── Consulta de resultado ─────────────────────────────────────────────────────
// GET {consulta}/api/Consultas/Estado?trackId=<id>

export interface DgiiMensaje {
  valor: string | null;
  codigo: number | null;
}

export type EstadoECF =
  | 'Aceptado'
  | 'AceptadoCondicional'
  | 'Rechazado'
  | 'EnProceso';

export interface DgiiResultadoResponse {
  trackId: string | null;
  codigo: string | null;
  estado: EstadoECF | string | null;
  rnc: string | null;
  encf: string | null;
  secuenciaUtilizada: boolean;
  fechaRecepcion: string | null;
  mensajes: DgiiMensaje[] | null;
}

// ── Aprobación Comercial ──────────────────────────────────────────────────────
// POST {aprobacion}/api/AprobacionComercial
// Elemento raíz: <ACECF><DetalleAprobacionComercial>...</DetalleAprobacionComercial></ACECF>

/** Estado de aprobación: 1=Aceptado, 2=Rechazado */
export type EstadoAprobacion = 1 | 2;

export interface DgiiAprobacionInput {
  /** RNC del emisor del e-CF original */
  rncEmisor: string;
  /** Número de e-CF a aprobar/rechazar */
  eNCF: string;
  /** Fecha de emisión del e-CF original (DD-MM-YYYY) */
  fechaEmision: string;
  /** Monto total del e-CF original */
  montoTotal: number;
  /** RNC del comprador (quien envía la aprobación) */
  rncComprador: string;
  /** 1=Aceptado, 2=Rechazado */
  estado: EstadoAprobacion;
  /** Requerido cuando estado=2 */
  detalleMotivoRechazo?: string;
  /** Timestamp exacto del dataset DGII (DD-MM-YYYY HH:MM:SS) */
  fechaHoraAprobacionComercial: string;
}

export interface DgiiAprobacionResponse {
  /** '01'=Aprobada, '02'=Rechazada */
  codigo: string | null;
  estado: string | null;
  mensaje: string[];
}

// ── Errores ───────────────────────────────────────────────────────────────────

export class DgiiApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = 'DgiiApiError';
  }
}
