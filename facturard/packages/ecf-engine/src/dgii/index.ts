export { autenticar } from './auth';
export { enviarECF, enviarResumenFC } from './sender';
export { consultarEstado } from './status';
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
export { DgiiApiError, ENDPOINTS_CERTECF, ENDPOINTS_ECF } from './types';
