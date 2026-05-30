import { ItemCalculado, Totales, ITBIS_PCT } from '../types';
import type { ECF32Input, ReferenciaRFCE } from './types';

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

function buildIdDoc32(input: ECF32Input): string {
  const { idDoc } = input;
  const lines: string[] = [
    `      <TipoeCF>32</TipoeCF>\n`,
    `      <eNCF>${idDoc.eNCF}</eNCF>\n`,
    idDoc.indicadorMontoGravado !== undefined
      ? `      <IndicadorMontoGravado>${idDoc.indicadorMontoGravado}</IndicadorMontoGravado>\n`
      : '',
    idDoc.indicadorServicioTodoIncluido
      ? `      <IndicadorServicioTodoIncluido>1</IndicadorServicioTodoIncluido>\n`
      : '',
    `      <TipoIngresos>${idDoc.tipoIngresos ?? '01'}</TipoIngresos>\n`,
    `      <TipoPago>${idDoc.tipoPago ?? 1}</TipoPago>\n`,
    opt('FechaLimitePago', idDoc.fechaLimitePago),
  ];
  return `    <IdDoc>\n${lines.join('')}    </IdDoc>\n`;
}

function buildEmisor32(input: ECF32Input): string {
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

function buildCompradorConsumo(input: ECF32Input): string {
  const c = input.comprador;
  if (!c) return `    <Comprador>\n    </Comprador>\n`;

  const lines: string[] = [
    opt('RNCComprador', c.rnc),
    opt('IdentificadorExtranjero', c.identificadorExtranjero),
    opt('RazonSocialComprador', c.razonSocial),
    opt('ContactoComprador', c.contacto),
    opt('CorreoComprador', c.correo),
    opt('DireccionComprador', c.direccion),
    opt('MunicipioComprador', c.municipio),
    opt('ProvinciaComprador', c.provincia),
  ];

  const content = lines.join('');
  if (!content.trim()) return `    <Comprador>\n    </Comprador>\n`;
  return `    <Comprador>\n${content}    </Comprador>\n`;
}

function buildTotales32(t: Totales): string {
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

function buildItems32(items: ItemCalculado[]): string {
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

function buildInformacionReferencia(rfce: ReferenciaRFCE): string {
  return (
    `  <InformacionReferencia>\n` +
    `      <NCFModificado>${rfce.eNCF}</NCFModificado>\n` +
    (rfce.rnc ? `      <RNCOtroContribuyente>${rfce.rnc}</RNCOtroContribuyente>\n` : '') +
    `      <FechaNCFModificado>${rfce.fecha}</FechaNCFModificado>\n` +
    `      <CodigoModificacion>5</CodigoModificacion>\n` +
    `  </InformacionReferencia>\n`
  );
}

export function buildECF32Xml(
  input: ECF32Input,
  items: ItemCalculado[],
  totales: Totales,
): string {
  const encabezado =
    `  <Encabezado>\n` +
    `    <Version>1.0</Version>\n` +
    buildIdDoc32(input) +
    buildEmisor32(input) +
    buildCompradorConsumo(input) +
    buildTotales32(totales) +
    `  </Encabezado>\n`;

  const referencia = input.rfce ? buildInformacionReferencia(input.rfce) : '';
  const fechaHoraFirma = input.idDoc.fechaHoraFirma ?? nowFechaHoraFirma();

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<ECF>\n` +
    encabezado +
    buildItems32(items) +
    referencia +
    `  <FechaHoraFirma>${fechaHoraFirma}</FechaHoraFirma>\n` +
    `</ECF>`
  );
}
