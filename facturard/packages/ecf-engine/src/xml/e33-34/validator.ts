import { execFileSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { ValidationResult } from '../types';

const SCHEMA_ECF33 = join(__dirname, '..', 'schemas', 'e-CF-33-v.1.0.xsd');
const SCHEMA_ECF34 = join(__dirname, '..', 'schemas', 'e-CF-34-v.1.0.xsd');

function validateXml(xml: string, schemaPath: string): ValidationResult {
  // xs:any (minOccurs=1) al final del ECF reserva el slot para <Signature>.
  // Se inyecta un placeholder para poder validar pre-firma.
  const xmlToValidate = xml.replace('</ECF>', '  <FirmaDigital/>\n</ECF>');

  const tmpXml = join(tmpdir(), `ecf-nota-${process.hrtime.bigint()}.xml`);
  try {
    writeFileSync(tmpXml, xmlToValidate, 'utf8');
    execFileSync('xmllint', ['--schema', schemaPath, '--noout', tmpXml], {
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

export function validateECF33(xml: string): ValidationResult {
  return validateXml(xml, SCHEMA_ECF33);
}

export function validateECF34(xml: string): ValidationResult {
  return validateXml(xml, SCHEMA_ECF34);
}
