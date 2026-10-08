export { autenticar } from './auth';
export { enviarECF, enviarResumenFC } from './sender';
export { consultarEstado } from './status';
export { consultarTrackIds } from './trackids';
export type { DgiiTrackIdDetalle, ConsultaTrackIdsResultado } from './trackids';
export { detectarUltimaSecuencia, MAX_SECUENCIA } from './secuencia-detector';
export type { DetectarSecuenciaOpciones, DetectarSecuenciaResultado } from './secuencia-detector';
export { enviarAprobacionComercial, buildAprobacionXml } from './approval';
export type {
  DgiiClientConfig,
  DgiiEnv,
  DgiiEndpoints,
  DgiiTokenResponse,
  DgiiRecepcionResponse,
  DgiiRecepcionFCResponse,
  DgiiResultadoResponse,
  DgiiMensaje,
  EstadoECF,
  EstadoAprobacion,
  DgiiAprobacionInput,
  DgiiAprobacionResponse,
} from './types';
export { DgiiApiError, ENDPOINTS_TESTECF, ENDPOINTS_CERTECF, ENDPOINTS_ECF, resolveEndpoints, resolveDgiiEnv } from './types';
