import { ECF31Input, ItemCalculado, Totales, ITBIS_PCT } from './types';

function d(n: number): string {
  return n.toFixed(2);
}

/** Retorna `<tag>value</tag>\n` sólo si value existe, es no-vacío y no es 0. */
function opt(tag: string, value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '' || value === 0) return '';
  return `      <${tag}>${value}</${tag}>\n`;
}

function buildIdDoc(input: ECF31Input): string {
  const { idDoc } = input;
  const lines: string[] = [
    `      <TipoeCF>31</TipoeCF>\n`,
    `      <eNCF>${idDoc.eNCF}</eNCF>\n`,
    `      <FechaVencimientoSecuencia>${idDoc.fechaVencimientoSecuencia}</FechaVencimientoSecuencia>\n`,
    idDoc.indicadorMontoGravado !== undefined
      ? `      <IndicadorMontoGravado>${idDoc.indicadorMontoGravado}</IndicadorMontoGravado>\n`
      : '',
    `      <TipoIngresos>${idDoc.tipoIngresos ?? '01'}</TipoIngresos>\n`,
    `      <TipoPago>${idDoc.tipoPago ?? 1}</TipoPago>\n`,
    opt('FechaLimitePago', idDoc.fechaLimitePago),
  ];
  return `    <IdDoc>\n${lines.join('')}    </IdDoc>\n`;
}

function buildEmisor(input: ECF31Input): string {
  const { emisor } = input;
  const lines: string[] = [
    `      <RNCEmisor>${emisor.rnc}</RNCEmisor>\n`,
    `      <RazonSocialEmisor>${emisor.razonSocial}</RazonSocialEmisor>\n`,
    opt('NombreComercial', emisor.nombreComercial),
    opt('Sucursal', emisor.sucursal),
    `      <DireccionEmisor>${emisor.direccion}</DireccionEmisor>\n`,
    opt('Municipio', emisor.municipio),
    opt('Provincia', emisor.provincia),
    // TelefonoEmisor va dentro de TablaTelefonoEmisor (puede haber hasta 3)
    emisor.telefono
      ? `      <TablaTelefonoEmisor>\n        <TelefonoEmisor>${emisor.telefono}</TelefonoEmisor>\n      </TablaTelefonoEmisor>\n`
      : '',
    opt('CorreoEmisor', emisor.correo),
    opt('ActividadEconomica', emisor.actividadEconomica),
    `      <FechaEmision>${emisor.fechaEmision}</FechaEmision>\n`,
  ];
  return `    <Emisor>\n${lines.join('')}    </Emisor>\n`;
}

function buildComprador(input: ECF31Input): string {
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
    // MontoGravadoTotal se emite cuando hay cualquier monto gravado
    t.montoGravadoTotal > 0 ? `      <MontoGravadoTotal>${d(t.montoGravadoTotal)}</MontoGravadoTotal>\n` : '',
    t.montoGravadoI1    > 0 ? `      <MontoGravadoI1>${d(t.montoGravadoI1)}</MontoGravadoI1>\n`         : '',
    t.montoGravadoI2    > 0 ? `      <MontoGravadoI2>${d(t.montoGravadoI2)}</MontoGravadoI2>\n`         : '',
    t.montoGravadoI3    > 0 ? `      <MontoGravadoI3>${d(t.montoGravadoI3)}</MontoGravadoI3>\n`         : '',
    t.montoExento       > 0 ? `      <MontoExento>${d(t.montoExento)}</MontoExento>\n`                   : '',
    // ITBIS1/2/3: entero que representa el porcentaje de la tasa (18, 16, 0)
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
      // UnidadMedida es entero (código DGII); se omite si no se proporcionó
      it.unidadMedida !== undefined ? `      <UnidadMedida>${it.unidadMedida}</UnidadMedida>\n` : '',
      // Orden oficial: PrecioUnitarioItem → DescuentoMonto → MontoItem
      `      <PrecioUnitarioItem>${d(it.precioUnitario)}</PrecioUnitarioItem>\n`,
      it.montoDescuento > 0 ? `      <DescuentoMonto>${d(it.montoDescuento)}</DescuentoMonto>\n` : '',
      `      <MontoItem>${d(it.montoItem)}</MontoItem>\n`,
    ];
    return `    <Item>\n${lines.join('')}    </Item>\n`;
  });

  return `  <DetallesItems>\n${itemsXml.join('')}  </DetallesItems>\n`;
}

function nowFechaHoraFirma(): string {
  const now = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${p(now.getDate())}-${p(now.getMonth() + 1)}-${now.getFullYear()} ` +
    `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`
  );
}

export function buildECF31Xml(
  input: ECF31Input,
  items: ItemCalculado[],
  totales: Totales,
): string {
  // El XSD oficial no tiene targetNamespace → el XML no lleva xmlns
  const encabezado =
    `  <Encabezado>\n` +
    `    <Version>1.0</Version>\n` +
    buildIdDoc(input) +
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
    // FechaHoraFirma es requerido por el XSD; xs:any es satisfecho por <Signature> al firmar
    `  <FechaHoraFirma>${fechaHoraFirma}</FechaHoraFirma>\n` +
    `</ECF>`
  );
}
