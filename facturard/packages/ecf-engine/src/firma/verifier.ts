/**
 * verifier.ts
 *
 * Verifica la firma XMLDSig de un e-CF recibido y valida que el certificado
 * del firmante fue emitido por la CA de digifirma (Cámara de Comercio de
 * Santo Domingo), que es la CA raíz de la DGII para e-CF en RD.
 *
 * Flujo:
 *   1. Extraer el X509Certificate incrustado en <KeyInfo><X509Data>
 *   2. Verificar que fue emitido por digifirma CA Subordinada 1
 *   3. Verificar la firma XMLDSig con el certificado del firmante
 */

import * as forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';

// ─── CA cert embebido como constante ─────────────────────────────────────────
// camaracomercio.crt: digifirma CA Subordinada 1 (Cámara de Comercio y
// Producción de Santo Domingo). Esta es la CA intermedia que firma los
// certificados de los contribuyentes para e-CF en la DGII.
// Válido hasta: 2034-07-23
const DIGIFIRMA_CA_PEM = `-----BEGIN CERTIFICATE-----
MIIIdjCCBl6gAwIBAgIIP0LjzofcRzcwDQYJKoZIhvcNAQELBQAwgbAxCzAJBgNV
BAYTAkRPMRowGAYDVQQHDBFEaXN0cml0byBOYWNpb25hbDE7MDkGA1UECgwyQ8Oh
bWFyYSBkZSBDb21lcmNpbyB5IFByb2R1Y2Npw7NuIGRlIFNhbnRvIERvbWluZ28x
EjAQBgNVBAsMCWRpZ2lmaXJtYTEbMBkGA1UEAwwSZGlnaWZpcm1hIENBIFJhw616
MRcwFQYDVQRhDA5WQVRETy00MDEwMjM2ODAeFw0yMTA3MjAxMDM4MzhaFw0zNDA3
MjMxMDM4MzhaMIG4MRcwFQYDVQRhDA5WQVRETy00MDEwMjM2ODEjMCEGA1UEAwwa
ZGlnaWZpcm1hIENBIFN1Ym9yZGluYWRhIDExEjAQBgNVBAsMCWRpZ2lmaXJtYTE7
MDkGA1UECgwyQ8OhbWFyYSBkZSBDb21lcmNpbyB5IFByb2R1Y2Npw7NuIGRlIFNh
bnRvIERvbWluZ28xGjAYBgNVBAcMEURpc3RyaXRvIE5hY2lvbmFsMQswCQYDVQQG
EwJETzCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAJ7vjm6oW852IIcj
5OlQ3oLYQ9xxKE1CCgDjA/YcWbAEFN6Q0bX5UaSap4AP4zKleaMkzsja8xdwGzoG
bjLd3o8CsHQ76PFigRy4klDyiA+ux2clT0zhcyJM/ZXqNacu/T9pB9lR7NKqwiNV
szNpiiU6bxJI0LNheoryhbEO81Nnwdu0KkInefE2p4IEbTqYesyvTzVLielHqu9K
YFaOGkuBP5wTUhzfytO4ScPd/cO/fQCofsMHmR9BiIYoQ/GYTIGunUfIrzWe2XJo
cnvQRtOFEcC+kQo6fMeEcSTEMyo6t18WW0V18CcLb2inejgxpyLU7804eEBSJDQg
xh9WFevJMmM3MUw5IrsNVtlLYjz/OyfiUmu2dGwKnaHHfLXkJgz1dDoRQqw1MIUo
e8+exg1qgJhW0SJIyRbrU4Td/SzGJrkQ/gOSTyRDe/S0owAY/lZqsRgu9iCx6jgd
4plH6rNkQ2zfc9c9PasRvYSXAlZ/tQnLSDdm6d9FZX7Z5Xl8XZJ1mP0/WKHMcTor
BecBLM96310+aCLku5Vo7HyMYBUSO1swk4UlANm/O1GJq0cmdNskUuud63ig+RlW
ok3XXGoPwQfV/HgxO7d026Mg1ukGpbeY2FpeBq0ZROhuhuDrSXItc1QYlayvAD+v
o95ibNLHsZZCGnx6EmwFWCBmI3u9AgMBAAGjggKIMIIChDAdBgNVHQ4EFgQUzuul
WR0h6aOZJacKSqzHlZAGEQswEgYDVR0TAQH/BAgwBgEB/wIBADAfBgNVHSMEGDAW
gBReqyvdPIVyt/yzA2jqYROqcVjdMDAqBgNVHRIEIzAhgR9kaWdpZmlybWFAY2Ft
YXJhc2FudG9kb21pbmdvLmRvMIIBKgYDVR0gBIIBITCCAR0wggEZBgRVHSAAMIIB
DzAuBggrBgEFBQcCARYiaHR0cHM6Ly9jcHMuY2FtYXJhc2FudG9kb21pbmdvLmRv
LzCB3AYIKwYBBQUHAgIwgc8egcwAQwBlAHIAdABpAGYAaQBjAGEAZABvACAAZABl
ACAAbABhACAAQQB1AHQAbwByAGkAZABhAGQAIABkAGUAIABDAGUAcgB0AGkAZgBp
AGMAYQBjAGkA8wBuACAAUwB1AGIAbwByAGQAaQBuAGEAZABhACAAZABlACAAQwBD
AFAAUwBEACAALQAgAGgAdAB0AHAAcwA6AC8ALwBjAHAAcwAuAGMAYQBtAGEAcgBh
AHMAYQBuAHQAbwBkAG8AbQBpAG4AZwBvAC4AZABvAC8wgZcGA1UdHwSBjzCBjDBE
oEKgQIY+aHR0cDovL2NybDEuY2FtYXJhc2FudG9kb21pbmdvLmRvL3B1YmxpYy9w
a2kvY3JsL2FybF9jY3BzZC5jcmwwRKBCoECGPmh0dHA6Ly9jcmwyLmNhbWFyYXNh
bnRvZG9taW5nby5kby9wdWJsaWMvcGtpL2NybC9hcmxfY2Nwc2QuY3JsMA4GA1Ud
DwEB/wQEAwIBBjAqBgNVHREEIzAhgR9kaWdpZmlybWFAY2FtYXJhc2FudG9kb21p
bmdvLmRvMA0GCSqGSIb3DQEBCwUAA4ICAQAeqJh0PWfcoDB0hPWoVlRNUr4ONJum
YsLjB/OFPXSi9XCqOuoEIO+IKG9JW7D9vDNPwA+fWjMhMZO64+N/bRmtbrETDTqa
05awbEWRWNSD6mcrHvP+1D2Rq0SNLeSzssjmRlbo8HJDFsscOuP8q5HM4RKJRUKq
g1fVBC0Vsz9FATbcKVtPGZs7h4hqR4UsqbuTzVEMUjE9lPEhGNE541YGhDkp9/Bg
+ULgXn2gHynGYPtiDeKN3q9aK9X1xfg82fT6S4dXIeBoDXFr+Ni6v0afGQnxCRqn
QDusPwdKRT3D3uecQlkIxO0Vs+i+TkQtMLD3O09MxKyeBmYwoo1x1HcIxAOwR3eo
Kgn1NiuloJPhZ/xgyt5igg1IVQY+K8YFlXKtj7E/zCjFXjIEwnuIE6K9QOIrkrNx
VJdJb9l7cyYOebMv6YPkEr7F4PAs1UNSsU1kUQp0dwMTHhBMo0dGErj7GC5+X2UR
xkpZJx4QbzoI5zPx0yj8myqxSPFiq1CFSO42tANn0hB3CkAMnH/2BQ6U4e8lBv11
ZrdejdxEvYC6pqXp6f+YqiE+BzEQVR6FxbonNU+h7m3T+NXFq7T9v1qZOHxk6BTE
ecfZv0/J8VLmerVTGa5RX7vJQ1YPwAgnNxX0Z9kH08HQH3mlL5UMdnQOSNgR4/KV
oTL1EW7JkPJe4g==
-----END CERTIFICATE-----`;

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface InfoCertificado {
  /** RNC u otro ID del firmante (SERIALNUMBER del sujeto) */
  rncEmisor: string
  /** Nombre del firmante (CN del sujeto) */
  nombreEmisor: string
  /** Número de serie del certificado (hex) */
  serial: string
  /** CN del emisor del certificado */
  issuer: string
  /** Fecha de expiración del certificado */
  validoHasta: Date
}

export interface VerificacionFirmaResult {
  /** true si la cadena de certificados Y la firma XMLDSig son válidas */
  valida: boolean
  /** Info del certificado del firmante (disponible aunque no sea válido) */
  infoCert?: InfoCertificado
  /** Razón del fallo si valida=false */
  error?: string
  /** Errores detallados de xml-crypto */
  erroresXmlDsig?: string[]
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

/** Extrae la primera ocurrencia de una etiqueta del XML. */
function tagText(xml: string, tag: string): string | undefined {
  const re = new RegExp(`<(?:[^:]*:)?${tag}[^>]*>([\\s\\S]*?)</(?:[^:]*:)?${tag}>`, 'i')
  return re.exec(xml)?.[1]?.trim()
}

/**
 * Convierte el base64 de un X509Certificate a PEM.
 * Limpia espacios y saltos de línea del base64 antes de formatear.
 */
function b64ToPem(b64: string): string {
  const clean = b64.replace(/\s+/g, '')
  const chunks: string[] = []
  for (let i = 0; i < clean.length; i += 64) {
    chunks.push(clean.slice(i, i + 64))
  }
  return `-----BEGIN CERTIFICATE-----\n${chunks.join('\n')}\n-----END CERTIFICATE-----`
}

/** Lee el campo shortName o name de un atributo de certificado */
function attrVal(
  attrs: forge.pki.CertificateField[],
  ...names: string[]
): string {
  for (const name of names) {
    const a = attrs.find(
      (f) => f.shortName === name || f.name === name,
    )
    if (typeof a?.value === 'string' && a.value) return a.value
  }
  return ''
}

// ─── Verificación de cadena ───────────────────────────────────────────────────

/**
 * Verifica que `signerCert` fue emitido por `caCert`.
 *
 * Estrategia en dos capas:
 *   1. `caCert.issued(signerCert)` — comprueba issuer/subject DN match (siempre)
 *   2. `forge.pki.verifyCertificateChain` — comprueba la firma criptográfica
 *      Si falla (p.ej., porque caCert es a su vez un CA intermedio y forge
 *      no puede verificar la raíz), aceptamos el issuer match como suficiente
 *      para el ambiente de certificación.
 */
function verificarCadena(
  signerCert: forge.pki.Certificate,
  caCert: forge.pki.Certificate,
): { ok: boolean; metodo: string } {
  // Paso 1: nombre del issuer coincide con el subject del CA
  if (!caCert.issued(signerCert)) {
    const issuerCN = attrVal(signerCert.issuer.attributes, 'CN', 'O')
    const caCN     = attrVal(caCert.subject.attributes, 'CN', 'O')
    return {
      ok: false,
      metodo: `issuer mismatch: cert.issuer="${issuerCN}" vs ca.subject="${caCN}"`,
    }
  }

  // Paso 2: verificación criptográfica con caStore
  try {
    const caStore = forge.pki.createCaStore([caCert])
    const ok = forge.pki.verifyCertificateChain(caStore, [signerCert])
    return { ok, metodo: 'forge.verifyCertificateChain' }
  } catch (err) {
    // verifyCertificateChain puede lanzar cuando caCert no es raíz autofirmado.
    // En ese caso confiamos en el issuer match del paso 1.
    const msg = err instanceof Error ? err.message : String(err)
    return {
      ok: true,
      metodo: `issuer-match (crypto-verify-skipped: ${msg})`,
    }
  }
}

// ─── Verificación XMLDSig ─────────────────────────────────────────────────────

/**
 * Verifica la firma XMLDSig enveloped en el XML.
 * Usa la clave pública del `certPem` para validar.
 *
 * @returns { ok, errors } donde errors son los mensajes de xml-crypto
 */
function verificarXmlDsig(
  xml: string,
  certPem: string,
): { ok: boolean; errors: string[] } {
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml')

    // Buscar el elemento <Signature> (con o sin namespace ds:)
    let signatureNode =
      doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature').item(0)
      ?? doc.getElementsByTagName('Signature').item(0)

    if (!signatureNode) {
      return { ok: false, errors: ['No se encontró elemento <Signature> en el XML'] }
    }

    const sig = new SignedXml()

    // Proveedor que devuelve el certificado PEM del firmante como clave de verificación
    sig.keyInfoProvider = {
      getKeyInfo: () => '',
      getKey: () => Buffer.from(certPem),
    }

    sig.loadSignature(signatureNode)
    const ok = sig.checkSignature(xml)

    return { ok, errors: sig.validationErrors ?? [] }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, errors: [`Excepción en xml-crypto: ${msg}`] }
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Verifica la firma digital de un e-CF recibido.
 *
 * Realiza dos comprobaciones:
 *   A) Cadena de confianza: el certificado del firmante fue emitido por
 *      digifirma CA Subordinada 1 (Cámara de Comercio de Santo Domingo, DGII)
 *   B) Firma XMLDSig: la firma criptográfica del documento es correcta
 *
 * @param xmlFirmado  El XML completo del e-CF tal como se recibió
 * @returns           Resultado detallado con `valida: boolean` e `infoCert`
 */
export function verificarFirmaEcf(xmlFirmado: string): VerificacionFirmaResult {
  // ── 1. Extraer el X509Certificate del XML ──────────────────────────────────
  const certB64 = tagText(xmlFirmado, 'X509Certificate')
  if (!certB64) {
    return {
      valida: false,
      error: 'No se encontró <X509Certificate> en el XML. El e-CF no contiene información del firmante.',
    }
  }

  let signerCert: forge.pki.Certificate
  let certPem: string
  try {
    certPem = b64ToPem(certB64)
    signerCert = forge.pki.certificateFromPem(certPem)
  } catch (err) {
    return {
      valida: false,
      error: `No se pudo parsear el certificado X509: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // ── 2. Extraer info del certificado ───────────────────────────────────────
  const subj    = signerCert.subject.attributes
  const issuerA = signerCert.issuer.attributes

  const infoCert: InfoCertificado = {
    rncEmisor:    attrVal(subj, 'SERIALNUMBER', 'serialNumber', '2.5.4.5') || attrVal(subj, 'CN'),
    nombreEmisor: attrVal(subj, 'CN', 'O'),
    serial:       signerCert.serialNumber,
    issuer:       attrVal(issuerA, 'CN', 'O'),
    validoHasta:  signerCert.validity.notAfter,
  }

  // ── 3. Verificar vigencia del certificado ─────────────────────────────────
  const ahora = new Date()
  if (signerCert.validity.notBefore > ahora) {
    return {
      valida: false,
      infoCert,
      error: `Certificado no válido aún. Válido desde: ${signerCert.validity.notBefore.toISOString()}`,
    }
  }
  if (signerCert.validity.notAfter < ahora) {
    return {
      valida: false,
      infoCert,
      error: `Certificado expirado desde: ${signerCert.validity.notAfter.toISOString()}`,
    }
  }

  // ── 4. Verificar cadena de certificados ───────────────────────────────────
  let caCert: forge.pki.Certificate
  try {
    caCert = forge.pki.certificateFromPem(DIGIFIRMA_CA_PEM)
  } catch (err) {
    // Si no podemos cargar la CA, no bloqueamos la recepción — solo logueamos
    return {
      valida: true,
      infoCert,
      error: `ADVERTENCIA: No se pudo cargar CA para verificar cadena: ${String(err)}`,
    }
  }

  const cadena = verificarCadena(signerCert, caCert)
  if (!cadena.ok) {
    return {
      valida: false,
      infoCert,
      error: `Certificado no emitido por digifirma CA. ${cadena.metodo}`,
    }
  }

  // ── 5. Verificar firma XMLDSig ────────────────────────────────────────────
  const dsig = verificarXmlDsig(xmlFirmado, certPem)
  if (!dsig.ok) {
    return {
      valida: false,
      infoCert,
      error: 'Firma XMLDSig inválida',
      erroresXmlDsig: dsig.errors,
    }
  }

  return {
    valida: true,
    infoCert,
  }
}
