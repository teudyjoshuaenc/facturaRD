import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { createWriteStream, mkdirSync, readFileSync } from 'fs';
import { dirname } from 'path';

export interface EcfItem {
  descripcion: string;
  cantidad: number;
  unidadMedida?: string;
  precioUnitario: number;
  itbis?: number;
  valor: number;
}

export type DgiiAmbiente = 'certecf' | 'ecf';

export interface EcfPdfInput {
  // Emisor
  rncEmisor: string;
  nombreEmisor: string;
  nombreComercial?: string;
  direccionEmisor?: string;
  telefonoEmisor?: string;

  // Identificación
  eNCF: string;
  tipoECF: string;
  fechaEmision: string;
  fechaVencimiento?: string;
  /** DD-MM-YYYY HH:MM:SS — se usa como fechafirma en la URL del QR */
  fechaHoraFirma?: string;
  /** Primeros 6 chars del SignatureValue del XML firmado */
  codigoSeguridad?: string;
  /** Ambiente DGII para la URL de verificación del timbre. Default: 'certecf' */
  ambiente?: DgiiAmbiente;

  // NCF Modificado (E33/E34)
  eNCFReferencia?: string;

  // Comprador
  rncComprador?: string;
  nombreComprador?: string;

  // Items
  items: EcfItem[];

  // Totales
  montoGravadoTotal?: number;
  itbisTotal?: number;
  montoExentoTotal?: number;
  montoTotal: number;

  // Branding por tenant (Sprint 6). Si faltan, se usan los defaults actuales.
  /** URL http(s) o ruta local del logo. Si falla la carga, se omite (nunca lanza). */
  logoUrl?: string;
  /** Color hex (#RRGGBB) para acentos: nombre, tipo y total. */
  colorPrimario?: string;
  /** Color hex (#RRGGBB) para el fondo de la cabecera de la tabla. */
  colorSecundario?: string;
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
const LOGO_TIMEOUT_MS = 5000;

/**
 * Carga el logo desde URL http(s) (fetch con timeout + tope de tamaño) o ruta
 * local. NUNCA lanza: ante cualquier error devuelve undefined y el PDF se genera
 * sin logo.
 */
async function loadLogo(src: string | undefined): Promise<Buffer | undefined> {
  if (!src) return undefined;
  try {
    if (/^https?:\/\//i.test(src)) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LOGO_TIMEOUT_MS);
      try {
        const res = await fetch(src, { signal: controller.signal });
        if (!res.ok) return undefined;
        const declared = res.headers.get('content-length');
        if (declared && Number(declared) > MAX_LOGO_BYTES) return undefined;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > MAX_LOGO_BYTES) return undefined;
        return buf;
      } finally {
        clearTimeout(timer);
      }
    }
    return readFileSync(src);
  } catch {
    return undefined;
  }
}

const TIPO_LABELS: Record<string, string> = {
  '31': 'Factura de Crédito Fiscal Electrónica',
  '32': 'Factura de Consumo Electrónica',
  '33': 'Nota de Débito Electrónica',
  '34': 'Nota de Crédito Electrónica',
  '41': 'Comprobante de Compras',
  '43': 'Comprobante de Gastos Menores',
  '44': 'Comprobante de Regímenes Especiales',
  '45': 'Comprobante Gubernamental',
  '46': 'Comprobante de Exportaciones',
  '47': 'Comprobante de Pagos al Exterior',
};

const GRAY_HEADER = '#e8e8e8';
const GRAY_ROW    = '#f5f5f5';
const TEXT        = '#111111';
const MUTED       = '#555555';
const BORDER      = '#cccccc';

const UM_MAP: Record<string, string> = {
  '55': 'UND', '23': 'UND',
  'UND': 'UND', 'CAJ': 'CAJ', 'PZA': 'PZA', 'PAQ': 'PAQ',
};

function umLabel(code: string | undefined): string {
  if (!code) return '';
  return UM_MAP[code.trim().toUpperCase()] ?? code;
}

function fmt(n: number): string {
  return n.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function tipoLabel(tipoECF: string): string {
  const code = tipoECF.replace(/^[Ee]/, '');
  return TIPO_LABELS[code] ?? tipoECF;
}

/**
 * Construye la URL del timbre fiscal electrónico según el formato oficial DGII.
 *
 * - Tipos 31, 33, 34, 41, 43-47 → ecf.dgii.gov.do/consultatimbre
 * - Tipo 32 < RD$250,000       → fc.dgii.gov.do/consultatimbrefc
 * - Tipo 32 ≥ RD$250,000       → ecf.dgii.gov.do/consultatimbre (igual que E31)
 */
export function buildQrUrl(ecf: EcfPdfInput): string {
  const ambiente = ecf.ambiente ?? 'certecf';
  const tipoCode = ecf.tipoECF.replace(/^[Ee]/, '');
  const isRfce = tipoCode === '32' && ecf.montoTotal < 250_000;

  const base = isRfce
    ? `https://fc.dgii.gov.do/${ambiente}/consultatimbrefc`
    : `https://ecf.dgii.gov.do/${ambiente}/consultatimbre`;

  // URLSearchParams encodes spaces as '+'; DGII spec requires %20 — replace manually
  const params: [string, string][] = [
    ['rncemisor', ecf.rncEmisor],
  ];

  if (!isRfce) {
    params.push(['rnccomprador', ecf.rncComprador ?? '']);
  }

  params.push(
    // El e-NCF DEBE ir en MAYÚSCULAS: el consultatimbre de la DGII hace match
    // exacto y case-sensitive sobre este valor (verificado en producción con
    // E310000000011 — en minúscula responde "No fue encontrada la factura").
    ['encf', ecf.eNCF],
    ['fechaemision', ecf.fechaEmision],
    ['montototal', ecf.montoTotal.toFixed(2)],
  );

  if (ecf.fechaHoraFirma) {
    params.push(['fechafirma', ecf.fechaHoraFirma]);
  }

  if (ecf.codigoSeguridad) {
    params.push(['codigoseguridad', ecf.codigoSeguridad]);
  }

  const query = params
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/\+/g, '%20')}`)
    .join('&');

  return `${base}?${query}`;
}

export async function generarRepresentacionImpresa(
  ecf: EcfPdfInput,
  outputPath: string,
): Promise<void> {
  mkdirSync(dirname(outputPath), { recursive: true });

  // Branding: sólo se aplican colores hex válidos; cualquier otra cosa cae al default.
  const ACCENT = ecf.colorPrimario && HEX_RE.test(ecf.colorPrimario) ? ecf.colorPrimario : TEXT;
  const HEADER_BG = ecf.colorSecundario && HEX_RE.test(ecf.colorSecundario) ? ecf.colorSecundario : GRAY_HEADER;
  const logoBuffer = await loadLogo(ecf.logoUrl);

  const qrContent = buildQrUrl(ecf);

  // QR con nivel de corrección M según spec DGII.
  // Version auto-seleccionada: la URL completa requiere versión 10+ dependiendo de la longitud.
  const qrDataUrl = await QRCode.toDataURL(qrContent, {
    errorCorrectionLevel: 'M',
    width: 150,
    margin: 1,
  });
  const qrBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');

  // No bufferPages: avoids blank second page caused by footer text at y > usable
  // bottom triggering pdfkit auto-pagination inside the page-loop.
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    info: { Title: `e-CF ${ecf.eNCF}` },
  });

  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(outputPath);
    doc.pipe(stream);
    stream.on('finish', resolve);
    stream.on('error', reject);

    const pageW    = doc.page.width;    // 595.28
    const margin   = 40;
    const contentW = pageW - margin * 2; // 515.28

    // 50/50 header split — gives the right column enough room for the longest type labels
    const LEFT_W  = Math.floor(contentW * 0.55); // ~283pt — 258pt needed for longest nombre
    const GAP     = 14;
    const RIGHT_X = margin + LEFT_W + GAP;        // ~337pt from left edge
    const RIGHT_W = contentW - LEFT_W - GAP;      // ~218pt

    // ── Items table column widths ─────────────────────────────────────────────
    const COL_QTY   = 45;
    const COL_UM    = 65;
    const COL_PRICE = 80;
    const COL_ITBIS = 65;
    const COL_VALOR = 80;
    const COL_DESC  = contentW - COL_QTY - COL_UM - COL_PRICE - COL_ITBIS - COL_VALOR;

    const xQty   = margin;
    const xDesc  = xQty   + COL_QTY;
    const xUM    = xDesc  + COL_DESC;
    const xPrice = xUM    + COL_UM;
    const xItbis = xPrice + COL_PRICE;
    const xValor = xItbis + COL_ITBIS;

    let curY = margin;

    // ── HEADER LEFT: Emisor ───────────────────────────────────────────────────
    const nombreMostrar = ecf.nombreComercial ?? ecf.nombreEmisor;

    // Nombre comercial — bold 14pt, may wrap; measure first to advance curY correctly
    doc.font('Helvetica-Bold').fontSize(14).fillColor(ACCENT);
    const nombreH = doc.heightOfString(nombreMostrar, { width: LEFT_W });
    doc.text(nombreMostrar, margin, curY, { width: LEFT_W });
    curY += nombreH + 4;

    // Razón social below when there is a separate nombre comercial
    if (ecf.nombreComercial) {
      doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
      const razonH = doc.heightOfString(ecf.nombreEmisor, { width: LEFT_W });
      doc.text(ecf.nombreEmisor, margin, curY, { width: LEFT_W });
      curY += razonH + 3;
    }

    doc.font('Helvetica').fontSize(9).fillColor(TEXT)
       .text(`RNC: ${ecf.rncEmisor}`, margin, curY, { width: LEFT_W });
    curY += 13;

    if (ecf.direccionEmisor) {
      doc.font('Helvetica').fontSize(9).fillColor(TEXT);
      const dirH = doc.heightOfString(ecf.direccionEmisor, { width: LEFT_W });
      doc.text(ecf.direccionEmisor, margin, curY, { width: LEFT_W });
      curY += dirH + 3;
    }

    doc.font('Helvetica').fontSize(9).fillColor(TEXT)
       .text(`Fecha Emisión: ${ecf.fechaEmision}`, margin, curY, { width: LEFT_W });
    const leftEndY = curY + 13;

    // ── HEADER RIGHT: (Logo) + Tipo + e-NCF ───────────────────────────────────
    const tipo     = tipoLabel(ecf.tipoECF);
    const tipoCode = ecf.tipoECF.replace(/^[Ee]/, '');

    // Logo opcional arriba a la derecha; el tipo baja para no solaparse.
    let tipoTopY = margin;
    if (logoBuffer) {
      const LOGO_W = 90;
      const LOGO_H = 40;
      try {
        doc.image(logoBuffer, RIGHT_X + RIGHT_W - LOGO_W, margin, { fit: [LOGO_W, LOGO_H], align: 'right' });
        tipoTopY = margin + LOGO_H + 6;
      } catch {
        // imagen inválida → se ignora, se sigue sin logo
      }
    }

    doc.font('Helvetica-Bold').fontSize(12).fillColor(ACCENT);
    const tipoH = doc.heightOfString(tipo, { width: RIGHT_W });
    doc.text(tipo, RIGHT_X, tipoTopY, { width: RIGHT_W, align: 'right' });
    let rY = tipoTopY + tipoH + 5;

    doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT)
       .text(`e-NCF: ${ecf.eNCF}`, RIGHT_X, rY, { width: RIGHT_W, align: 'right' });
    rY += 13;

    if (ecf.fechaVencimiento) {
      doc.font('Helvetica').fontSize(9).fillColor(TEXT)
         .text(`Fecha Vencimiento: ${ecf.fechaVencimiento}`, RIGHT_X, rY, { width: RIGHT_W, align: 'right' });
      rY += 13;
    }

    if ((tipoCode === '33' || tipoCode === '34') && ecf.eNCFReferencia) {
      doc.font('Helvetica').fontSize(9).fillColor(TEXT)
         .text(`NCF Modificado: ${ecf.eNCFReferencia}`, RIGHT_X, rY, { width: RIGHT_W, align: 'right' });
      rY += 12;
      doc.font('Helvetica').fontSize(8).fillColor(MUTED)
         .text('Corrige montos del NCF modificado', RIGHT_X, rY, { width: RIGHT_W, align: 'right' });
      rY += 11;
    }

    curY = Math.max(leftEndY, rY) + 12;

    // ── SEPARATOR ─────────────────────────────────────────────────────────────
    doc.moveTo(margin, curY).lineTo(margin + contentW, curY)
       .strokeColor(BORDER).lineWidth(0.5).stroke();
    curY += 8;

    // ── COMPRADOR ─────────────────────────────────────────────────────────────
    // Two-column rows: label + value on the same Y.
    // lineBreak:false on the label prevents PDFKit from advancing its internal
    // cursor Y before the value is rendered — without it the value would drift
    // to the next line because PDFKit uses Math.max(internalY, specifiedY).
    const COMP_LABEL_W = 130;
    const COMP_VALUE_X = margin + COMP_LABEL_W;
    const COMP_VALUE_W = contentW - COMP_LABEL_W;

    const row1Y = curY;
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
       .text('Razón Social Cliente:', margin, row1Y, { width: COMP_LABEL_W, lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor(TEXT)
       .text(ecf.nombreComprador ?? 'Consumidor Final', COMP_VALUE_X, row1Y, { width: COMP_VALUE_W });
    curY = row1Y + 13;

    if (ecf.rncComprador) {
      const row2Y = curY;
      doc.font('Helvetica').fontSize(9).fillColor(MUTED)
         .text('RNC Cliente:', margin, row2Y, { width: COMP_LABEL_W, lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor(TEXT)
         .text(ecf.rncComprador, COMP_VALUE_X, row2Y, { width: COMP_VALUE_W });
      curY = row2Y + 13;
    }

    curY += 8;

    // ── ITEMS TABLE ───────────────────────────────────────────────────────────
    const ROW_H = 18;

    doc.rect(margin, curY, contentW, ROW_H).fill(HEADER_BG);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(TEXT);
    doc.text('Cantidad',     xQty   + 2, curY + 5, { width: COL_QTY - 4,   align: 'right' });
    doc.text('Descripción',  xDesc  + 4, curY + 5, { width: COL_DESC - 8 });
    doc.text('Unid. Medida', xUM    + 2, curY + 5, { width: COL_UM - 4,    align: 'center' });
    doc.text('Precio',       xPrice + 2, curY + 5, { width: COL_PRICE - 4, align: 'right' });
    doc.text('ITBIS',        xItbis + 2, curY + 5, { width: COL_ITBIS - 4, align: 'right' });
    doc.text('Valor',        xValor + 2, curY + 5, { width: COL_VALOR - 4, align: 'right' });

    let rowY = curY + ROW_H;

    ecf.items.forEach((item, i) => {
      const bg = i % 2 === 0 ? '#ffffff' : GRAY_ROW;
      doc.rect(margin, rowY, contentW, ROW_H).fill(bg);
      doc.font('Helvetica').fontSize(7.5).fillColor(TEXT);
      doc.text(item.cantidad.toString(),                    xQty   + 2, rowY + 5, { width: COL_QTY - 4,   align: 'right' });
      doc.text(item.descripcion,                            xDesc  + 4, rowY + 5, { width: COL_DESC - 8 });
      doc.text(umLabel(item.unidadMedida),                 xUM    + 2, rowY + 5, { width: COL_UM - 4,    align: 'center' });
      doc.text(fmt(item.precioUnitario),                   xPrice + 2, rowY + 5, { width: COL_PRICE - 4, align: 'right' });
      doc.text(item.itbis != null ? fmt(item.itbis) : '-', xItbis + 2, rowY + 5, { width: COL_ITBIS - 4, align: 'right' });
      doc.text(fmt(item.valor),                            xValor + 2, rowY + 5, { width: COL_VALOR - 4, align: 'right' });
      rowY += ROW_H;
    });

    doc.rect(margin, curY, contentW, rowY - curY).strokeColor(BORDER).lineWidth(0.5).stroke();
    curY = rowY + 14;

    // ── QR + TOTALS ───────────────────────────────────────────────────────────
    const QR_SIZE  = 45; // ~1.6 cm at 72 dpi (≤60 pt)
    const TOTALS_X = margin + contentW * 0.55;
    const TOTALS_W = contentW * 0.45;
    const LABEL_COL = TOTALS_W * 0.57;
    const VALUE_COL = TOTALS_W * 0.43;

    doc.image(qrBuffer, margin, curY, { width: QR_SIZE });

    const qrLabelY = curY + QR_SIZE + 4;
    doc.font('Helvetica').fontSize(6.5).fillColor(MUTED);
    // Mostrar URL del timbre bajo el QR (truncada para que entre en el espacio)
    const qrUrl = qrContent;
    const urlCorta = qrUrl.length > 80 ? qrUrl.substring(0, 77) + '...' : qrUrl;
    doc.text(urlCorta, margin, qrLabelY, { width: 180 });
    if (ecf.codigoSeguridad) {
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
         .text(`Cód. Seguridad: ${ecf.codigoSeguridad}`, margin, qrLabelY + 20, { width: 180 });
    }
    if (ecf.fechaHoraFirma) {
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
         .text(`Fecha Firma: ${ecf.fechaHoraFirma}`, margin, qrLabelY + 31, { width: 180 });
    }

    let totY = curY;

    const drawTotalLine = (label: string, value: number, bold = false) => {
      const font = bold ? 'Helvetica-Bold' : 'Helvetica';
      const size = bold ? 10 : 9;
      const color = bold ? ACCENT : MUTED;
      doc.font(font).fontSize(size).fillColor(color)
         .text(label + ':', TOTALS_X, totY, { width: LABEL_COL });
      doc.font(font).fontSize(size).fillColor(bold ? ACCENT : TEXT)
         .text(fmt(value), TOTALS_X + LABEL_COL, totY, { width: VALUE_COL, align: 'right' });
      totY += bold ? 16 : 14;
    };

    if (ecf.montoGravadoTotal != null && ecf.montoGravadoTotal > 0) {
      drawTotalLine('Subtotal Gravado', ecf.montoGravadoTotal);
    }
    if (ecf.itbisTotal != null && ecf.itbisTotal > 0) {
      drawTotalLine('Total ITBIS', ecf.itbisTotal);
    }
    if (ecf.montoExentoTotal != null && ecf.montoExentoTotal > 0) {
      drawTotalLine('Monto Exento', ecf.montoExentoTotal);
    }

    doc.moveTo(TOTALS_X, totY).lineTo(TOTALS_X + TOTALS_W, totY)
       .strokeColor(BORDER).lineWidth(0.5).stroke();
    totY += 4;

    drawTotalLine('Total', ecf.montoTotal, true);

    // ── FOOTER ────────────────────────────────────────────────────────────────
    // footerY (799pt) sits past the usable bottom (841-40=801pt).
    // Temporarily set margins.bottom=0 so pdfkit won't auto-create a blank page
    // when the footer text is rendered at explicit coordinates below 801pt.
    const footerY = doc.page.height - 42;
    const margins = doc.page.margins as { top: number; left: number; bottom: number; right: number };
    const savedBottom = margins.bottom;
    margins.bottom = 0;

    doc.moveTo(margin, footerY).lineTo(margin + contentW, footerY)
       .strokeColor(BORDER).lineWidth(0.5).stroke();

    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
       .text(
         'Representación impresa de Comprobante Fiscal Electrónico (e-CF) — Conserve este documento',
         margin, footerY + 5, { align: 'center', width: contentW },
       );

    margins.bottom = savedBottom;

    doc.end();
  });
}
