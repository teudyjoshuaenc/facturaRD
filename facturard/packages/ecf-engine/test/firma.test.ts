import * as forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';
import { firmarDocumento } from '../src/firma';

// ──────────────────────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────────────────────

const PASSPHRASE = 'clave-prueba-dgii-2025';
const XMLDSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';

// La DGII exige RSA 2048 como mínimo para los certificados de producción.
// Usamos 2048 aquí para que el test refleje las condiciones reales.
const RSA_BITS = 2048;

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

interface TestCert {
  p12Buffer: Buffer;
  /** Clave pública en PEM, necesaria para verificar la firma en el test */
  publicKeyPem: string;
}

/** Genera un P12 autofirmado sin necesitar un certificado real de la DGII. */
function generateP12(): TestCert {
  const keys = forge.pki.rsa.generateKeyPair(RSA_BITS);

  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const attrs = [
    { name: 'commonName', value: 'Certificado Prueba DGII' },
    { name: 'organizationName', value: 'Empresa Prueba SRL' },
    { shortName: 'C', value: 'DO' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], PASSPHRASE, {
    algorithm: '3des',
  });

  return {
    p12Buffer: Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary'),
    publicKeyPem: forge.pki.publicKeyToPem(keys.publicKey),
  };
}

/**
 * XML de e-CF mínimo válido según el esquema de la DGII.
 * TipoCFE 31 = Factura de Crédito Fiscal Electrónica.
 * eNCF E310000000001 sigue el formato: E + 2-dígitos tipo + 10-dígitos secuencia.
 */
function buildEcfXml(): string {
  return `\
<?xml version="1.0" encoding="UTF-8"?>
<ECF xmlns="http://dgii.gov.do/ecf/mapers/v1">
  <Encabezado>
    <Version>1.0</Version>
    <IdDoc>
      <TipoCFE>31</TipoCFE>
      <eNCF>E310000000001</eNCF>
      <FechaVencimientoSecuencia>31-12-2025</FechaVencimientoSecuencia>
      <IndicadorMontoGravado>1</IndicadorMontoGravado>
      <TipoIngresos>01</TipoIngresos>
      <TipoPago>1</TipoPago>
    </IdDoc>
    <Emisor>
      <RNCEmisor>101000000</RNCEmisor>
      <RazonSocialEmisor>EMPRESA PRUEBA SRL</RazonSocialEmisor>
      <DireccionEmisor>Av. Winston Churchill 1099, Santo Domingo</DireccionEmisor>
      <FechaEmision>01-01-2025</FechaEmision>
    </Emisor>
    <Comprador>
      <RNCComprador>131000000</RNCComprador>
      <RazonSocialComprador>CLIENTE PRUEBA SRL</RazonSocialComprador>
    </Comprador>
    <Totales>
      <MontoGravadoI1>1000.00</MontoGravadoI1>
      <TotalITBIS1>180.00</TotalITBIS1>
      <MontoTotal>1180.00</MontoTotal>
    </Totales>
  </Encabezado>
</ECF>`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Suite de tests
// ──────────────────────────────────────────────────────────────────────────────

describe('firmarDocumento — e-CF DGII', () => {
  let testCert: TestCert;
  let signedXml: string;

  // La generación de RSA-2048 puede tomar varios segundos en hardware lento.
  beforeAll(() => {
    testCert = generateP12();
    signedXml = firmarDocumento({
      p12: testCert.p12Buffer,
      passphrase: PASSPHRASE,
      xml: buildEcfXml(),
    });
  }, 30_000);

  // ── Estructura básica ──────────────────────────────────────────────────────

  it('produce un XML firmado no vacío', () => {
    expect(typeof signedXml).toBe('string');
    expect(signedXml.length).toBeGreaterThan(0);
  });

  it('conserva la declaración XML y el elemento raíz <ECF>', () => {
    expect(signedXml).toContain('<?xml');
    expect(signedXml).toContain('<ECF');
    expect(signedXml).toContain('</ECF>');
  });

  // ── Presencia y ubicación del <Signature> ─────────────────────────────────

  it('contiene exactamente un elemento <Signature>', () => {
    const doc = new DOMParser().parseFromString(signedXml, 'text/xml');
    const sigs = doc.getElementsByTagNameNS(XMLDSIG_NS, 'Signature');
    expect(sigs.length).toBe(1);
  });

  it('<Signature> es hijo directo del elemento raíz <ECF>', () => {
    const doc = new DOMParser().parseFromString(signedXml, 'text/xml');
    const sigNode = doc.getElementsByTagNameNS(XMLDSIG_NS, 'Signature')[0];
    expect(sigNode).toBeDefined();
    // El padre inmediato debe ser ECF (con o sin prefijo de namespace)
    expect(sigNode.parentNode?.nodeName).toMatch(/ECF/);
  });

  // ── Algoritmos exigidos por la DGII ───────────────────────────────────────

  it('<CanonicalizationMethod> usa C14N exclusivo', () => {
    const doc = new DOMParser().parseFromString(signedXml, 'text/xml');
    const c14n = doc.getElementsByTagNameNS(XMLDSIG_NS, 'CanonicalizationMethod')[0];
    expect(c14n?.getAttribute('Algorithm')).toBe('http://www.w3.org/2001/10/xml-exc-c14n#');
  });

  it('<SignatureMethod> usa RSA-SHA256', () => {
    const doc = new DOMParser().parseFromString(signedXml, 'text/xml');
    const method = doc.getElementsByTagNameNS(XMLDSIG_NS, 'SignatureMethod')[0];
    expect(method?.getAttribute('Algorithm')).toBe(
      'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    );
  });

  it('<DigestMethod> usa SHA-256', () => {
    const doc = new DOMParser().parseFromString(signedXml, 'text/xml');
    const digest = doc.getElementsByTagNameNS(XMLDSIG_NS, 'DigestMethod')[0];
    expect(digest?.getAttribute('Algorithm')).toBe('http://www.w3.org/2001/04/xmlenc#sha256');
  });

  // ── KeyInfo / X509 ────────────────────────────────────────────────────────

  it('<KeyInfo> incluye el certificado X.509 del firmante', () => {
    const doc = new DOMParser().parseFromString(signedXml, 'text/xml');
    const x509 = doc.getElementsByTagNameNS(XMLDSIG_NS, 'X509Certificate');
    expect(x509.length).toBeGreaterThanOrEqual(1);
    expect((x509[0].textContent ?? '').length).toBeGreaterThan(100);
  });

  // ── Verificación criptográfica ─────────────────────────────────────────────

  it('la firma se verifica correctamente con la clave pública del certificado', () => {
    const doc = new DOMParser().parseFromString(signedXml, 'text/xml');
    const sigNode = doc.getElementsByTagNameNS(XMLDSIG_NS, 'Signature')[0];

    const verifier = new SignedXml();
    verifier.keyInfoProvider = {
      getKeyInfo: () => '',
      // xml-crypto pasa este buffer a Node.js crypto.createVerify para RSA
      getKey: () => Buffer.from(testCert.publicKeyPem),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    verifier.loadSignature(sigNode as any);
    const isValid = verifier.checkSignature(signedXml);

    if (!isValid) {
      console.error('Errores de verificación:', verifier.validationErrors);
    }
    expect(isValid).toBe(true);
  });

  it('una modificación al XML invalida la firma', () => {
    // Cualquier cambio en el contenido firmado debe romper la verificación
    const tampered = signedXml.replace('<TipoCFE>31</TipoCFE>', '<TipoCFE>32</TipoCFE>');

    const doc = new DOMParser().parseFromString(tampered, 'text/xml');
    const sigNode = doc.getElementsByTagNameNS(XMLDSIG_NS, 'Signature')[0];

    const verifier = new SignedXml();
    verifier.keyInfoProvider = {
      getKeyInfo: () => '',
      getKey: () => Buffer.from(testCert.publicKeyPem),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    verifier.loadSignature(sigNode as any);
    expect(verifier.checkSignature(tampered)).toBe(false);
  });
});
