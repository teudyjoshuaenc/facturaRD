import {
  resolveEndpoints,
  DgiiApiError,
  type DgiiClientConfig,
  type DgiiAprobacionInput,
  type DgiiAprobacionResponse,
} from './types';

/**
 * Envía una Aprobación Comercial firmada a la DGII.
 *
 * Endpoint: POST {aprobacion}/api/AprobacionComercial
 * Estructura XML: <ACECF><DetalleAprobacionComercial>...</DetalleAprobacionComercial></ACECF>
 *
 * El receptor (RNCComprador) indica si acepta o rechaza cada e-CF recibido.
 * La FechaHoraAprobacionComercial debe coincidir exactamente con el valor
 * del dataset de pruebas entregado por la DGII.
 */
export async function enviarAprobacionComercial(
  signedXml: string,
  token: string,
  config: Pick<DgiiClientConfig, 'env'>,
): Promise<DgiiAprobacionResponse> {
  const { aprobacion } = resolveEndpoints(config.env);
  const url = `${aprobacion}/api/AprobacionComercial`;

  const encfMatch = signedXml.match(/<eNCF>([^<]+)<\/eNCF>/);
  const rncMatch  = signedXml.match(/<RNCComprador>([^<]+)<\/RNCComprador>/);
  const filename  = (rncMatch?.[1] ?? '') + (encfMatch?.[1] ?? '') + '.xml' || 'aprobacion.xml';

  const form = new FormData();
  form.append('xml', new Blob([signedXml], { type: 'application/xml' }), filename);

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const responseBody = await res.text();

  if (!res.ok) {
    console.error(`   [HTTP ${res.status}] POST ${url}`);
    console.error(`   Response: ${responseBody || '(vacío)'}`);
    throw new DgiiApiError('Error al enviar aprobación comercial', res.status, responseBody);
  }

  try {
    return JSON.parse(responseBody) as DgiiAprobacionResponse;
  } catch {
    throw new DgiiApiError('Respuesta de aprobación con formato inesperado', undefined, responseBody);
  }
}

/**
 * Construye el XML <ACECF> para una Aprobación Comercial.
 * No incluye firma — usar signXml() con referenceXPath="//*[local-name(.)='ACECF']".
 */
export function buildAprobacionXml(input: DgiiAprobacionInput): string {
  const monto = input.montoTotal.toFixed(2);
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<ACECF>\n` +
    `  <DetalleAprobacionComercial>\n` +
    `    <Version>1.0</Version>\n` +
    `    <RNCEmisor>${input.rncEmisor}</RNCEmisor>\n` +
    `    <eNCF>${input.eNCF}</eNCF>\n` +
    `    <FechaEmision>${input.fechaEmision}</FechaEmision>\n` +
    `    <MontoTotal>${monto}</MontoTotal>\n` +
    `    <RNCComprador>${input.rncComprador}</RNCComprador>\n` +
    `    <Estado>${input.estado}</Estado>\n` +
    (input.detalleMotivoRechazo
      ? `    <DetalleMotivoRechazo>${input.detalleMotivoRechazo}</DetalleMotivoRechazo>\n`
      : '') +
    `    <FechaHoraAprobacionComercial>${input.fechaHoraAprobacionComercial}</FechaHoraAprobacionComercial>\n` +
    `  </DetalleAprobacionComercial>\n` +
    `</ACECF>`
  );
}
