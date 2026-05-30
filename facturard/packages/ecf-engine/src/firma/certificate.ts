import * as forge from 'node-forge';
import type { CertificateData } from './types';

export interface CertificateInfo {
  /** Nombre del titular (campo CN del sujeto) */
  titular: string
  /** RNC u otro identificador del sujeto (campo SERIALNUMBER o CN) */
  rnc: string
  /** Número de serie del certificado (hex) */
  serial: string
  /** CN del emisor del certificado */
  emitidoPor: string
  validoDesde: Date
  validoHasta: Date
}

function fieldValue(attrs: forge.pki.CertificateField[], name: string): string {
  // node-forge returns fields by shortName or name; value may not always be string
  const attr = attrs.find(
    (a) => a.shortName === name || a.name === name || (a as { type?: string }).type === name,
  )
  return typeof attr?.value === 'string' ? attr.value : ''
}

/**
 * Parsea un P12 y extrae los metadatos del certificado X.509 sin devolver
 * material criptográfico. Valida que el P12 y la passphrase sean correctos.
 *
 * @throws si el P12 es inválido, la passphrase es incorrecta o el formato es inesperado
 */
export function parseCertificateInfo(p12Buffer: Buffer, passphrase: string): CertificateInfo {
  const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'))
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase)
  const cert = extractCertificateRaw(p12)

  const subjectAttrs = cert.subject.attributes
  const issuerAttrs  = cert.issuer.attributes

  // DGII certs: CN = nombre titular; SERIALNUMBER = RNC (OID 2.5.4.5)
  const titular = fieldValue(subjectAttrs, 'CN') || fieldValue(subjectAttrs, 'O') || 'Desconocido'

  // SERIALNUMBER shortName varies; try by OID '2.5.4.5' as fallback
  const rnc =
    fieldValue(subjectAttrs, 'SERIALNUMBER') ||
    fieldValue(subjectAttrs, '2.5.4.5') ||
    fieldValue(subjectAttrs, 'serialNumber') ||
    fieldValue(subjectAttrs, 'CN')

  return {
    titular,
    rnc,
    serial: cert.serialNumber,
    emitidoPor: fieldValue(issuerAttrs, 'CN') || fieldValue(issuerAttrs, 'O') || 'Desconocido',
    validoDesde: cert.validity.notBefore,
    validoHasta: cert.validity.notAfter,
  }
}

function extractCertificateRaw(p12: forge.pkcs12.Pkcs12Pfx): forge.pki.Certificate {
  const certBagOid = forge.pki.oids.certBag as string
  const bags = p12.getBags({ bagType: certBagOid })
  const certs = bags[certBagOid]
  const first = certs?.[0]
  if (!first?.cert) throw new Error('No se encontró certificado en el P12')
  return first.cert
}

/**
 * Carga un archivo P12, extrae la clave privada RSA y el certificado X.509
 * y los retorna en formato PEM listos para firmar.
 */
export function extractFromP12(p12Buffer: Buffer, passphrase: string): CertificateData {
  const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase);

  return {
    privateKeyPem: forge.pki.privateKeyToPem(extractPrivateKey(p12)),
    certificatePem: forge.pki.certificateToPem(extractCertificate(p12)),
  };
}

function extractPrivateKey(p12: forge.pkcs12.Pkcs12Pfx): forge.pki.PrivateKey {
  // La mayoría de los P12 usan pkcs8ShroudedKeyBag; algunos usan keyBag sin cifrar
  // Los OIDs de node-forge están tipados como string|undefined aunque siempre están definidos
  const shroudedOid = forge.pki.oids.pkcs8ShroudedKeyBag as string
  const keyBagOid   = forge.pki.oids.keyBag as string

  const shroudedBags = p12.getBags({ bagType: shroudedOid })
  const shrouded = shroudedBags[shroudedOid]
  if (shrouded?.length && shrouded[0]?.key) return shrouded[0].key

  const plainBags = p12.getBags({ bagType: keyBagOid })
  const plain = plainBags[keyBagOid]
  if (plain?.length && plain[0]?.key) return plain[0].key

  throw new Error('No se encontró clave privada en el archivo P12')
}

function extractCertificate(p12: forge.pkcs12.Pkcs12Pfx): forge.pki.Certificate {
  const certBagOid = forge.pki.oids.certBag as string
  const bags = p12.getBags({ bagType: certBagOid })
  const certs = bags[certBagOid]

  const firstCert = certs?.[0]
  if (!certs?.length || !firstCert?.cert) {
    throw new Error('No se encontró certificado público en el archivo P12')
  }

  // Si hay varios certificados en la cadena, el primero es siempre el del titular
  return firstCert.cert
}
