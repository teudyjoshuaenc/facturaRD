import {
  resolveEndpoints,
  DgiiApiError,
  type DgiiClientConfig,
  type DgiiRecepcionResponse,
  type DgiiRecepcionFCResponse,
} from './types';

// ── DEBUG: set DGII_DEBUG=1 para ver request/response completos ──────────────
const DEBUG = process.env['DGII_DEBUG'] === '1';

function debugLog(...args: unknown[]): void {
  if (DEBUG) console.log('[DGII-DEBUG]', ...args);
}

/**
 * Envía un e-CF firmado a la DGII y retorna la respuesta de recepción.
 *
 * Endpoint: POST {recepcion}/api/FacturasElectronicas
 * Respuesta asíncrona — usar consultarEstado con el trackId devuelto.
 */
export async function enviarECF(
  signedXml: string,
  token: string,
  config: Pick<DgiiClientConfig, 'env'>,
): Promise<DgiiRecepcionResponse> {
  const { recepcion } = resolveEndpoints(config.env);
  const url = `${recepcion}/api/FacturasElectronicas`;

  debugLog(`POST ${url}`);
  debugLog(`Authorization: Bearer ${token.slice(0, 20)}...`);
  debugLog(`Body: multipart/form-data  campo=xml  size=${signedXml.length} chars`);

  // La DGII valida que el nombre de archivo sea <RNCEmisor><eNCF>.xml
  const encfMatch = signedXml.match(/<eNCF>([^<]+)<\/eNCF>/);
  const rncMatch  = signedXml.match(/<RNCEmisor>([^<]+)<\/RNCEmisor>/);
  const encf = encfMatch?.[1] ?? '';
  const rnc  = rncMatch?.[1]  ?? '';
  const filename = encf ? `${rnc}${encf}.xml` : 'ecf.xml';
  debugLog(`filename: ${filename}`);

  const form = new FormData();
  form.append('xml', new Blob([signedXml], { type: 'application/xml' }), filename);

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const responseBody = await res.text();

  debugLog(`HTTP ${res.status} ${res.statusText}`);
  debugLog(`Response headers:`);
  if (DEBUG) res.headers.forEach((v, k) => console.log(`  [DGII-DEBUG]   ${k}: ${v}`));
  debugLog(`Response body: ${responseBody}`);

  if (!res.ok) {
    console.error(`   [HTTP ${res.status}] POST ${url}`);
    console.error(`   Response: ${responseBody || '(vacío)'}`);
    throw new DgiiApiError('Error al enviar e-CF', res.status, responseBody);
  }

  try {
    return JSON.parse(responseBody) as DgiiRecepcionResponse;
  } catch {
    throw new DgiiApiError('Respuesta de recepción con formato inesperado', undefined, responseBody);
  }
}

/**
 * Envía un Resumen de Factura de Consumo Electrónica (RFCE-32) al servicio FC.
 *
 * Endpoint: POST {fc}/api/recepcion/ecf   (fc.dgii.gov.do — dominio diferente)
 * Respuesta SINCRÓNICA — el resultado (aceptado/rechazado) llega de inmediato.
 */
export async function enviarResumenFC(
  signedRfceXml: string,
  token: string,
  config: Pick<DgiiClientConfig, 'env'>,
): Promise<DgiiRecepcionFCResponse> {
  const { fc } = resolveEndpoints(config.env);
  const url = `${fc}/api/recepcion/ecf`;

  debugLog(`POST ${url}`);
  debugLog(`Authorization: Bearer ${token.slice(0, 20)}...`);
  debugLog(`Body: multipart/form-data  campo=xml  filename=rfce.xml  size=${signedRfceXml.length} chars`);

  const encfMatch = signedRfceXml.match(/<eNCF>([^<]+)<\/eNCF>/);
  const rncMatch  = signedRfceXml.match(/<RNCEmisor>([^<]+)<\/RNCEmisor>/);
  const rfceFilename = (rncMatch?.[1] ?? '') + (encfMatch?.[1] ?? '') + '.xml' || 'rfce.xml';

  const form = new FormData();
  form.append('xml', new Blob([signedRfceXml], { type: 'application/xml' }), rfceFilename);

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const responseBody = await res.text();

  debugLog(`HTTP ${res.status} ${res.statusText}`);
  debugLog(`Response body: ${responseBody}`);

  if (!res.ok) {
    console.error(`   [HTTP ${res.status}] POST ${url}`);
    console.error(`   Response: ${responseBody || '(vacío)'}`);
    throw new DgiiApiError('Error al enviar resumen FC', res.status, responseBody);
  }

  try {
    return JSON.parse(responseBody) as DgiiRecepcionFCResponse;
  } catch {
    throw new DgiiApiError('Respuesta FC con formato inesperado', undefined, responseBody);
  }
}
