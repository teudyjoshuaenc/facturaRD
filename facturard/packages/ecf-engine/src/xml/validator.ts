import { execFileSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ValidationResult } from './types';

// Schema oficial descargado de la DGII
const SCHEMA_PATH = join(__dirname, 'schemas', 'e-CF-31-v.1.0.xsd');

/**
 * Valida el XML del e-CF 31 contra el schema oficial de la DGII usando xmllint.
 *
 * El XSD exige un elemento xs:any al final del ECF (que será cubierto por
 * <Signature> al firmar). Para poder validar el XML PRE-firma se añade un
 * placeholder <FirmaDigital/> que satisface ese requerimiento y luego se
 * descarta — el XML retornado por generarECF31() NO lo contiene.
 */
export function validateECF31(xml: string): ValidationResult {
  // Inyecta placeholder para xs:any (minOccurs="1") que cubre el slot de Signature
  const xmlToValidate = xml.replace('</ECF>', '  <FirmaDigital/>\n</ECF>');

  const tmpXml = join(tmpdir(), `ecf31-${process.hrtime.bigint()}.xml`);
  try {
    writeFileSync(tmpXml, xmlToValidate, 'utf8');
    execFileSync('xmllint', ['--schema', SCHEMA_PATH, '--noout', tmpXml], {
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    return { valid: true, errors: [] };
  } catch (err: unknown) {
    const raw = (err as NodeJS.ErrnoException & { stderr?: string }).stderr ?? '';
    return { valid: false, errors: parseXmllintErrors(raw) };
  } finally {
    try { unlinkSync(tmpXml); } catch { /* ignorar */ }
  }
}

function parseXmllintErrors(raw: string): string[] {
  return raw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.endsWith('fails to validate'))
    .map(l => l.replace(/^[^:]+:\d+:\s*/, ''));
}
