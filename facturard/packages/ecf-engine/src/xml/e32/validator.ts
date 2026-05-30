import { execFileSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { ValidationResult } from '../types';

const SCHEMA_ECF32  = join(__dirname, '..', 'schemas', 'e-CF-32-v.1.0.xsd');
const SCHEMA_RFCE32 = join(__dirname, '..', 'schemas', 'rfce-32-v.1.0.xsd');

function validateXml(xml: string, schemaPath: string, rootTag: string): ValidationResult {
  // El XSD exige xs:any (minOccurs=1) al final del documento (slot para <Signature>).
  // Para validar antes de firmar se inyecta un placeholder que satisface ese xs:any.
  const xmlToValidate = xml.replace(`</${rootTag}>`, `  <FirmaDigital/>\n</${rootTag}>`);

  const tmpXml = join(tmpdir(), `ecf32-${process.hrtime.bigint()}.xml`);
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

export function validateECF32(xml: string): ValidationResult {
  return validateXml(xml, SCHEMA_ECF32, 'ECF');
}

export function validateRFCE32(xml: string): ValidationResult {
  return validateXml(xml, SCHEMA_RFCE32, 'RFCE');
}
