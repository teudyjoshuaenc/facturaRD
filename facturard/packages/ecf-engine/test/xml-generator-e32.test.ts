import {
  generarECF32,
  generarRFCE32,
  MONTO_LIMITE_RFCE,
  INDICADOR_FACTURACION,
  type ECF32Input,
  type Emisor,
} from '../src/xml';

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────────

const EMISOR: Emisor = {
  rnc: '101000000',
  razonSocial: 'TIENDA DEMO SRL',
  nombreComercial: 'DemoTienda',
  direccion: 'Av. Winston Churchill 1099, Santo Domingo',
  telefono: '809-555-0100',
  correo: 'ventas@demotienda.com',
  actividadEconomica: 'Comercio al por menor',
  fechaEmision: '01-04-2025',
};

function baseInput(overrides: Partial<ECF32Input> = {}): ECF32Input {
  return {
    idDoc: {
      eNCF: 'E320000000001',
      tipoIngresos: '01',
      tipoPago: 1,
      fechaHoraFirma: '01-04-2025 10:00:00',
    },
    emisor: EMISOR,
    items: [],
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Caso 1: Flujo A — monto ≥ RD$250,000 (envío directo)
// ──────────────────────────────────────────────────────────────────────────────

describe('e-CF 32 Flujo A — monto ≥ RD$250,000', () => {
  // 10 unidades × 30,000 = 300,000 > umbral
  const result = generarECF32(
    baseInput({
      items: [
        {
          nombre: 'Televisor 65"',
          cantidad: 10,
          precioUnitario: 30_000,
          indicadorFacturacion: INDICADOR_FACTURACION.GRAVADO_I1,
          indicadorBienoServicio: 1,
        },
      ],
    }),
  );

  it('retorna flujo A', () => {
    expect(result.flujo).toBe('A');
  });

  it('el monto total supera el umbral de 250,000', () => {
    expect(result.totales.montoTotal).toBeGreaterThanOrEqual(MONTO_LIMITE_RFCE);
  });

  it('pasa la validación XSD del e-CF 32', () => {
    expect(result.validation.valid).toBe(true);
    expect(result.validation.errors).toHaveLength(0);
  });

  it('calcula ITBIS 18 % correctamente', () => {
    // Base gravada: 300,000  |  ITBIS: 54,000  |  Total: 354,000
    expect(result.totales.montoGravadoI1).toBe(300_000);
    expect(result.totales.totalITBIS1).toBe(54_000);
    expect(result.totales.montoTotal).toBe(354_000);
  });

  it('el XML usa TipoeCF 32', () => {
    expect(result.xml).toContain('<TipoeCF>32</TipoeCF>');
  });

  it('el XML no tiene namespace (XSD oficial sin targetNamespace)', () => {
    expect(result.xml).toContain('<ECF>');
    expect(result.xml).not.toContain('xmlns=');
  });

  it('NO incluye InformacionReferencia (sin RFCE en flujo A)', () => {
    expect(result.xml).not.toContain('<InformacionReferencia>');
  });

  it('incluye FechaHoraFirma requerida por el XSD', () => {
    expect(result.xml).toContain('<FechaHoraFirma>01-04-2025 10:00:00</FechaHoraFirma>');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Caso 2: Flujo B — monto < RD$250,000 (RFCE obligatorio)
// ──────────────────────────────────────────────────────────────────────────────

describe('e-CF 32 Flujo B — monto < RD$250,000', () => {
  // Items que suman 5,000 (< 250,000)
  const itemsBaratos = [
    {
      nombre: 'Camiseta',
      cantidad: 5,
      precioUnitario: 500,
      indicadorFacturacion: INDICADOR_FACTURACION.GRAVADO_I1 as 1,
      indicadorBienoServicio: 1 as const,
    },
    {
      nombre: 'Pantalón',
      cantidad: 2,
      precioUnitario: 1250,
      indicadorFacturacion: INDICADOR_FACTURACION.GRAVADO_I1 as 1,
      indicadorBienoServicio: 1 as const,
    },
  ];
  // Bruto: 5*500 + 2*1250 = 5000  |  ITBIS: 900  |  Total: 5900

  describe('RFCE-32 (resumen previo)', () => {
    const rfceResult = generarRFCE32(baseInput({ items: itemsBaratos }));

    it('pasa la validación XSD del RFCE-32', () => {
      expect(rfceResult.validation.valid).toBe(true);
      expect(rfceResult.validation.errors).toHaveLength(0);
    });

    it('el RFCE usa la raíz <RFCE> (no <ECF>)', () => {
      expect(rfceResult.xml).toContain('<RFCE>');
      expect(rfceResult.xml).not.toContain('<ECF>');
    });

    it('el RFCE contiene TipoeCF 32', () => {
      expect(rfceResult.xml).toContain('<TipoeCF>32</TipoeCF>');
    });

    it('el RFCE tiene Encabezado con Version, IdDoc, Emisor, Comprador y Totales', () => {
      expect(rfceResult.xml).toContain('<Encabezado>');
      expect(rfceResult.xml).toContain('<Version>1.0</Version>');
      expect(rfceResult.xml).toContain('<IdDoc>');
      expect(rfceResult.xml).toContain('<Emisor>');
      expect(rfceResult.xml).toContain('<Comprador>');
      expect(rfceResult.xml).toContain('<Totales>');
    });

    it('el RFCE NO tiene DetallesItems', () => {
      expect(rfceResult.xml).not.toContain('<DetallesItems>');
    });

    it('el RFCE NO tiene FechaHoraFirma (no existe en el XSD oficial RFCE-32)', () => {
      expect(rfceResult.xml).not.toContain('<FechaHoraFirma>');
    });

    it('el RFCE incluye CodigoSeguridadeCF requerido por el XSD', () => {
      expect(rfceResult.xml).toContain('<CodigoSeguridadeCF>');
    });

    it('el RFCE NO tiene DireccionEmisor (no existe en el XSD oficial RFCE-32)', () => {
      expect(rfceResult.xml).not.toContain('<DireccionEmisor>');
    });

    it('el RFCE calcula los mismos totales que el e-CF completo', () => {
      expect(rfceResult.totales.montoGravadoI1).toBe(5000);
      expect(rfceResult.totales.totalITBIS1).toBe(900);
      expect(rfceResult.totales.montoTotal).toBe(5900);
    });

    it('el RFCE emite TotalITBIS1 en el XML cuando hay ITBIS I1', () => {
      expect(rfceResult.xml).toContain('<TotalITBIS1>900.00</TotalITBIS1>');
    });
  });

  describe('e-CF 32 completo (con referencia al RFCE aceptado)', () => {
    const rfceAceptado = {
      eNCF: 'E320000000001',
      fecha: '01-04-2025',
      rnc: '101000000',
    };

    const result = generarECF32(
      baseInput({
        items: itemsBaratos,
        rfce: rfceAceptado,
      }),
    );

    it('retorna flujo B', () => {
      expect(result.flujo).toBe('B');
    });

    it('pasa la validación XSD del e-CF 32', () => {
      expect(result.validation.valid).toBe(true);
      expect(result.validation.errors).toHaveLength(0);
    });

    it('incluye InformacionReferencia con CodigoModificacion 5', () => {
      expect(result.xml).toContain('<InformacionReferencia>');
      expect(result.xml).toContain('<CodigoModificacion>5</CodigoModificacion>');
    });

    it('referencia el eNCF del RFCE aceptado', () => {
      expect(result.xml).toContain('<NCFModificado>E320000000001</NCFModificado>');
      expect(result.xml).toContain('<FechaNCFModificado>01-04-2025</FechaNCFModificado>');
    });

    it('el XML completo SÍ tiene DetallesItems', () => {
      expect(result.xml).toContain('<DetallesItems>');
    });

    it('asigna NumeroLinea secuencial a los ítems', () => {
      expect(result.items[0].numeroLinea).toBe(1);
      expect(result.items[1].numeroLinea).toBe(2);
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Caso 3: Comprador anónimo (sin RNC — B2C puro)
// ──────────────────────────────────────────────────────────────────────────────

describe('e-CF 32 con comprador anónimo', () => {
  const result = generarECF32(
    baseInput({
      items: [
        {
          nombre: 'Servicio spa',
          cantidad: 1,
          precioUnitario: 300_000,
          indicadorFacturacion: INDICADOR_FACTURACION.GRAVADO_I1,
          indicadorBienoServicio: 2,
        },
      ],
      comprador: undefined,
    }),
  );

  it('pasa la validación XSD sin sección Comprador con datos', () => {
    expect(result.validation.valid).toBe(true);
  });

  it('el XML tiene sección Comprador vacía (XSD lo permite en e-CF 32)', () => {
    expect(result.xml).toContain('<Comprador>');
  });

  it('no incluye RNCComprador cuando no hay comprador', () => {
    expect(result.xml).not.toContain('<RNCComprador>');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Caso 4: Flujo B rechaza el e-CF completo sin RFCE previo
// ──────────────────────────────────────────────────────────────────────────────

describe('Flujo B — rechaza e-CF completo sin RFCE', () => {
  it('lanza un error cuando montoTotal < 250,000 y no hay rfce', () => {
    expect(() =>
      generarECF32(
        baseInput({
          items: [
            {
              nombre: 'Producto barato',
              cantidad: 1,
              precioUnitario: 100,
              indicadorFacturacion: INDICADOR_FACTURACION.GRAVADO_I1 as 1,
              indicadorBienoServicio: 1 as const,
            },
          ],
        }),
      ),
    ).toThrow(/Flujo B/);
  });

  it('el mensaje de error menciona el umbral de RD$250,000', () => {
    expect(() =>
      generarECF32(
        baseInput({
          items: [
            {
              nombre: 'Artículo',
              cantidad: 1,
              precioUnitario: 1000,
              indicadorFacturacion: INDICADOR_FACTURACION.GRAVADO_I1 as 1,
              indicadorBienoServicio: 1 as const,
            },
          ],
        }),
      ),
    ).toThrow(/250/);
  });

  it('lanza cuando montoTotal es exactamente 249,999.99', () => {
    // 249,999.99 base + 18% ITBIS → total exacto = 294,999.99 ... pero la
    // comparación se hace sobre montoTotal. Usamos 1 item de 211,864.41
    // para que base+ITBIS = ~249,999.99 < 250,000
    // Más simple: usamos montoExento de 249,000 (sin ITBIS) para control exacto
    expect(() =>
      generarECF32(
        baseInput({
          items: [
            {
              nombre: 'Producto exento',
              cantidad: 1,
              precioUnitario: 249_000,
              indicadorFacturacion: INDICADOR_FACTURACION.EXENTO as 4,
              indicadorBienoServicio: 1 as const,
            },
          ],
        }),
      ),
    ).toThrow(/Flujo B/);
  });

  it('NO lanza cuando montoTotal == 250,000 exacto (umbral incluido en Flujo A)', () => {
    expect(() =>
      generarECF32(
        baseInput({
          items: [
            {
              nombre: 'Producto exento',
              cantidad: 1,
              precioUnitario: 250_000,
              indicadorFacturacion: INDICADOR_FACTURACION.EXENTO as 4,
              indicadorBienoServicio: 1 as const,
            },
          ],
        }),
      ),
    ).not.toThrow();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Caso 5: Validación XSD — rechaza XML inválido
// ──────────────────────────────────────────────────────────────────────────────

describe('Validación XSD — rechaza e-CF 32 inválido', () => {
  it('rechaza si eNCF no tiene 13 caracteres', () => {
    expect(() =>
      generarECF32(
        baseInput({
          idDoc: { eNCF: 'E32001', tipoIngresos: '01', tipoPago: 1, fechaHoraFirma: '01-04-2025 10:00:00' },
          items: [
            {
              nombre: 'Producto',
              cantidad: 1,
              precioUnitario: 300_000,
              indicadorFacturacion: INDICADOR_FACTURACION.GRAVADO_I1 as 1,
              indicadorBienoServicio: 1 as const,
            },
          ],
        }),
      ),
    ).toThrow(/XSD/i);
  });

  it('emite <Version>1.0</Version> siempre', () => {
    const r = generarECF32(
      baseInput({
        items: [
          {
            nombre: 'Producto',
            cantidad: 1,
            precioUnitario: 300_000,
            indicadorFacturacion: INDICADOR_FACTURACION.GRAVADO_I1 as 1,
            indicadorBienoServicio: 1 as const,
          },
        ],
      }),
    );
    expect(r.xml).toContain('<Version>1.0</Version>');
    expect(r.validation.valid).toBe(true);
  });
});
