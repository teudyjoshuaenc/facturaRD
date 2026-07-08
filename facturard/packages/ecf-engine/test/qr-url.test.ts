import { buildQrUrl, type EcfPdfInput } from '../src/pdf';

// Caso real de producción: E310000000011 (DMAIA), que la DGII SÍ encuentra en el
// consultatimbre sólo con el set completo de parámetros y el e-NCF en MAYÚSCULAS.
const BASE: EcfPdfInput = {
  rncEmisor: '132883225',
  nombreEmisor: 'DMAIA SRL',
  eNCF: 'E310000000011',
  tipoECF: 'E31',
  fechaEmision: '07-07-2026',
  rncComprador: '133339005',
  nombreComprador: 'ANGELES GROUP SRL',
  fechaHoraFirma: '07-07-2026 21:51:55',
  codigoSeguridad: 'iQTdxh',
  ambiente: 'ecf',
  items: [{ descripcion: 'X', cantidad: 1, precioUnitario: 22000, valor: 22000 }],
  montoTotal: 25960,
};

describe('buildQrUrl — URL del consultatimbre DGII', () => {
  it('lleva el e-NCF en MAYÚSCULAS (no minúsculas)', () => {
    const url = buildQrUrl(BASE);
    expect(url).toContain('encf=E310000000011');
    expect(url).not.toContain('encf=e310000000011');
  });

  it('incluye el set completo que exige la DGII', () => {
    const url = buildQrUrl(BASE);
    expect(url).toContain('rncemisor=132883225');
    expect(url).toContain('rnccomprador=133339005');
    expect(url).toContain('fechaemision=07-07-2026');
    expect(url).toContain('montototal=25960.00');
    // espacio → %20, ':' → %3A
    expect(url).toContain('fechafirma=07-07-2026%2021%3A51%3A55');
    expect(url).toContain('codigoseguridad=iQTdxh');
  });

  it('apunta al consultatimbre de producción cuando ambiente=ecf', () => {
    expect(buildQrUrl(BASE)).toContain('https://ecf.dgii.gov.do/ecf/consultatimbre?');
  });

  it('omite fechafirma/codigoseguridad sólo si no están disponibles', () => {
    const sinFirma: EcfPdfInput = { ...BASE };
    delete sinFirma.fechaHoraFirma;
    delete sinFirma.codigoSeguridad;
    const url = buildQrUrl(sinFirma);
    expect(url).not.toContain('fechafirma=');
    expect(url).not.toContain('codigoseguridad=');
  });
});
