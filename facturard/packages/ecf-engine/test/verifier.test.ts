import * as forge from 'node-forge';
import { firmarDocumento, verificarFirmaEcf } from '../src/firma';

// ──────────────────────────────────────────────────────────────────────────────
// La DGII firma sin preservar espacios (PreserveWhitespace=false) y luego entrega
// el documento INDENTADO. El verificador tiene que hacer lo mismo que el
// verificador .NET de la DGII: quitar los nodos de texto vacíos antes de validar.
// ──────────────────────────────────────────────────────────────────────────────

const PASSPHRASE = 'clave-prueba-verificador';

function generateP12(): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 60_000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const attrs = [
    { name: 'commonName', value: 'Emisor Prueba' },
    { shortName: 'C', value: 'DO' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], PASSPHRASE, { algorithm: '3des' });
  return Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary');
}

/** Indenta un XML compacto como lo entrega la DGII (un elemento por línea). */
function indentar(xml: string): string {
  let nivel = 0;
  return xml
    .replace(/></g, '>\n<')
    .split('\n')
    .map((linea) => {
      if (/^<\//.test(linea)) nivel--;
      const out = '  '.repeat(Math.max(nivel, 0)) + linea;
      if (/^<[^/?!][^>]*[^/]>$/.test(linea) && !/<\/[^>]+>$/.test(linea)) nivel++;
      return out;
    })
    .join('\n');
}

const SEMILLA = '<?xml version="1.0" encoding="utf-8"?><SemillaModel><valor>abc-123</valor><fecha>2026-10-28T12:00:00-04:00</fecha></SemillaModel>';
const ECF = '<?xml version="1.0" encoding="utf-8"?><ECF><Encabezado><Version>1.0</Version><IdDoc><TipoeCF>31</TipoeCF><eNCF>E310000000001</eNCF></IdDoc></Encabezado><FechaHoraFirma>28-10-2026 12:00:00</FechaHoraFirma></ECF>';

describe('verificarFirmaEcf', () => {
  const p12 = generateP12();

  it('acepta un documento firmado tal como sale del firmador', () => {
    const firmado = firmarDocumento({ p12, passphrase: PASSPHRASE, xml: ECF });
    expect(verificarFirmaEcf(firmado).valida).toBe(true);
  });

  it('acepta un e-CF firmado sin espacios y entregado indentado (como lo envía la DGII)', () => {
    const firmado = firmarDocumento({ p12, passphrase: PASSPHRASE, xml: ECF });
    const indentado = indentar(firmado);
    expect(indentado).not.toBe(firmado);
    expect(verificarFirmaEcf(indentado).valida).toBe(true);
  });

  it('verifica cualquier raíz firmada, por ejemplo la semilla de autenticación', () => {
    const firmado = firmarDocumento({
      p12,
      passphrase: PASSPHRASE,
      xml: SEMILLA,
      signOptions: { referenceXPath: "//*[local-name(.)='SemillaModel']" },
    });
    expect(verificarFirmaEcf(indentar(firmado)).valida).toBe(true);
  });

  it('rechaza un documento alterado después de firmado, aunque venga indentado', () => {
    const firmado = firmarDocumento({ p12, passphrase: PASSPHRASE, xml: ECF });
    const alterado = indentar(firmado).replace('E310000000001', 'E310000000002');
    expect(verificarFirmaEcf(alterado).valida).toBe(false);
  });

  it('rechaza un documento sin firma', () => {
    expect(verificarFirmaEcf(SEMILLA).valida).toBe(false);
  });
});
