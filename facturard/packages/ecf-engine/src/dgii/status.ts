import {
  resolveEndpoints,
  DgiiApiError,
  type DgiiClientConfig,
  type DgiiResultadoResponse,
} from './types';

const DELAY_MS = 5000;
const MAX_INTENTOS = 12;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Consulta el estado de un e-CF enviado a la DGII.
 * Reintenta cada 3 s hasta 10 veces mientras el estado sea 'EnProceso'.
 *
 * Endpoint: GET {consulta}/api/Consultas/Estado?trackId=<id>
 */
export async function consultarEstado(
  trackId: string,
  token: string,
  config: Pick<DgiiClientConfig, 'env'>,
): Promise<DgiiResultadoResponse> {
  const { consulta } = resolveEndpoints(config.env);
  const url = `${consulta}/api/Consultas/Estado?trackId=${encodeURIComponent(trackId)}`;

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new DgiiApiError(
        `Error al consultar estado (intento ${intento})`,
        res.status,
        await res.text(),
      );
    }

    const text = await res.text();
    let resultado: DgiiResultadoResponse;
    try {
      resultado = JSON.parse(text) as DgiiResultadoResponse;
    } catch {
      throw new DgiiApiError('Respuesta de estado con formato inesperado', undefined, text);
    }

    // La DGII puede devolver 'En Proceso' (con espacio) o 'EnProceso' (sin espacio)
    const enProceso = resultado.estado != null &&
      resultado.estado.toLowerCase().replace(/\s+/g, '') === 'enproceso';

    if (!enProceso) {
      return resultado;
    }

    console.log(`   [intento ${intento}/${MAX_INTENTOS}] Estado: ${resultado.estado} — reintentando en ${DELAY_MS / 1000}s...`);

    if (intento < MAX_INTENTOS) {
      await sleep(DELAY_MS);
    }
  }

  throw new DgiiApiError(
    `Timeout: el e-CF sigue En Proceso después de ${MAX_INTENTOS} intentos (${MAX_INTENTOS * DELAY_MS / 1000}s)`,
  );
}
