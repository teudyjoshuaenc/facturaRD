/**
 * Detección del último número de secuencia usado ante la DGII.
 *
 * Un emisor que llega desde otro proveedor (o que reinstala FacturaRD con la base
 * vacía) ya consumió e-NCF que la DGII conoce; si FacturaRD empieza en 1 la DGII
 * rechaza por secuencia repetida. Aquí se busca el mayor número ya recibido sólo
 * con preguntas "¿existe el n?" (`usado`), sin listar nada:
 *
 *  1. Galope: desde el último conocido, saltos 1, 2, 4, 8… hasta dar con un libre.
 *  2. Búsqueda binaria entre el último usado y ese libre (asume números
 *     consecutivos, que es como se emiten).
 *  3. Ventana: revisa los `ventana` números siguientes por si hay huecos (e-NCF
 *     consumidos localmente que nunca llegaron a la DGII). Si encuentra uno usado,
 *     se reanuda el galope desde ahí.
 *
 * Coste: ~2·log2(N) + ventana consultas. Para N = 1,000 → ~30.
 */

/** Tope de `Secuencia.ultimaSecuencia` (columna Int de Postgres). */
export const MAX_SECUENCIA = 2_147_483_647;

export interface DetectarSecuenciaOpciones {
  /** Último número que ya se sabe usado (p.ej. el contador local). Default 0. */
  desde?: number;
  /** Números revisados después del último usado para saltar huecos. Default 10. */
  ventana?: number;
  /** Máximo de consultas antes de abortar (protege contra respuestas absurdas). Default 200. */
  maxConsultas?: number;
}

export interface DetectarSecuenciaResultado {
  /** Mayor número encontrado como usado (o `desde` si no se encontró ninguno mayor). */
  ultimaUsada: number;
  consultas: number;
}

export async function detectarUltimaSecuencia(
  usado: (n: number) => Promise<boolean>,
  opciones: DetectarSecuenciaOpciones = {},
): Promise<DetectarSecuenciaResultado> {
  const ventana = opciones.ventana ?? 10;
  const maxConsultas = opciones.maxConsultas ?? 200;
  let lo = Math.max(0, Math.floor(opciones.desde ?? 0));
  let consultas = 0;

  const preguntar = async (n: number): Promise<boolean> => {
    if (++consultas > maxConsultas) {
      throw new Error(`Detección de secuencia abortada: más de ${maxConsultas} consultas`);
    }
    return usado(n);
  };

  for (;;) {
    // 1. Galope: invariante → `lo` usado (o 0), `hi` libre.
    let paso = 1;
    let hi = lo + paso;
    while (hi <= MAX_SECUENCIA && (await preguntar(hi))) {
      lo = hi;
      paso *= 2;
      hi = Math.min(lo + paso, MAX_SECUENCIA + 1);
    }

    // 2. Binaria en (lo, hi).
    while (hi - lo > 1) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if (await preguntar(mid)) lo = mid;
      else hi = mid;
    }

    // 3. Ventana: lo+1 ya se sabe libre; se revisan lo+2 … lo+ventana.
    let siguiente: number | undefined;
    for (let n = lo + 2; n <= Math.min(lo + ventana, MAX_SECUENCIA); n++) {
      if (await preguntar(n)) {
        siguiente = n;
        break;
      }
    }
    if (siguiente === undefined) return { ultimaUsada: lo, consultas };
    lo = siguiente;
  }
}
