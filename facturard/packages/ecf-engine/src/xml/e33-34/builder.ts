import { ItemCalculado, Totales, ITBIS_PCT } from '../types';
import type { ECF33Input, ECF34Input, InformacionReferencia } from './types';

function d(n: number): string {
  return n.toFixed(2);
}

function opt(tag: string, value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '' || value === 0) return '';
  return `      <${tag}>${value}</${tag}>\n`;
}

function nowFechaHoraFirma(): string {
  const now = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${p(now.getDate())}-${p(now.getMonth() + 1)}-${now.getFullYear()} ` +
    `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`
  );
}

function buildEmisor(input: ECF33Input | ECF34Input): string {
  const { emisor } = input;
  const lines: string[] = [
    `      <RNCEmisor>${emisor.rnc}</RNCEmisor>\n`,
    `      <RazonSocialEmisor>${emisor.razonSocial}</RazonSocialEmisor>\n`,
    opt('NombreComercial', emisor.nombreComercial),
    opt('Sucursal', emisor.sucursal),
    `      <DireccionEmisor>${emisor.direccion}</DireccionEmisor>\n`,
    opt('Municipio', emisor.municipio),
    opt('Provincia', emisor.provincia),
    emisor.telefono
      ? `      <TablaTelefonoEmisor>\n        <TelefonoEmisor>${emisor.telefono}</TelefonoEmisor>\n      </TablaTelefonoEmisor>\n`
      : '',
    opt('CorreoEmisor', emisor.correo),
    opt('ActividadEconomica', emisor.actividadEconomica),
    `      <FechaEmision>${emisor.fechaEmision}</FechaEmision>\n`,
  ];
  return `    <Emisor>\n${lines.join('')}    </Emisor>\n`;
}

function buildComprador(input: ECF33Input | ECF34Input): string {
  const { comprador } = input;
  const lines: string[] = [
    `      <RNCComprador>${comprador.rnc}</RNCComprador>\n`,
    `      <RazonSocialComprador>${comprador.razonSocial}</RazonSocialComprador>\n`,
    opt('ContactoComprador', comprador.contacto),
    opt('CorreoComprador', comprador.correo),
    opt('DireccionComprador', comprador.direccion),
    opt('MunicipioComprador', comprador.municipio),
    opt('ProvinciaComprador', comprador.provincia),
  ];
  return `    <Comprador>\n${lines.join('')}    </Comprador>\n`;
}

function buildTotales(t: Totales): string {
  const lines: string[] = [
    t.montoGravadoTotal > 0 ? `      <MontoGravadoTotal>${d(t.montoGravadoTotal)}</MontoGravadoTotal>\n` : '',
    t.montoGravadoI1    > 0 ? `      <MontoGravadoI1>${d(t.montoGravadoI1)}</MontoGravadoI1>\n`         : '',
    t.montoGravadoI2    > 0 ? `      <MontoGravadoI2>${d(t.montoGravadoI2)}</MontoGravadoI2>\n`         : '',
    t.montoGravadoI3    > 0 ? `      <MontoGravadoI3>${d(t.montoGravadoI3)}</MontoGravadoI3>\n`         : '',
    t.montoExento       > 0 ? `      <MontoExento>${d(t.montoExento)}</MontoExento>\n`                   : '',
    t.totalITBIS1       > 0 ? `      <ITBIS1>${ITBIS_PCT[1]}</ITBIS1>\n`                                : '',
    t.totalITBIS2       > 0 ? `      <ITBIS2>${ITBIS_PCT[2]}</ITBIS2>\n`                                : '',
    t.totalITBIS        > 0 ? `      <TotalITBIS>${d(t.totalITBIS)}</TotalITBIS>\n`                     : '',
    t.totalITBIS1       > 0 ? `      <TotalITBIS1>${d(t.totalITBIS1)}</TotalITBIS1>\n`                  : '',
    t.totalITBIS2       > 0 ? `      <TotalITBIS2>${d(t.totalITBIS2)}</TotalITBIS2>\n`                  : '',
    `      <MontoTotal>${d(t.montoTotal)}</MontoTotal>\n`,
  ];
  return `    <Totales>\n${lines.join('')}    </Totales>\n`;
}

function buildItems(items: ItemCalculado[]): string {
  const itemsXml = items.map(it => {
    const lines: string[] = [
      `      <NumeroLinea>${it.numeroLinea}</NumeroLinea>\n`,
      `      <IndicadorFacturacion>${it.indicadorFacturacion}</IndicadorFacturacion>\n`,
      `      <NombreItem>${it.nombre}</NombreItem>\n`,
      `      <IndicadorBienoServicio>${it.indicadorBienoServicio}</IndicadorBienoServicio>\n`,
      opt('DescripcionItem', it.descripcion),
      `      <CantidadItem>${it.cantidad}</CantidadItem>\n`,
      it.unidadMedida !== undefined ? `      <UnidadMedida>${it.unidadMedida}</UnidadMedida>\n` : '',
      `      <PrecioUnitarioItem>${d(it.precioUnitario)}</PrecioUnitarioItem>\n`,
      it.montoDescuento > 0 ? `      <DescuentoMonto>${d(it.montoDescuento)}</DescuentoMonto>\n` : '',
      `      <MontoItem>${d(it.montoItem)}</MontoItem>\n`,
    ];
    return `    <Item>\n${lines.join('')}    </Item>\n`;
  });
  return `  <DetallesItems>\n${itemsXml.join('')}  </DetallesItems>\n`;
}

function buildReferencia(ref: InformacionReferencia): string {
  return (
    `  <InformacionReferencia>\n` +
    `    <NCFModificado>${ref.ncfModificado}</NCFModificado>\n` +
    (ref.rncOtroContribuyente
      ? `    <RNCOtroContribuyente>${ref.rncOtroContribuyente}</RNCOtroContribuyente>\n`
      : '') +
    `    <FechaNCFModificado>${ref.fechaNCFModificado}</FechaNCFModificado>\n` +
    `    <CodigoModificacion>${ref.codigoModificacion}</CodigoModificacion>\n` +
    `  </InformacionReferencia>\n`
  );
}

// ── E33 builder ───────────────────────────────────────────────────────────────

function buildIdDoc33(input: ECF33Input): string {
  const { idDoc } = input;
  const lines: string[] = [
    `      <TipoeCF>33</TipoeCF>\n`,
    `      <eNCF>${idDoc.eNCF}</eNCF>\n`,
    idDoc.indicadorMontoGravado !== undefined
      ? `      <IndicadorMontoGravado>${idDoc.indicadorMontoGravado}</IndicadorMontoGravado>\n`
      : '',
    `      <TipoIngresos>${idDoc.tipoIngresos ?? '01'}</TipoIngresos>\n`,
    `      <TipoPago>${idDoc.tipoPago ?? 1}</TipoPago>\n`,
    opt('FechaLimitePago', idDoc.fechaLimitePago),
  ];
  return `    <IdDoc>\n${lines.join('')}    </IdDoc>\n`;
}

export function buildECF33Xml(
  input: ECF33Input,
  items: ItemCalculado[],
  totales: Totales,
): string {
  const encabezado =
    `  <Encabezado>\n` +
    `    <Version>1.0</Version>\n` +
    buildIdDoc33(input) +
    buildEmisor(input) +
    buildComprador(input) +
    buildTotales(totales) +
    `  </Encabezado>\n`;

  const fechaHoraFirma = input.idDoc.fechaHoraFirma ?? nowFechaHoraFirma();

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<ECF>\n` +
    encabezado +
    buildItems(items) +
    buildReferencia(input.referencia) +
    `  <FechaHoraFirma>${fechaHoraFirma}</FechaHoraFirma>\n` +
    `</ECF>`
  );
}

// ── E34 builder ───────────────────────────────────────────────────────────────

function buildIdDoc34(input: ECF34Input): string {
  const { idDoc } = input;
  const lines: string[] = [
    `      <TipoeCF>34</TipoeCF>\n`,
    `      <eNCF>${idDoc.eNCF}</eNCF>\n`,
    idDoc.indicadorNotaCredito !== undefined
      ? `      <IndicadorNotaCredito>${idDoc.indicadorNotaCredito}</IndicadorNotaCredito>\n`
      : '',
    idDoc.indicadorMontoGravado !== undefined
      ? `      <IndicadorMontoGravado>${idDoc.indicadorMontoGravado}</IndicadorMontoGravado>\n`
      : '',
    `      <TipoIngresos>${idDoc.tipoIngresos ?? '01'}</TipoIngresos>\n`,
    `      <TipoPago>${idDoc.tipoPago ?? 1}</TipoPago>\n`,
    opt('FechaLimitePago', idDoc.fechaLimitePago),
  ];
  return `    <IdDoc>\n${lines.join('')}    </IdDoc>\n`;
}

export function buildECF34Xml(
  input: ECF34Input,
  items: ItemCalculado[],
  totales: Totales,
): string {
  const encabezado =
    `  <Encabezado>\n` +
    `    <Version>1.0</Version>\n` +
    buildIdDoc34(input) +
    buildEmisor(input) +
    buildComprador(input) +
    buildTotales(totales) +
    `  </Encabezado>\n`;

  const fechaHoraFirma = input.idDoc.fechaHoraFirma ?? nowFechaHoraFirma();

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<ECF>\n` +
    encabezado +
    buildItems(items) +
    buildReferencia(input.referencia) +
    `  <FechaHoraFirma>${fechaHoraFirma}</FechaHoraFirma>\n` +
    `</ECF>`
  );
}
