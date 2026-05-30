import { Totales } from '../types';
import type { ECF32Input } from './types';

function d(n: number): string {
  return n.toFixed(2);
}

/**
 * Construye el XML del RFCE-32 (Resumen de Factura de Consumo Electrónica).
 * Contiene únicamente la cabecera y los totales — sin líneas de detalle.
 * Debe firmarse y enviarse a la DGII ANTES del e-CF 32 completo.
 *
 * Estructura según XSD oficial DGII RFCE 32 v1.0:
 * Encabezado > Version, IdDoc, Emisor, Comprador, Totales, CodigoSeguridadeCF
 */
export function buildRFCE32Xml(input: ECF32Input, totales: Totales): string {
  const { idDoc, emisor, comprador } = input;
  const codigoSeguridad = (input.codigoSeguridadeCF ?? '000000').slice(0, 6).padEnd(6, '0');

  const idDocXml =
    `    <IdDoc>\n` +
    `      <TipoeCF>32</TipoeCF>\n` +
    `      <eNCF>${idDoc.eNCF}</eNCF>\n` +
    `      <TipoIngresos>${idDoc.tipoIngresos ?? '01'}</TipoIngresos>\n` +
    `      <TipoPago>${idDoc.tipoPago ?? 1}</TipoPago>\n` +
    (idDoc.fechaLimitePago ? `      <FechaLimitePago>${idDoc.fechaLimitePago}</FechaLimitePago>\n` : '') +
    `    </IdDoc>\n`;

  const emisorXml =
    `    <Emisor>\n` +
    `      <RNCEmisor>${emisor.rnc}</RNCEmisor>\n` +
    `      <RazonSocialEmisor>${emisor.razonSocial}</RazonSocialEmisor>\n` +
    `      <FechaEmision>${emisor.fechaEmision}</FechaEmision>\n` +
    `    </Emisor>\n`;

  const compradorXml =
    `    <Comprador>\n` +
    (comprador?.rnc ? `      <RNCComprador>${comprador.rnc}</RNCComprador>\n` : '') +
    (comprador?.identificadorExtranjero ? `      <IdentificadorExtranjero>${comprador.identificadorExtranjero}</IdentificadorExtranjero>\n` : '') +
    (comprador?.razonSocial ? `      <RazonSocialComprador>${comprador.razonSocial}</RazonSocialComprador>\n` : '') +
    `    </Comprador>\n`;

  const totalesLines: string[] = [
    totales.montoGravadoTotal > 0 ? `      <MontoGravadoTotal>${d(totales.montoGravadoTotal)}</MontoGravadoTotal>\n` : '',
    totales.montoGravadoI1    > 0 ? `      <MontoGravadoI1>${d(totales.montoGravadoI1)}</MontoGravadoI1>\n`         : '',
    totales.montoGravadoI2    > 0 ? `      <MontoGravadoI2>${d(totales.montoGravadoI2)}</MontoGravadoI2>\n`         : '',
    totales.montoGravadoI3    > 0 ? `      <MontoGravadoI3>${d(totales.montoGravadoI3)}</MontoGravadoI3>\n`         : '',
    totales.montoExento       > 0 ? `      <MontoExento>${d(totales.montoExento)}</MontoExento>\n`                   : '',
    totales.totalITBIS        > 0 ? `      <TotalITBIS>${d(totales.totalITBIS)}</TotalITBIS>\n`                     : '',
    totales.totalITBIS1       > 0 ? `      <TotalITBIS1>${d(totales.totalITBIS1)}</TotalITBIS1>\n`                  : '',
    totales.totalITBIS2       > 0 ? `      <TotalITBIS2>${d(totales.totalITBIS2)}</TotalITBIS2>\n`                  : '',
    totales.totalITBIS3       > 0 ? `      <TotalITBIS3>${d(totales.totalITBIS3)}</TotalITBIS3>\n`                  : '',
    `      <MontoTotal>${d(totales.montoTotal)}</MontoTotal>\n`,
  ];

  const totalesXml = `    <Totales>\n${totalesLines.join('')}    </Totales>\n`;

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<RFCE>\n` +
    `  <Encabezado>\n` +
    `    <Version>1.0</Version>\n` +
    idDocXml +
    emisorXml +
    compradorXml +
    totalesXml +
    `    <CodigoSeguridadeCF>${codigoSeguridad}</CodigoSeguridadeCF>\n` +
    `  </Encabezado>\n` +
    `</RFCE>`
  );
}
