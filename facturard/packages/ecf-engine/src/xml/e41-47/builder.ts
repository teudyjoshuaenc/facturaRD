import { ItemCalculado, Totales, ITBIS_PCT } from '../types';
import type {
  ECF41Input,
  ECF43Input,
  ECF44Input,
  ECF45Input,
  ECF46Input,
  ECF47Input,
  InformacionReferenciaOpcional,
} from './types';

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

function buildEmisor(emisor: ECF41Input['emisor']): string {
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

function buildTotales(t: Totales): string {
  const lines: string[] = [
    t.montoGravadoTotal > 0 ? `      <MontoGravadoTotal>${d(t.montoGravadoTotal)}</MontoGravadoTotal>\n` : '',
    t.montoGravadoI1    > 0 ? `      <MontoGravadoI1>${d(t.montoGravadoI1)}</MontoGravadoI1>\n`         : '',
    t.montoGravadoI2    > 0 ? `      <MontoGravadoI2>${d(t.montoGravadoI2)}</MontoGravadoI2>\n`         : '',
    t.montoGravadoI3    > 0 ? `      <MontoGravadoI3>${d(t.montoGravadoI3)}</MontoGravadoI3>\n`         : '',
    t.montoExento       > 0 ? `      <MontoExento>${d(t.montoExento)}</MontoExento>\n`                   : '',
    t.totalITBIS1       > 0 ? `      <ITBIS1>${ITBIS_PCT[1]}</ITBIS1>\n`                                : '',
    t.totalITBIS2       > 0 ? `      <ITBIS2>${ITBIS_PCT[2]}</ITBIS2>\n`                                : '',
    t.montoGravadoI3    > 0 ? `      <ITBIS3>${ITBIS_PCT[3]}</ITBIS3>\n`                                : '',
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

function buildReferencia(ref: InformacionReferenciaOpcional): string {
  return (
    `  <InformacionReferencia>\n` +
    `    <NCFModificado>${ref.ncfModificado}</NCFModificado>\n` +
    (ref.rncOtroContribuyente
      ? `    <RNCOtroContribuyente>${ref.rncOtroContribuyente}</RNCOtroContribuyente>\n`
      : '') +
    `    <FechaNCFModificado>${ref.fechaNCFModificado}</FechaNCFModificado>\n` +
    `    <CodigoModificacion>${ref.codigoModificacion}</CodigoModificacion>\n` +
    (ref.razonModificacion
      ? `    <RazonModificacion>${ref.razonModificacion}</RazonModificacion>\n`
      : '') +
    `  </InformacionReferencia>\n`
  );
}

// ── E41 — Comprobante de Compras ──────────────────────────────────────────────

export function buildECF41Xml(
  input: ECF41Input,
  items: ItemCalculado[],
  totales: Totales,
): string {
  const { idDoc, emisor, comprador } = input;

  const idDocXml =
    `    <IdDoc>\n` +
    `      <TipoeCF>41</TipoeCF>\n` +
    `      <eNCF>${idDoc.eNCF}</eNCF>\n` +
    `      <FechaVencimientoSecuencia>${idDoc.fechaVencimientoSecuencia}</FechaVencimientoSecuencia>\n` +
    `      <TipoPago>${idDoc.tipoPago ?? 1}</TipoPago>\n` +
    opt('FechaLimitePago', idDoc.fechaLimitePago) +
    `    </IdDoc>\n`;

  const compradorXml =
    `    <Comprador>\n` +
    `      <RNCComprador>${comprador.rnc}</RNCComprador>\n` +
    `      <RazonSocialComprador>${comprador.razonSocial}</RazonSocialComprador>\n` +
    opt('ContactoComprador', comprador.contacto) +
    opt('CorreoComprador', comprador.correo) +
    opt('DireccionComprador', comprador.direccion) +
    opt('MunicipioComprador', comprador.municipio) +
    opt('ProvinciaComprador', comprador.provincia) +
    `    </Comprador>\n`;

  const referencia = input.referencia ? buildReferencia(input.referencia) : '';
  const fechaHoraFirma = idDoc.fechaHoraFirma ?? nowFechaHoraFirma();

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<ECF>\n` +
    `  <Encabezado>\n` +
    `    <Version>1.0</Version>\n` +
    idDocXml +
    buildEmisor(emisor) +
    compradorXml +
    buildTotales(totales) +
    `  </Encabezado>\n` +
    buildItems(items) +
    referencia +
    `  <FechaHoraFirma>${fechaHoraFirma}</FechaHoraFirma>\n` +
    `</ECF>`
  );
}

// ── E43 — Gastos Menores ──────────────────────────────────────────────────────

export function buildECF43Xml(
  input: ECF43Input,
  items: ItemCalculado[],
  totales: Totales,
): string {
  const { idDoc, emisor } = input;

  const idDocXml =
    `    <IdDoc>\n` +
    `      <TipoeCF>43</TipoeCF>\n` +
    `      <eNCF>${idDoc.eNCF}</eNCF>\n` +
    `      <FechaVencimientoSecuencia>${idDoc.fechaVencimientoSecuencia}</FechaVencimientoSecuencia>\n` +
    (idDoc.tipoPago !== undefined ? `      <TipoPago>${idDoc.tipoPago}</TipoPago>\n` : '') +
    `    </IdDoc>\n`;

  const referencia = input.referencia ? buildReferencia(input.referencia) : '';
  const fechaHoraFirma = idDoc.fechaHoraFirma ?? nowFechaHoraFirma();

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<ECF>\n` +
    `  <Encabezado>\n` +
    `    <Version>1.0</Version>\n` +
    idDocXml +
    buildEmisor(emisor) +
    buildTotales(totales) +
    `  </Encabezado>\n` +
    buildItems(items) +
    referencia +
    `  <FechaHoraFirma>${fechaHoraFirma}</FechaHoraFirma>\n` +
    `</ECF>`
  );
}

// ── E44 — Regímenes Especiales ────────────────────────────────────────────────

export function buildECF44Xml(
  input: ECF44Input,
  items: ItemCalculado[],
  totales: Totales,
): string {
  const { idDoc, emisor, comprador } = input;

  const idDocXml =
    `    <IdDoc>\n` +
    `      <TipoeCF>44</TipoeCF>\n` +
    `      <eNCF>${idDoc.eNCF}</eNCF>\n` +
    `      <FechaVencimientoSecuencia>${idDoc.fechaVencimientoSecuencia}</FechaVencimientoSecuencia>\n` +
    `      <TipoIngresos>${idDoc.tipoIngresos ?? '01'}</TipoIngresos>\n` +
    `      <TipoPago>${idDoc.tipoPago ?? 1}</TipoPago>\n` +
    opt('FechaLimitePago', idDoc.fechaLimitePago) +
    `    </IdDoc>\n`;

  const compradorXml =
    `    <Comprador>\n` +
    opt('RNCComprador', comprador.rnc) +
    `      <RazonSocialComprador>${comprador.razonSocial}</RazonSocialComprador>\n` +
    opt('ContactoComprador', comprador.contacto) +
    opt('CorreoComprador', comprador.correo) +
    opt('DireccionComprador', comprador.direccion) +
    opt('MunicipioComprador', comprador.municipio) +
    opt('ProvinciaComprador', comprador.provincia) +
    `    </Comprador>\n`;

  const referencia = input.referencia ? buildReferencia(input.referencia) : '';
  const fechaHoraFirma = idDoc.fechaHoraFirma ?? nowFechaHoraFirma();

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<ECF>\n` +
    `  <Encabezado>\n` +
    `    <Version>1.0</Version>\n` +
    idDocXml +
    buildEmisor(emisor) +
    compradorXml +
    buildTotales(totales) +
    `  </Encabezado>\n` +
    buildItems(items) +
    referencia +
    `  <FechaHoraFirma>${fechaHoraFirma}</FechaHoraFirma>\n` +
    `</ECF>`
  );
}

// ── E45 — Gubernamental ───────────────────────────────────────────────────────

export function buildECF45Xml(
  input: ECF45Input,
  items: ItemCalculado[],
  totales: Totales,
): string {
  const { idDoc, emisor, comprador } = input;

  const idDocXml =
    `    <IdDoc>\n` +
    `      <TipoeCF>45</TipoeCF>\n` +
    `      <eNCF>${idDoc.eNCF}</eNCF>\n` +
    `      <FechaVencimientoSecuencia>${idDoc.fechaVencimientoSecuencia}</FechaVencimientoSecuencia>\n` +
    `      <TipoIngresos>${idDoc.tipoIngresos ?? '01'}</TipoIngresos>\n` +
    `      <TipoPago>${idDoc.tipoPago ?? 1}</TipoPago>\n` +
    opt('FechaLimitePago', idDoc.fechaLimitePago) +
    `    </IdDoc>\n`;

  const compradorXml =
    `    <Comprador>\n` +
    `      <RNCComprador>${comprador.rnc}</RNCComprador>\n` +
    `      <RazonSocialComprador>${comprador.razonSocial}</RazonSocialComprador>\n` +
    opt('ContactoComprador', comprador.contacto) +
    opt('CorreoComprador', comprador.correo) +
    opt('DireccionComprador', comprador.direccion) +
    opt('MunicipioComprador', comprador.municipio) +
    opt('ProvinciaComprador', comprador.provincia) +
    `    </Comprador>\n`;

  const referencia = input.referencia ? buildReferencia(input.referencia) : '';
  const fechaHoraFirma = idDoc.fechaHoraFirma ?? nowFechaHoraFirma();

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<ECF>\n` +
    `  <Encabezado>\n` +
    `    <Version>1.0</Version>\n` +
    idDocXml +
    buildEmisor(emisor) +
    compradorXml +
    buildTotales(totales) +
    `  </Encabezado>\n` +
    buildItems(items) +
    referencia +
    `  <FechaHoraFirma>${fechaHoraFirma}</FechaHoraFirma>\n` +
    `</ECF>`
  );
}

// ── E46 — Exportaciones ───────────────────────────────────────────────────────

export function buildECF46Xml(
  input: ECF46Input,
  items: ItemCalculado[],
  totales: Totales,
): string {
  const { idDoc, emisor, comprador } = input;

  const idDocXml =
    `    <IdDoc>\n` +
    `      <TipoeCF>46</TipoeCF>\n` +
    `      <eNCF>${idDoc.eNCF}</eNCF>\n` +
    `      <FechaVencimientoSecuencia>${idDoc.fechaVencimientoSecuencia}</FechaVencimientoSecuencia>\n` +
    `      <TipoIngresos>${idDoc.tipoIngresos ?? '01'}</TipoIngresos>\n` +
    `      <TipoPago>${idDoc.tipoPago ?? 1}</TipoPago>\n` +
    opt('FechaLimitePago', idDoc.fechaLimitePago) +
    `    </IdDoc>\n`;

  const compradorXml =
    `    <Comprador>\n` +
    opt('RNCComprador', comprador.rnc) +
    opt('IdentificadorExtranjero', comprador.identificadorExtranjero) +
    `      <RazonSocialComprador>${comprador.razonSocial}</RazonSocialComprador>\n` +
    opt('ContactoComprador', comprador.contacto) +
    opt('CorreoComprador', comprador.correo) +
    opt('DireccionComprador', comprador.direccion) +
    opt('MunicipioComprador', comprador.municipio) +
    opt('ProvinciaComprador', comprador.provincia) +
    opt('PaisComprador', comprador.paisComprador) +
    `    </Comprador>\n`;

  const referencia = input.referencia ? buildReferencia(input.referencia) : '';
  const fechaHoraFirma = idDoc.fechaHoraFirma ?? nowFechaHoraFirma();

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<ECF>\n` +
    `  <Encabezado>\n` +
    `    <Version>1.0</Version>\n` +
    idDocXml +
    buildEmisor(emisor) +
    compradorXml +
    buildTotales(totales) +
    `  </Encabezado>\n` +
    buildItems(items) +
    referencia +
    `  <FechaHoraFirma>${fechaHoraFirma}</FechaHoraFirma>\n` +
    `</ECF>`
  );
}

// ── E47 — Pagos al Exterior ───────────────────────────────────────────────────

export function buildECF47Xml(
  input: ECF47Input,
  items: ItemCalculado[],
  totales: Totales,
): string {
  const { idDoc, emisor, beneficiario } = input;

  const idDocXml =
    `    <IdDoc>\n` +
    `      <TipoeCF>47</TipoeCF>\n` +
    `      <eNCF>${idDoc.eNCF}</eNCF>\n` +
    `      <FechaVencimientoSecuencia>${idDoc.fechaVencimientoSecuencia}</FechaVencimientoSecuencia>\n` +
    (idDoc.tipoPago !== undefined ? `      <TipoPago>${idDoc.tipoPago}</TipoPago>\n` : '') +
    `    </IdDoc>\n`;

  const compradorXml =
    `    <Comprador>\n` +
    opt('IdentificadorExtranjero', beneficiario.identificadorExtranjero) +
    opt('RazonSocialComprador', beneficiario.razonSocial) +
    `      <PaisComprador>${beneficiario.paisComprador}</PaisComprador>\n` +
    `    </Comprador>\n`;

  const referencia = input.referencia ? buildReferencia(input.referencia) : '';
  const fechaHoraFirma = idDoc.fechaHoraFirma ?? nowFechaHoraFirma();

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<ECF>\n` +
    `  <Encabezado>\n` +
    `    <Version>1.0</Version>\n` +
    idDocXml +
    buildEmisor(emisor) +
    compradorXml +
    buildTotales(totales) +
    `  </Encabezado>\n` +
    buildItems(items) +
    referencia +
    `  <FechaHoraFirma>${fechaHoraFirma}</FechaHoraFirma>\n` +
    `</ECF>`
  );
}
