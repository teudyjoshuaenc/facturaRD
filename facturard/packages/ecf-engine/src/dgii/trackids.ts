import { resolveEndpoints, DgiiApiError, type DgiiClientConfig } from './types';

const TIMEOUT_MS = 10000;

/** Una respuesta del servicio Consulta TrackIds (Descripción Técnica e-CF). */
export interface DgiiTrackIdDetalle {
  trackId: string | null;
  /** 'No encontrado' | 'Aceptado' | 'Rechazado' | 'Aceptado Condicional' | 'En proceso' */
  estado: string | null;
  fechaRecepcion: string | null;
}

export interface ConsultaTrackIdsResultado {
  /** true si la DGII tiene AL MENOS un envío de este e-NCF (en cualquier estado). */
  recibido: boolean;
  detalles: DgiiTrackIdDetalle[];
}

function esNoEncontrado(estado: string | null): boolean {
  return estado == null || estado.toLowerCase().replace(/\s+/g, '') === 'noencontrado';
}

/**
 * ¿La DGII ya recibió este e-NCF para este emisor?
 *
 * Endpoint: GET {trackids}/api/TrackIds/Consulta?RncEmisor=<rnc>&Encf=<eNCF>
 * Devuelve la lista de TrackIds del e-NCF; un único detalle con estado
 * "No encontrado" significa que el número nunca llegó a la DGII.
 *
 * Cualquier envío cuenta como "recibido", también los RECHAZADOS: el detector de
 * secuencias sólo avanza contadores, así que tratar un rechazado como usado es
 * el lado seguro (a lo sumo se salta un número, nunca se repite uno).
 *
 * Lanza DgiiApiError ante cualquier respuesta que no sea 200 con JSON válido:
 * quien llama NO debe interpretar un error como "número libre".
 */
export async function consultarTrackIds(
  rncEmisor: string,
  eNCF: string,
  token: string,
  config: Pick<DgiiClientConfig, 'env'>,
): Promise<ConsultaTrackIdsResultado> {
  const { trackids } = resolveEndpoints(config.env);
  const url =
    `${trackids}/api/TrackIds/Consulta` +
    `?RncEmisor=${encodeURIComponent(rncEmisor)}&Encf=${encodeURIComponent(eNCF)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new DgiiApiError(`Error al consultar TrackIds de ${eNCF}`, res.status, text);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new DgiiApiError('Respuesta de TrackIds con formato inesperado', res.status, text);
  }

  // La doc muestra un objeto; el servicio devuelve una lista. Se aceptan ambos.
  const lista = (Array.isArray(body) ? body : [body]) as DgiiTrackIdDetalle[];
  if (lista.some((d) => d === null || typeof d !== 'object')) {
    throw new DgiiApiError('Respuesta de TrackIds con formato inesperado', res.status, text);
  }
  const detalles = lista.map((d) => ({
    trackId: d.trackId ?? null,
    estado: d.estado ?? null,
    fechaRecepcion: d.fechaRecepcion ?? null,
  }));

  return { recibido: detalles.some((d) => !esNoEncontrado(d.estado)), detalles };
}
