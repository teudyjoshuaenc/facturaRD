import { SignedXml } from 'xml-crypto';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { CertificateData, SignXmlOptions } from './types';

// Algoritmos exigidos por el estándar XMLDSig que requiere la DGII de RD
const C14N_EXCLUSIVE = 'http://www.w3.org/2001/10/xml-exc-c14n#';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
const RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';

// XPath por defecto apunta al elemento raíz <ECF> del e-CF de la DGII
const DEFAULT_XPATH = "//*[local-name(.)='ECF']";

/**
 * Proveedor de KeyInfo que incluye el certificado X.509 en el bloque
 * <ds:KeyInfo><ds:X509Data> para que la DGII pueda verificar la firma.
 */
class X509KeyInfoProvider {
  private readonly certDer: string;

  constructor(certPem: string) {
    this.certDer = certPem
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/[\r\n\s]+/g, '');
  }

  getKeyInfo(_key: string, prefix: string): string {
    const ns = prefix ? `${prefix}:` : '';
    return (
      `<${ns}X509Data>` +
      `<${ns}X509Certificate>${this.certDer}</${ns}X509Certificate>` +
      `</${ns}X509Data>`
    );
  }

  // xml-crypto llama a getKey al verificar; no se usa al firmar
  getKey(_keyInfo: Element[]): Buffer {
    return Buffer.alloc(0);
  }
}

/**
 * Elimina nodos de texto que contienen solo espacios en blanco, replicando el
 * comportamiento de XmlDocument en .NET con PreserveWhitespace=false (valor por
 * defecto). Sin esto, el DigestValue que calculamos incluye los espacios de
 * indentación del XML, pero el servidor DGII los elimina al cargar el documento
 * antes de verificar, lo que causa el error "Firma del certificado invalida".
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripWhitespace(node: any): void {
  let child = node.firstChild;
  while (child) {
    const next = child.nextSibling;
    if (child.nodeType === 3 /* TEXT_NODE */ && !/\S/.test(child.nodeValue ?? '')) {
      node.removeChild(child);
    } else {
      stripWhitespace(child);
    }
    child = next;
  }
}

function normalizeXml(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  stripWhitespace(doc);
  return new XMLSerializer().serializeToString(doc);
}

/**
 * Firma un XML usando XMLDSig con firma enveloped y canonicalización C14N
 * exclusiva (http://www.w3.org/2001/10/xml-exc-c14n#), estándar DGII e-CF.
 *
 * @returns XML con el elemento <Signature> inyectado
 */
export function signXml(
  xml: string,
  certData: CertificateData,
  options: SignXmlOptions = {},
): string {
  // Normalizar antes de firmar: elimina nodos de texto con solo whitespace para
  // que el DigestValue coincida con lo que calcula el verificador .NET de la DGII.
  const normalizedXml = normalizeXml(xml);

  const sig = new SignedXml();
  sig.signingKey = certData.privateKeyPem;
  sig.canonicalizationAlgorithm = C14N_EXCLUSIVE;
  sig.signatureAlgorithm = RSA_SHA256;
  sig.keyInfoProvider = new X509KeyInfoProvider(certData.certificatePem);

  // uri='' + isEmptyUri=true → referencia al documento completo (enveloped)
  // inclusiveNamespacesPrefixList='' → sin prefijos adicionales para C14N exclusivo
  sig.addReference(
    options.referenceXPath ?? DEFAULT_XPATH,
    [ENVELOPED, C14N_EXCLUSIVE],
    SHA256,
    '',
    '',
    '',
    true,
  );

  sig.computeSignature(normalizedXml, options.location ? { location: options.location } : undefined);

  return sig.getSignedXml();
}
