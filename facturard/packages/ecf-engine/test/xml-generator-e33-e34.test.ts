import {
  generarECF33,
  generarECF34,
  INDICADOR_FACTURACION,
  type ECF33Input,
  type ECF34Input,
  type Emisor,
  type Comprador,
  type InformacionReferencia,
} from '../src/xml';

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────────

const EMISOR: Emisor = {
  rnc: '101000000',
  razonSocial: 'TIENDA DEMO SRL',
  nombreComercial: 'DemoTienda',
  direccion: 'Av. Winston Churchill 1099, Santo Domingo',
  municipio: '010101',
  provincia: '010000',
  telefono: '809-555-0100',
  correo: 'ventas@demotienda.com',
  actividadEconomica: 'Comercio al por menor',
  fechaEmision: '02-04-2025',
};

const COMPRADOR: Comprador = {
  rnc: '132883225',
  razonSocial: 'CLIENTE CORPORATIVO SRL',
};

/** Referencia al E31 original que se modifica */
const REF_E31: InformacionReferencia = {
  ncfModificado: 'E310000000001',
  fechaNCFModificado: '01-04-2025',
  codigoModificacion: 3,
  rncOtroContribuyente: '131880681',
};

/** Referencia al E32 original que se modifica */
const REF_E32: InformacionReferencia = {
  ncfModificado: 'E320000000006',
  fechaNCFModificado: '01-04-2025',
  codigoModificacion: 3,
};

function baseE33(overrides: Partial<ECF33Input> = {}): ECF33Input {
  return {
    idDoc: {
      eNCF: 'E330000000001',
      fechaVencimientoSecuencia: '31-12-2028',
      tipoIngresos: '01',
      tipoPago: 1,
      fechaHoraFirma: '02-04-2025 10:00:00',
    },
    emisor: EMISOR,
    comprador: COMPRADOR,
    referencia: REF_E31,
    items: [
      {
        nombre: 'Diferencia de precio',
        cantidad: 1,
        precioUnitario: 10_000,
        indicadorFacturacion: INDICADOR_FACTURACION.GRAVADO_I1,
        indicadorBienoServicio: 1,
      },
    ],
    ...overrides,
  };
}

function baseE34(overrides: Partial<ECF34Input> = {}): ECF34Input {
  return {
    idDoc: {
      eNCF: 'E340000000001',
      indicadorNotaCredito: 0, // 0 = e-CF afectado con <=30 días calendario
      tipoIngresos: '01',
      tipoPago: 1,
      fechaHoraFirma: '02-04-2025 10:00:00',
    },
    emisor: EMISOR,
    comprador: COMPRADOR,
    referencia: REF_E31,
    items: [
      {
        nombre: 'Devolución parcial',
        cantidad: 1,
        precioUnitario: 5_000,
        indicadorFacturacion: INDICADOR_FACTURACION.GRAVADO_I1,
        indicadorBienoServicio: 1,
      },
    ],
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// E33 — Nota de Débito: incrementa el monto de la factura original
// ──────────────────────────────────────────────────────────────────────────────

describe('e-CF 33 — Nota de Débito: incrementa monto original', () => {
  const result = generarECF33(baseE33());

  it('pasa la validación XSD del e-CF 33', () => {
    expect(result.validation.valid).toBe(true);
    expect(result.validation.errors).toHaveLength(0);
  });

  it('el XML usa TipoeCF 33', () => {
    expect(result.xml).toContain('<TipoeCF>33</TipoeCF>');
  });

  it('incluye FechaVencimientoSecuencia (obligatoria en E33 según PDF DGII)', () => {
    expect(result.xml).toContain('<FechaVencimientoSecuencia>31-12-2028</FechaVencimientoSecuencia>');
  });

  it('incluye InformacionReferencia obligatoria', () => {
    expect(result.xml).toContain('<InformacionReferencia>');
    expect(result.xml).toContain('</InformacionReferencia>');
  });

  it('referencia correctamente el e-NCF original', () => {
    expect(result.xml).toContain('<NCFModificado>E310000000001</NCFModificado>');
    expect(result.xml).toContain('<FechaNCFModificado>01-04-2025</FechaNCFModificado>');
  });

  it('incluye CodigoModificacion correcto', () => {
    expect(result.xml).toContain('<CodigoModificacion>3</CodigoModificacion>');
  });

  it('incluye RNCOtroContribuyente cuando se proporciona', () => {
    expect(result.xml).toContain('<RNCOtroContribuyente>131880681</RNCOtroContribuyente>');
  });

  it('calcula ITBIS 18 % correctamente sobre el monto adicional', () => {
    // 10,000 base  |  1,800 ITBIS  |  11,800 total
    expect(result.totales.montoGravadoI1).toBe(10_000);
    expect(result.totales.totalITBIS1).toBe(1_800);
    expect(result.totales.montoTotal).toBe(11_800);
  });

  it('incluye FechaHoraFirma requerida por el XSD', () => {
    expect(result.xml).toContain('<FechaHoraFirma>02-04-2025 10:00:00</FechaHoraFirma>');
  });

  it('el XML no tiene namespace (XSD sin targetNamespace)', () => {
    expect(result.xml).toContain('<ECF>');
    expect(result.xml).not.toContain('xmlns=');
  });

  it('asigna NumeroLinea secuencial a los ítems', () => {
    expect(result.items[0].numeroLinea).toBe(1);
  });

  it('incluye Version 1.0', () => {
    expect(result.xml).toContain('<Version>1.0</Version>');
  });
});

describe('e-CF 33 — múltiples ítems con distintas tasas', () => {
  const result = generarECF33(
    baseE33({
      items: [
        {
          nombre: 'Producto gravado I1',
          cantidad: 2,
          precioUnitario: 5_000,
          indicadorFacturacion: INDICADOR_FACTURACION.GRAVADO_I1,
          indicadorBienoServicio: 1,
        },
        {
          nombre: 'Producto exento',
          cantidad: 1,
          precioUnitario: 3_000,
          indicadorFacturacion: INDICADOR_FACTURACION.EXENTO,
          indicadorBienoServicio: 1,
        },
      ],
    }),
  );

  it('pasa la validación XSD', () => {
    expect(result.validation.valid).toBe(true);
  });

  it('emite dos ítems con NumeroLinea 1 y 2', () => {
    expect(result.items[0].numeroLinea).toBe(1);
    expect(result.items[1].numeroLinea).toBe(2);
  });

  it('calcula totales mixtos correctamente', () => {
    // I1: 10,000 base  |  1,800 ITBIS  | Exento: 3,000  | Total: 14,800
    expect(result.totales.montoGravadoI1).toBe(10_000);
    expect(result.totales.totalITBIS1).toBe(1_800);
    expect(result.totales.montoExento).toBe(3_000);
    expect(result.totales.montoTotal).toBe(14_800);
  });

  it('emite MontoExento en el XML cuando hay ítems exentos', () => {
    expect(result.xml).toContain('<MontoExento>3000.00</MontoExento>');
  });
});

describe('e-CF 33 — referencia sin RNCOtroContribuyente', () => {
  const result = generarECF33(
    baseE33({
      referencia: REF_E32,
    }),
  );

  it('pasa la validación XSD sin RNCOtroContribuyente', () => {
    expect(result.validation.valid).toBe(true);
  });

  it('no emite RNCOtroContribuyente en el XML', () => {
    expect(result.xml).not.toContain('<RNCOtroContribuyente>');
  });

  it('referencia el e-NCF del E32', () => {
    expect(result.xml).toContain('<NCFModificado>E320000000006</NCFModificado>');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// E34 — Nota de Crédito: reduce o anula la factura original
// ──────────────────────────────────────────────────────────────────────────────

describe('e-CF 34 — Nota de Crédito: reduce monto original', () => {
  const result = generarECF34(baseE34());

  it('pasa la validación XSD del e-CF 34', () => {
    expect(result.validation.valid).toBe(true);
    expect(result.validation.errors).toHaveLength(0);
  });

  it('el XML usa TipoeCF 34', () => {
    expect(result.xml).toContain('<TipoeCF>34</TipoeCF>');
  });

  it('no incluye FechaVencimientoSecuencia', () => {
    expect(result.xml).not.toContain('<FechaVencimientoSecuencia>');
  });

  it('incluye IndicadorNotaCredito 0 (e-CF afectado <=30 días)', () => {
    expect(result.xml).toContain('<IndicadorNotaCredito>0</IndicadorNotaCredito>');
  });

  it('incluye InformacionReferencia obligatoria', () => {
    expect(result.xml).toContain('<InformacionReferencia>');
  });

  it('referencia correctamente el e-NCF original', () => {
    expect(result.xml).toContain('<NCFModificado>E310000000001</NCFModificado>');
    expect(result.xml).toContain('<FechaNCFModificado>01-04-2025</FechaNCFModificado>');
    expect(result.xml).toContain('<CodigoModificacion>3</CodigoModificacion>');
  });

  it('calcula ITBIS sobre el monto de la nota de crédito', () => {
    // 5,000 base  |  900 ITBIS  |  5,900 total
    expect(result.totales.montoGravadoI1).toBe(5_000);
    expect(result.totales.totalITBIS1).toBe(900);
    expect(result.totales.montoTotal).toBe(5_900);
  });

  it('incluye FechaHoraFirma requerida', () => {
    expect(result.xml).toContain('<FechaHoraFirma>02-04-2025 10:00:00</FechaHoraFirma>');
  });

  it('el XML no tiene namespace', () => {
    expect(result.xml).not.toContain('xmlns=');
  });
});

describe('e-CF 34 — e-CF afectado >30 días (IndicadorNotaCredito = 1)', () => {
  const result = generarECF34(
    baseE34({
      idDoc: {
        eNCF: 'E340000000002',
        indicadorNotaCredito: 1, // 1 = >30 días calendario (no rebaja ITBIS)
        tipoIngresos: '01',
        tipoPago: 1,
        fechaHoraFirma: '02-04-2025 11:00:00',
      },
      referencia: {
        ncfModificado: 'E310000000001',
        fechaNCFModificado: '01-04-2025',
        codigoModificacion: 1,
      },
      items: [
        {
          nombre: 'Nota de crédito fuera de 30 días',
          cantidad: 1,
          precioUnitario: 7_080,
          indicadorFacturacion: INDICADOR_FACTURACION.GRAVADO_I1,
          indicadorBienoServicio: 1,
        },
      ],
    }),
  );

  it('pasa la validación XSD', () => {
    expect(result.validation.valid).toBe(true);
  });

  it('incluye IndicadorNotaCredito 1 (>30 días)', () => {
    expect(result.xml).toContain('<IndicadorNotaCredito>1</IndicadorNotaCredito>');
  });

  it('incluye CodigoModificacion 1', () => {
    expect(result.xml).toContain('<CodigoModificacion>1</CodigoModificacion>');
  });
});

describe('e-CF 34 — IndicadorNotaCredito es OBLIGATORIO (XSD oficial v.1.0)', () => {
  it('acepta el valor 0 (<=30 días)', () => {
    const r = generarECF34(baseE34({ idDoc: { eNCF: 'E340000000003', indicadorNotaCredito: 0, tipoIngresos: '01', tipoPago: 1, fechaHoraFirma: '02-04-2025 12:00:00' } }));
    expect(r.validation.valid).toBe(true);
    expect(r.xml).toContain('<IndicadorNotaCredito>0</IndicadorNotaCredito>');
  });

  it('acepta el valor 1 (>30 días)', () => {
    const r = generarECF34(baseE34({ idDoc: { eNCF: 'E340000000004', indicadorNotaCredito: 1, tipoIngresos: '01', tipoPago: 1, fechaHoraFirma: '02-04-2025 12:00:00' } }));
    expect(r.validation.valid).toBe(true);
    expect(r.xml).toContain('<IndicadorNotaCredito>1</IndicadorNotaCredito>');
  });

  it('rechaza el valor 2 (fuera del rango 0..1 del XSD oficial)', () => {
    expect(() =>
      // @ts-expect-error — 2 ya no es válido en el tipo (0|1); se prueba el rechazo del XSD
      generarECF34(baseE34({ idDoc: { eNCF: 'E340000000005', indicadorNotaCredito: 2, tipoIngresos: '01', tipoPago: 1, fechaHoraFirma: '02-04-2025 12:00:00' } })),
    ).toThrow(/XSD/i);
  });

  it('rechaza si se omite el campo (ahora minOccurs=1)', () => {
    expect(() =>
      generarECF34(baseE34({ idDoc: { eNCF: 'E340000000006', tipoIngresos: '01', tipoPago: 1, fechaHoraFirma: '02-04-2025 12:00:00' } })),
    ).toThrow(/XSD/i);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Validación XSD — rechaza XML inválido
// ──────────────────────────────────────────────────────────────────────────────

describe('Validación XSD — rechaza e-CF 33 inválido', () => {
  it('rechaza si eNCF no tiene 13 caracteres', () => {
    expect(() =>
      generarECF33(
        baseE33({
          idDoc: { eNCF: 'E33001', fechaVencimientoSecuencia: '31-12-2028', tipoIngresos: '01', tipoPago: 1, fechaHoraFirma: '02-04-2025 10:00:00' },
        }),
      ),
    ).toThrow(/XSD/i);
  });
});

describe('Validación XSD — rechaza e-CF 34 inválido', () => {
  it('rechaza si eNCF no tiene 13 caracteres', () => {
    expect(() =>
      generarECF34(
        baseE34({
          idDoc: { eNCF: 'E34001', tipoIngresos: '01', tipoPago: 1, fechaHoraFirma: '02-04-2025 10:00:00' },
        }),
      ),
    ).toThrow(/XSD/i);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Casos del set de certificación DGII (datos reales de set-pruebas.xlsx)
// ──────────────────────────────────────────────────────────────────────────────

describe('set-pruebas DGII — E33 referencia a E32 (E330000000001)', () => {
  const result = generarECF33({
    idDoc: {
      eNCF: 'E330000000001',
      fechaVencimientoSecuencia: '31-12-2028',
      tipoIngresos: '01',
      tipoPago: 1,
      fechaHoraFirma: '02-04-2025 00:00:00',
    },
    emisor: {
      rnc: '132883225',
      razonSocial: 'DOCUMENTOS ELECTRONICOS DE 02',
      nombreComercial: 'DOCUMENTOS ELECTRONICOS DE 02',
      direccion: 'AVE. ISABEL AGUIAR NO. 269, ZONA INDUSTRIAL DE HERRERA',
      municipio: '010101',
      provincia: '010000',
      telefono: '809-472-7676',
      fechaEmision: '02-04-2020',
    },
    comprador: {
      rnc: '131880681',
      razonSocial: 'DOCUMENTOS ELECTRONICOS DE 03',
    },
    items: [
      {
        nombre: 'LECHE',
        cantidad: 10_000,
        precioUnitario: 40,
        indicadorFacturacion: INDICADOR_FACTURACION.EXENTO,
        indicadorBienoServicio: 1,
      },
    ],
    referencia: {
      ncfModificado: 'E320000000006',
      fechaNCFModificado: '01-04-2020',
      codigoModificacion: 3,
      rncOtroContribuyente: '131880681',
    },
  });

  it('pasa la validación XSD', () => {
    expect(result.validation.valid).toBe(true);
  });

  it('el total es 400,000 (10,000 × 40, exento)', () => {
    expect(result.totales.montoExento).toBe(400_000);
    expect(result.totales.montoTotal).toBe(400_000);
  });

  it('no emite ITBIS al ser exento', () => {
    expect(result.xml).not.toContain('<TotalITBIS>');
    expect(result.xml).not.toContain('<ITBIS1>');
  });
});

describe('set-pruebas DGII — E34 anulación de E31 (E340000000001)', () => {
  const result = generarECF34({
    idDoc: {
      eNCF: 'E340000000001',
      indicadorNotaCredito: 1,
      tipoIngresos: '01',
      tipoPago: 1,
      fechaHoraFirma: '02-04-2020 00:00:00',
    },
    emisor: {
      rnc: '132883225',
      razonSocial: 'DOCUMENTOS ELECTRONICOS DE 02',
      nombreComercial: 'DOCUMENTOS ELECTRONICOS DE 02',
      direccion: 'AVE. ISABEL AGUIAR NO. 269, ZONA INDUSTRIAL DE HERRERA',
      municipio: '010101',
      provincia: '010000',
      telefono: '809-472-7676',
      fechaEmision: '02-04-2020',
    },
    comprador: {
      rnc: '131880681',
      razonSocial: 'DOCUMENTOS ELECTRONICOS DE 03',
    },
    items: [
      {
        nombre: 'TOP BOWL 1',
        cantidad: 15,
        precioUnitario: 0,
        indicadorFacturacion: INDICADOR_FACTURACION.GRAVADO_I1,
        indicadorBienoServicio: 1,
      },
    ],
    referencia: {
      ncfModificado: 'E310000000001',
      fechaNCFModificado: '01-04-2020',
      codigoModificacion: 2,
      rncOtroContribuyente: '131880681',
    },
  });

  it('pasa la validación XSD (monto total cero es válido para notas de crédito)', () => {
    expect(result.validation.valid).toBe(true);
  });

  it('el total es 0 (anulación)', () => {
    expect(result.totales.montoTotal).toBe(0);
  });

  it('incluye IndicadorNotaCredito 1', () => {
    expect(result.xml).toContain('<IndicadorNotaCredito>1</IndicadorNotaCredito>');
  });

  it('referencia el E31 original', () => {
    expect(result.xml).toContain('<NCFModificado>E310000000001</NCFModificado>');
    expect(result.xml).toContain('<CodigoModificacion>2</CodigoModificacion>');
  });
});
