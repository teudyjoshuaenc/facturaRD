import { detectarUltimaSecuencia, consultarTrackIds, MAX_SECUENCIA } from '../src/dgii';

/** Oráculo: el conjunto de números que "la DGII" ya recibió. */
function oraculo(usados: Iterable<number>) {
  const set = new Set(usados);
  const preguntas: number[] = [];
  const usado = async (n: number) => {
    preguntas.push(n);
    return set.has(n);
  };
  return { usado, preguntas };
}

const rango = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe('detectarUltimaSecuencia', () => {
  it('ningún número usado → 0', async () => {
    const { usado } = oraculo([]);
    expect((await detectarUltimaSecuencia(usado)).ultimaUsada).toBe(0);
  });

  it.each([1, 2, 3, 13, 64, 65, 1000, 123_457])('secuencia contigua 1..%i', async (n) => {
    const { usado } = oraculo(rango(1, n));
    const r = await detectarUltimaSecuencia(usado);
    expect(r.ultimaUsada).toBe(n);
    // logarítmico: muy por debajo de N para N grandes
    expect(r.consultas).toBeLessThanOrEqual(2 * Math.ceil(Math.log2(n + 1)) + 12);
  });

  it('salta un hueco dentro de la ventana (e-NCF quemado localmente)', async () => {
    // 1..12 enviados, 13 quemado (nunca llegó), 14..20 enviados
    const { usado } = oraculo([...rango(1, 12), ...rango(14, 20)]);
    expect((await detectarUltimaSecuencia(usado)).ultimaUsada).toBe(20);
  });

  it('salta varios huecos seguidos', async () => {
    const { usado } = oraculo([...rango(1, 5), ...rango(9, 15), ...rango(18, 40)]);
    expect((await detectarUltimaSecuencia(usado)).ultimaUsada).toBe(40);
  });

  it('el primer número quemado no impide encontrar los siguientes', async () => {
    const { usado } = oraculo(rango(2, 30));
    expect((await detectarUltimaSecuencia(usado)).ultimaUsada).toBe(30);
  });

  it('un hueco MAYOR que la ventana se queda corto (límite documentado)', async () => {
    const { usado } = oraculo([...rango(1, 5), ...rango(30, 40)]);
    expect((await detectarUltimaSecuencia(usado, { ventana: 10 })).ultimaUsada).toBe(5);
  });

  it('parte de `desde` sin volver a preguntar lo ya conocido', async () => {
    const { usado, preguntas } = oraculo(rango(1, 500));
    const r = await detectarUltimaSecuencia(usado, { desde: 480 });
    expect(r.ultimaUsada).toBe(500);
    expect(Math.min(...preguntas)).toBeGreaterThan(480);
  });

  it('si la DGII no tiene nada nuevo, devuelve `desde` (nunca retrocede)', async () => {
    const { usado } = oraculo(rango(1, 10));
    expect((await detectarUltimaSecuencia(usado, { desde: 50 })).ultimaUsada).toBe(50);
  });

  it('no pregunta más allá del tope de la columna', async () => {
    const { usado, preguntas } = oraculo([MAX_SECUENCIA - 1, MAX_SECUENCIA]);
    const r = await detectarUltimaSecuencia(usado, { desde: MAX_SECUENCIA - 2 });
    expect(r.ultimaUsada).toBe(MAX_SECUENCIA);
    expect(Math.max(...preguntas)).toBeLessThanOrEqual(MAX_SECUENCIA);
  });

  it('aborta si excede maxConsultas', async () => {
    const { usado } = oraculo(rango(1, 1000));
    await expect(detectarUltimaSecuencia(usado, { maxConsultas: 5 })).rejects.toThrow(/abortada/);
  });

  it('propaga el error del oráculo (un fallo NO se interpreta como "libre")', async () => {
    const usado = async (n: number) => {
      if (n === 3) throw new Error('DGII 500'); // el galope pregunta 1, 3, 7…
      return n <= 10;
    };
    await expect(detectarUltimaSecuencia(usado)).rejects.toThrow('DGII 500');
  });
});

describe('consultarTrackIds', () => {
  let fetchSpy: jest.SpyInstance;
  const responder = (status: number, body: unknown) =>
    fetchSpy.mockResolvedValueOnce(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
    );

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });
  afterEach(() => fetchSpy.mockRestore());

  it('arma la URL del ambiente con RNC y e-NCF y manda el token', async () => {
    responder(200, [{ trackId: null, estado: 'No encontrado', fechaRecepcion: null }]);
    await consultarTrackIds('132883225', 'E310000000001', 'tok', { env: 'ecf' });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(
      'https://ecf.dgii.gov.do/ECF/ConsultaTrackIds/api/TrackIds/Consulta?RncEmisor=132883225&Encf=E310000000001',
    );
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' });
  });

  it('"No encontrado" → no recibido', async () => {
    responder(200, [{ trackId: null, estado: 'No encontrado', fechaRecepcion: null }]);
    expect((await consultarTrackIds('1', 'E310000000001', 't', {})).recibido).toBe(false);
  });

  it.each(['Aceptado', 'Rechazado', 'Aceptado Condicional', 'En proceso'])(
    'estado "%s" → recibido (también los rechazados)',
    async (estado) => {
      responder(200, [{ trackId: 'abc', estado, fechaRecepcion: '2026-01-01' }]);
      expect((await consultarTrackIds('1', 'E310000000001', 't', {})).recibido).toBe(true);
    },
  );

  it('acepta un objeto suelto además de una lista', async () => {
    responder(200, { trackId: 'abc', estado: 'Aceptado', fechaRecepcion: null });
    expect((await consultarTrackIds('1', 'E310000000001', 't', {})).recibido).toBe(true);
  });

  it('lista vacía → no recibido', async () => {
    responder(200, []);
    expect((await consultarTrackIds('1', 'E310000000001', 't', {})).recibido).toBe(false);
  });

  it.each([
    [401, '{"error":"no autorizado"}'],
    [404, 'Not Found'],
    [500, 'boom'],
    [200, '<html>no json</html>'],
  ])('HTTP %i / cuerpo inválido → lanza (nunca "libre")', async (status, body) => {
    responder(status, body);
    await expect(consultarTrackIds('1', 'E310000000001', 't', {})).rejects.toThrow();
  });
});
