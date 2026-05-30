/**
 * regenerar-pdfs-desde-aceptados.ts
 *
 * Lee dgii-cert/output/aceptados.json y regenera los PDFs usando:
 *   - El CodigoSeguridad REAL del XML firmado aceptado (NO refirma)
 *   - La FechaHoraFirma extraída del XML original
 *   - Los datos del comprobante del XML
 *
 * Usa el generador de la DGII con URL consultatimbre correcta.
 *
 * Ejecutar: npx tsx scripts/regenerar-pdfs-desde-aceptados.ts
 */
import 'dotenv/config';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { DOMParser } from '@xmldom/xmldom';

// ── Path al generador de ecf-engine (tiene URL consultatimbre correcta) ────────
// Usamos el dist compilado del monorepo para el PDF generator actualizado
const ECF_ENGINE_PDF = resolve(__dirname, '../dist/pdf/index.js');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generarRepresentacionImpresa } = require(ECF_ENGINE_PDF) as {
  generarRepresentacionImpresa: (input: EcfPdfInput, outputPath: string) => Promise<void>;
};

interface EcfPdfInput {
  rncEmisor: string;
  nombreEmisor: string;
  nombreComercial?: string;
  direccionEmisor?: string;
  eNCF: string;
  tipoECF: string;
  fechaEmision: string;
  fechaVencimiento?: string;
  fechaHoraFirma?: string;
  codigoSeguridad?: string;
  ambiente?: 'certecf' | 'ecf';
  eNCFReferencia?: string;
  rncComprador?: string;
  nombreComprador?: string;
  items: Array<{
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    itbis?: number;
    valor: number;
    unidadMedida?: string;
  }>;
  montoGravadoTotal?: number;
  itbisTotal?: number;
  montoExentoTotal?: number;
  montoTotal: number;
}

interface EntradaAceptado {
  eNCF: string;
  tipo: string;
  trackId: string | null;
  codigoSeguridad: string;
  xmlPath: string;
  estado: string;
  timestamp: string;
}

// ── XML parsing helpers ────────────────────────────────────────────────────────

function getText(doc: Document, tag: string): string {
  return doc.getElementsByTagName(tag)[0]?.textContent?.trim() ?? '';
}

function getNum(doc: Document, tag: string): number {
  const v = parseFloat(getText(doc, tag));
  return isNaN(v) ? 0 : v;
}

const ITBIS_RATE: Record<string, number> = { '1': 0.18, '2': 0.16, '3': 0.00, '4': 0.00 };

function r2(n: number): number { return Math.round(n * 100) / 100 }

function buildPdfInput(xml: string, codigoSeguridad: string): EcfPdfInput {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml') as unknown as Document;

  const tipoECF       = getText(doc, 'TipoeCF');
  const eNCF          = getText(doc, 'eNCF');
  const fechaEmision  = getText(doc, 'FechaEmision');
  const fechaVenc     = getText(doc, 'FechaVencimientoSecuencia') || undefined;
  const fechaHoraFirma = getText(doc, 'FechaHoraFirma') || undefined;
  const eNCFRef       = getText(doc, 'eNCFReferencia') || undefined;

  const rncEmisor       = getText(doc, 'RNCEmisor');
  const nombreEmisor    = getText(doc, 'RazonSocialEmisor');
  const nombreComercial = getText(doc, 'NombreComercial') || undefined;
  const direccionEmisor = getText(doc, 'DireccionEmisor') || undefined;

  const rncComprador    = getText(doc, 'RNCComprador') || undefined;
  const nombreComprador = getText(doc, 'RazonSocialComprador') || undefined;

  const montoGravadoTotal = getNum(doc, 'MontoGravadoTotal') || undefined;
  const itbisTotal        = getNum(doc, 'TotalITBIS') || undefined;
  const montoExentoTotal  = getNum(doc, 'MontoExento') || undefined;
  const montoTotal        = getNum(doc, 'MontoTotal');

  // Items
  const itemNodes = doc.getElementsByTagName('Item');
  const items: EcfPdfInput['items'] = [];
  for (let i = 0; i < itemNodes.length; i++) {
    const node = itemNodes[i]!;
    const g  = (t: string) => node.getElementsByTagName(t)[0]?.textContent?.trim() ?? '';
    const gn = (t: string) => { const v = parseFloat(g(t)); return isNaN(v) ? 0 : v; };
    const montoItem  = gn('MontoItem');
    const indicador  = g('IndicadorFacturacion');
    const itbis      = r2(montoItem * (ITBIS_RATE[indicador] ?? 0));
    const unidadMedida = g('UnidadMedida') || undefined;
    items.push({
      descripcion:    g('NombreItem'),
      cantidad:       gn('CantidadItem'),
      precioUnitario: gn('PrecioUnitarioItem'),
      itbis,
      valor:          montoItem,
      ...(unidadMedida ? { unidadMedida } : {}),
    });
  }

  return {
    rncEmisor,
    nombreEmisor,
    ...(nombreComercial ? { nombreComercial } : {}),
    ...(direccionEmisor ? { direccionEmisor } : {}),
    eNCF,
    tipoECF,
    fechaEmision,
    ...(fechaVenc      ? { fechaVencimiento: fechaVenc } : {}),
    ...(fechaHoraFirma ? { fechaHoraFirma } : {}),
    codigoSeguridad,
    ambiente: 'certecf',
    ...(eNCFRef        ? { eNCFReferencia: eNCFRef } : {}),
    ...(rncComprador   ? { rncComprador } : {}),
    ...(nombreComprador ? { nombreComprador } : {}),
    items,
    ...(montoGravadoTotal ? { montoGravadoTotal } : {}),
    ...(itbisTotal        ? { itbisTotal } : {}),
    ...(montoExentoTotal  ? { montoExentoTotal } : {}),
    montoTotal,
  };
}

const TIPO_SUFIJO: Record<string, string> = {
  '31': 'Factura_Credito_Fiscal',
  '32': 'Factura_Consumo',
  '33': 'Nota_Debito',
  '34': 'Nota_Credito',
  '41': 'Comprobante_Compras',
  '43': 'Gastos_Menores',
  '44': 'Regimenes_Especiales',
  '45': 'Gubernamental',
  '46': 'Exportaciones',
  '47': 'Pagos_Exterior',
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const ACEPTADOS_PATH = resolve(__dirname, '../dgii-cert/output/aceptados.json');
  const PDF_DIR        = resolve(__dirname, '../dgii-cert/output/pdfs-finales');

  if (!existsSync(ACEPTADOS_PATH)) {
    console.error(`⛔ No existe: ${ACEPTADOS_PATH}`);
    console.error('   Ejecuta run-simulation-tests.ts primero.');
    process.exit(1);
  }

  mkdirSync(PDF_DIR, { recursive: true });

  const aceptados: EntradaAceptado[] = JSON.parse(readFileSync(ACEPTADOS_PATH, 'utf-8'));
  const soloAceptados = aceptados.filter(e =>
    e.estado.toLowerCase().includes('aceptad')
  );

  console.log(`\nRegenerando ${soloAceptados.length} PDFs desde aceptados.json...`);
  console.log(`Output: ${PDF_DIR}\n`);

  let ok = 0;
  const errores: { eNCF: string; error: string }[] = [];

  for (const entry of soloAceptados) {
    if (!existsSync(entry.xmlPath)) {
      console.error(`  ❌ ${entry.eNCF} — XML no encontrado: ${entry.xmlPath}`);
      errores.push({ eNCF: entry.eNCF, error: 'XML no encontrado' });
      continue;
    }

    try {
      const xml = readFileSync(entry.xmlPath, 'utf-8');
      const input = buildPdfInput(xml, entry.codigoSeguridad);

      const tipoNum = entry.tipo.replace('E', '');
      const sufijo  = TIPO_SUFIJO[tipoNum] ?? `Tipo${tipoNum}`;
      const pdfPath = resolve(PDF_DIR, `${entry.eNCF}_${sufijo}.pdf`);

      await generarRepresentacionImpresa(input, pdfPath);
      console.log(`  ✅  ${entry.eNCF}  →  ${entry.eNCF}_${sufijo}.pdf  (CS: ${entry.codigoSeguridad})`);
      ok++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ ${entry.eNCF} — ${msg}`);
      errores.push({ eNCF: entry.eNCF, error: msg });
    }
  }

  console.log('\n══════════════════════════════════════════════════');
  console.log(`  PDFs generados: ${ok} / ${soloAceptados.length}`);
  if (errores.length > 0) {
    console.log(`  Fallidos: ${errores.length}`);
    errores.forEach(e => console.log(`    • ${e.eNCF}: ${e.error}`));
  }
  console.log(`  Directorio: ${PDF_DIR}`);
  console.log('══════════════════════════════════════════════════\n');
}

main().catch(err => { console.error(err); process.exit(1); });
