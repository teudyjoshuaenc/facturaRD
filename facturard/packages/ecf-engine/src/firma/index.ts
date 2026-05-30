import { readFileSync } from 'fs';
import { extractFromP12, parseCertificateInfo } from './certificate';
import type { CertificateInfo } from './certificate';
import { signXml } from './signer';
import type { CertificateData, SignXmlOptions } from './types';

export type { CertificateData, SignXmlOptions, CertificateInfo };
export { extractFromP12, signXml, parseCertificateInfo };

export { verificarFirmaEcf } from './verifier';
export type { VerificacionFirmaResult, InfoCertificado } from './verifier';

export interface FirmarDocumentoOptions {
  /** Ruta al archivo .p12 o Buffer con su contenido */
  p12: string | Buffer;
  passphrase: string;
  /** String con el XML a firmar */
  xml: string;
  signOptions?: SignXmlOptions;
}

/**
 * API principal del módulo.
 * Carga el P12, extrae las credenciales y retorna el XML firmado
 * listo para enviar a la DGII.
 */
export function firmarDocumento(options: FirmarDocumentoOptions): string {
  const { p12, passphrase, xml, signOptions } = options;
  const p12Buffer = typeof p12 === 'string' ? readFileSync(p12) : p12;
  const certData = extractFromP12(p12Buffer, passphrase);
  return signXml(xml, certData, signOptions);
}
