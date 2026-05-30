import { readFileSync } from 'fs';
import { extractFromP12 } from '../firma/certificate';
import { signXml } from '../firma/signer';
import {
  resolveEndpoints,
  DgiiApiError,
  type DgiiClientConfig,
  type DgiiTokenResponse,
} from './types';

/**
 * GET semilla desde la DGII.
 * Retorna el XML completo tal como lo devuelve la DGII (se firmará sin modificaciones).
 */
async function obtenerSemillaXml(authBase: string): Promise<string> {
  const res = await fetch(`${authBase}/api/Autenticacion/Semilla`);
  if (!res.ok) {
    throw new DgiiApiError('Error al obtener semilla', res.status, await res.text());
  }

  const text = await res.text();
  if (!/<SemillaModel/i.test(text)) {
    throw new DgiiApiError('Respuesta de semilla inesperada', undefined, text);
  }

  return text;
}

/** Firma el XML de semilla con el P12 (desde disco o buffer en memoria) */
function firmarSemilla(semillaXml: string, config: DgiiClientConfig): string {
  const p12Buffer = config.p12Buffer ?? (config.certPath !== undefined ? readFileSync(config.certPath) : undefined);
  if (!p12Buffer) throw new Error('DgiiClientConfig requiere certPath o p12Buffer');
  const certData = extractFromP12(p12Buffer, config.passphrase);
  return signXml(semillaXml, certData, {
    referenceXPath: "//*[local-name(.)='SemillaModel']",
  });
}

/** POST del XML firmado y retorno del token JWT */
async function enviarXmlFirmado(authBase: string, signedXml: string): Promise<string> {
  const form = new FormData();
  form.append('xml', new Blob([signedXml], { type: 'application/xml' }), 'semilla.xml');

  const res = await fetch(`${authBase}/api/Autenticacion/ValidarSemilla`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    throw new DgiiApiError('Error al autenticar con la DGII', res.status, await res.text());
  }

  const text = await res.text();
  let token: DgiiTokenResponse;
  try {
    token = JSON.parse(text) as DgiiTokenResponse;
  } catch {
    throw new DgiiApiError('Respuesta de token con formato inesperado', undefined, text);
  }

  if (!token.token) {
    throw new DgiiApiError('Token vacío en la respuesta de autenticación', undefined, text);
  }

  return token.token;
}

/**
 * Autentica con la DGII y retorna el JWT bearer token.
 *
 * Flujo: GET semilla (XML) → firmar <DGII_A1> → POST → token
 */
export async function autenticar(config: DgiiClientConfig): Promise<string> {
  const { auth } = resolveEndpoints(config.env);
  const semillaXml = await obtenerSemillaXml(auth);
  const signedXml = firmarSemilla(semillaXml, config);
  return enviarXmlFirmado(auth, signedXml);
}
