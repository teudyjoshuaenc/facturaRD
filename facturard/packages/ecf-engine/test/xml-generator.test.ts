import {
  generarECF31,
  INDICADOR_FACTURACION,
  type ECF31Input,
  type Emisor,
  type Comprador,
} from '../src/xml';

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures compartidos
// ──────────────────────────────────────────────────────────────────────────────

const EMISOR: Emisor = {
  rnc: '101000000',
  razonSocial: 'EMPRESA DEMO SRL',
  nombreComercial: 'DemoShop',
  direccion: 'Av. Winston Churchill 1099, Santo Domingo',
  // municipio/provincia usan código DGII (ProvinciaMunicipioType) — omitidos en tests
  // para no acoplar los tests a la tabla de municipios de la DGII
  telefono: '809-555-0100',   // formato requerido: 000-000-0000
  correo: 'facturacion@demoshop.com',
  actividadEconomica: 'Comercio al por menor',
  fechaEmision: '01-04-2025',
};

const COMPRADOR: Comprador = {
  rnc: '131000000',
  razonSocial: 'CLIENTE DEMO SRL',
  correo: 'compras@cliente.com',
  direccion: 'Calle El Conde 12, Zona Colonial',
};

function baseInput(overrides: Partial<ECF31Input> = {}): ECF31Input {
  return {
    idDoc: {
      eNCF: 'E310000000001',
      fechaVencimientoSecuencia: '31-12-2025',
      tipoIngresos: '01',
      tipoPago: 1,
      fechaHoraFirma: '01-04-2025 10:00:00',  // fijo para tests reproducibles
    },
    emisor: EMISOR,
    comprador: COMPRADOR,
    items: [],
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Caso 1: Factura simple — 2 líneas gravadas al 18 %
// ──────────────────────────────────────────────────────────────────────────────

describe('Factura simple — 2 líneas gravadas al 18 %', () => {
  const result = generarECF31(
    baseInput({
      items: [
        {
          nombre: 'Monitor 27"',
          cantidad: 2,
          precioUnitario: 15000,
          indicadorFacturacion: INDICADOR_FACTURACION.GRAVADO_I1,
          indicadorBienoServicio: 1,
        },
        {
          nombre: 'Teclado mecánico',
          cantidad: 1,
          precioUnitario: 3500,
          indicadorFacturacion: INDICADOR_FACTURACION.GRAVADO_I1,
          indicadorBienoServicio: 1,
          unidadMedida: 59,  // código DGII para unidad
        },
      ],
    }),
  );

  it('pasa la validación XSD contra el schema oficial de la DGII', () => {
    expect(result.validation.valid).toBe(true);
    expect(result.validation.errors).toHaveLength(0);
  });

  it('calcula ITBIS 18 % correctamente', () => {
    // Base gravada: 2*15000 + 1*3500 = 33 500
    // ITBIS 18%:    33 500 * 0.18  = 6 030
    // Total:        33 500 + 6 030 = 39 530
    expect(result.totales.montoGravadoI1).toBe(33500);
    expect(result.totales.totalITBIS1).toBe(6030);
    expect(result.totales.montoTotal).toBe(39530);
  });

  it('el XML usa TipoeCF (nombre oficial del campo)', () => {
    expect(result.xml).toContain('<TipoeCF>31</TipoeCF>');
    expect(result.xml).not.toContain('<TipoCFE>');  // nombre viejo eliminado
  });

  it('el XML NO tiene namespace (el XSD oficial no tiene targetNamespace)', () => {
    expect(result.xml).toContain('<ECF>');
    expect(result.xml).not.toContain('xmlns=');
  });

  it('el XML contiene los campos obligatorios del e-CF 31', () => {
    const { xml } = result;
    expect(xml).toContain('<RNCEmisor>101000000</RNCEmisor>');
    expect(xml).toContain('<RNCComprador>131000000</RNCComprador>');
    expect(xml).toContain('<MontoGravadoTotal>33500.00</MontoGravadoTotal>');
    expect(xml).toContain('<MontoGravadoI1>33500.00</MontoGravadoI1>');
    expect(xml).toContain('<ITBIS1>18</ITBIS1>');
    expect(xml).toContain('<TotalITBIS1>6030.00</TotalITBIS1>');
    expect(xml).toContain('<MontoTotal>39530.00</MontoTotal>');
  });

  it('incluye FechaHoraFirma requerida por el XSD', () => {
    expect(result.xml).toContain('<FechaHoraFirma>01-04-2025 10:00:00</FechaHoraFirma>');
  });

  it('Emisor usa los nombres de campos del XSD oficial', () => {
    const { xml } = result;
    expect(xml).toContain('<NombreComercial>DemoShop</NombreComercial>');
    expect(xml).toContain('<TablaTelefonoEmisor>');
    expect(xml).toContain('<TelefonoEmisor>809-555-0100</TelefonoEmisor>');
    expect(xml).toContain('<CorreoEmisor>facturacion@demoshop.com</CorreoEmisor>');
    // Nombres viejos eliminados
    expect(xml).not.toContain('NombreComercialEmisor');
    expect(xml).not.toContain('CorreoElectronicoEmisor');
  });

  it('Item usa IndicadorBienoServicio (no IndicadorBienesOServicios)', () => {
    expect(result.xml).toContain('<IndicadorBienoServicio>1</IndicadorBienoServicio>');
    expect(result.xml).not.toContain('IndicadorBienesOServicios');
  });

  it('el orden en Item es PrecioUnitarioItem → DescuentoMonto → MontoItem', () => {
    const xml = result.xml;
    const posP = xml.indexOf('<PrecioUnitarioItem>');
    const posM = xml.indexOf('<MontoItem>');
    expect(posP).toBeLessThan(posM);
  });

  it('DetallesItems es requerido y está presente', () => {
    expect(result.xml).toContain('<DetallesItems>');
    expect(result.xml).toContain('</DetallesItems>');
  });

  it('asigna NumeroLinea secuencial a cada ítem', () => {
    expect(result.items[0].numeroLinea).toBe(1);
    expect(result.items[1].numeroLinea).toBe(2);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Caso 2: Factura con descuento por línea
// ──────────────────────────────────────────────────────────────────────────────

describe('Factura con descuento por línea', () => {
  const result = generarECF31(
    baseInput({
      items: [
        {
          nombre: 'Laptop premium',
          cantidad: 1,
          precioUnitario: 80000,
          indicadorFacturacion: INDICADOR_FACTURACION.GRAVADO_I1,
          indicadorBienoServicio: 1,
          descuentoPorcentaje: 10,
        },
        {
          nombre: 'Garantía extendida',
          cantidad: 1,
          precioUnitario: 5000,
          indicadorFacturacion: INDICADOR_FACTURACION.GRAVADO_I1,
          indicadorBienoServicio: 2,
          descuentoPorcentaje: 20,
        },
      ],
    }),
  );

  it('pasa la validación XSD', () => {
    expect(result.validation.valid).toBe(true);
  });

  it('aplica el descuento antes de calcular el ITBIS', () => {
    // Línea 1: bruto=80000, desc=8000, neto=72000, ITBIS=12960
    // Línea 2: bruto=5000,  desc=1000, neto=4000,  ITBIS=720
    const [l1, l2] = result.items;
    expect(l1.montoDescuento).toBe(8000);
    expect(l1.montoItem).toBe(72000);
    expect(l1.montoITBIS).toBe(12960);
    expect(l2.montoDescuento).toBe(1000);
    expect(l2.montoItem).toBe(4000);
    expect(l2.montoITBIS).toBe(720);
  });

  it('los totales reflejan las bases descontadas', () => {
    // Gravado: 76000, ITBIS: 13680, Total: 89680
    expect(result.totales.montoGravadoTotal).toBe(76000);
    expect(result.totales.montoGravadoI1).toBe(76000);
    expect(result.totales.totalITBIS1).toBe(13680);
    expect(result.totales.montoTotal).toBe(89680);
  });

  it('el XML incluye DescuentoMonto calculado (no DescuentoPorcentaje)', () => {
    const { xml } = result;
    expect(xml).toContain('<DescuentoMonto>8000.00</DescuentoMonto>');
    expect(xml).toContain('<DescuentoMonto>1000.00</DescuentoMonto>');
    // DescuentoPorcentaje no existe en el XSD oficial a nivel de Item
    expect(xml).not.toContain('<DescuentoPorcentaje>');
  });

  it('Totales NO incluye TotalDescuento (no existe en XSD oficial)', () => {
    expect(result.xml).not.toContain('<TotalDescuento>');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Caso 3: Factura con ítems exentos de ITBIS
// ──────────────────────────────────────────────────────────────────────────────

describe('Factura con ítems exentos de ITBIS', () => {
  const result = generarECF31(
    baseInput({
      items: [
        {
          nombre: 'Medicamento A',
          cantidad: 3,
          precioUnitario: 1200,
          indicadorFacturacion: INDICADOR_FACTURACION.EXENTO,
          indicadorBienoServicio: 1,
        },
        {
          nombre: 'Alimento básico B',
          cantidad: 5,
          precioUnitario: 300,
          indicadorFacturacion: INDICADOR_FACTURACION.EXENTO,
          indicadorBienoServicio: 1,
        },
      ],
    }),
  );

  it('pasa la validación XSD', () => {
    expect(result.validation.valid).toBe(true);
  });

  it('no genera ITBIS para ítems exentos', () => {
    for (const item of result.items) expect(item.montoITBIS).toBe(0);
    expect(result.totales.totalITBIS).toBe(0);
    expect(result.totales.totalITBIS1).toBe(0);
  });

  it('acumula correctamente en MontoExento', () => {
    // 3*1200 + 5*300 = 5100
    expect(result.totales.montoExento).toBe(5100);
    expect(result.totales.montoGravadoTotal).toBe(0);
    expect(result.totales.montoTotal).toBe(5100);
  });

  it('el XML usa MontoExento y omite campos de gravados', () => {
    const { xml } = result;
    expect(xml).toContain('<MontoExento>5100.00</MontoExento>');
    expect(xml).not.toContain('<MontoGravadoTotal>');
    expect(xml).not.toContain('<MontoGravadoI1>');
    expect(xml).not.toContain('<ITBIS1>');
    expect(xml).not.toContain('<TotalITBIS>');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Caso 4: Factura mixta — gravados + exentos + crédito
// ──────────────────────────────────────────────────────────────────────────────

describe('Factura mixta — ítems gravados y exentos', () => {
  const result = generarECF31(
    baseInput({
      idDoc: {
        eNCF: 'E310000000042',
        fechaVencimientoSecuencia: '31-12-2025',
        tipoPago: 2,
        fechaLimitePago: '30-04-2025',
        tipoIngresos: '01',
        fechaHoraFirma: '01-04-2025 14:30:00',
      },
      items: [
        {
          nombre: 'Software licencia',
          cantidad: 1,
          precioUnitario: 20000,
          indicadorFacturacion: INDICADOR_FACTURACION.GRAVADO_I1,
          indicadorBienoServicio: 2,
        },
        {
          nombre: 'Libro educativo',
          cantidad: 4,
          precioUnitario: 750,
          indicadorFacturacion: INDICADOR_FACTURACION.EXENTO,
          indicadorBienoServicio: 1,
        },
      ],
    }),
  );

  it('pasa la validación XSD', () => {
    expect(result.validation.valid).toBe(true);
  });

  it('separa correctamente los montos gravados y exentos', () => {
    // Gravado: 20000 → ITBIS = 3600; Exento: 3000; Total: 26600
    expect(result.totales.montoGravadoI1).toBe(20000);
    expect(result.totales.totalITBIS1).toBe(3600);
    expect(result.totales.montoExento).toBe(3000);
    expect(result.totales.montoTotal).toBe(26600);
  });

  it('incluye FechaLimitePago cuando el pago es a crédito', () => {
    expect(result.xml).toContain('<TipoPago>2</TipoPago>');
    expect(result.xml).toContain('<FechaLimitePago>30-04-2025</FechaLimitePago>');
  });

  it('CorreoComprador usa el nombre correcto del XSD', () => {
    expect(result.xml).toContain('<CorreoComprador>compras@cliente.com</CorreoComprador>');
    expect(result.xml).not.toContain('CorreoElectronicoComprador');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Validación XSD — casos que deben ser rechazados por el schema oficial
// ──────────────────────────────────────────────────────────────────────────────

describe('Validación XSD — rechaza XML inválido', () => {
  const itemValido = {
    nombre: 'Producto',
    cantidad: 1,
    precioUnitario: 100,
    indicadorFacturacion: INDICADOR_FACTURACION.GRAVADO_I1 as 1,
    indicadorBienoServicio: 1 as const,
  };

  it('rechaza si eNCF no tiene exactamente 13 caracteres alfanuméricos', () => {
    expect(() =>
      generarECF31(baseInput({
        idDoc: { eNCF: 'B3100001', fechaVencimientoSecuencia: '31-12-2025' },
        items: [itemValido],
      })),
    ).toThrow(/XSD/);
  });

  it('rechaza si el RNC del emisor contiene letras', () => {
    expect(() =>
      generarECF31(baseInput({
        emisor: { ...EMISOR, rnc: 'ABC-12345' },
        items: [itemValido],
      })),
    ).toThrow(/XSD/);
  });

  it('el builder siempre emite <Version>1.0</Version> (único valor permitido por el XSD)', () => {
    // versionType sólo acepta el decimal 1.0; el campo no es parte del input público
    const r = generarECF31(baseInput({ items: [itemValido] }));
    expect(r.xml).toContain('<Version>1.0</Version>');
    expect(r.validation.valid).toBe(true);
  });
});
