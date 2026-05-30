/**
 * regenerar-todos-pdfs.ts — Regenera los 29 PDFs de certificación DGII
 * con la URL de timbre correcta (consultatimbre / consultatimbrefc).
 *
 * - 21 PDFs (E31/E33/E34/E41/E43/E44/E45/E46/E47 + E32 ≥250K):
 *     Firma un XML mínimo para obtener FechaHoraFirma + CodigoSeguridad reales.
 * - 8 PDFs (E32 RFCE <250K): Lee los XMLs firmados del output anterior.
 *
 * Ejecutar: pnpm --filter @facturard/ecf-engine regenerar-todos-pdfs
 */

import * as dotenv from 'dotenv'
import { resolve } from 'path'
dotenv.config({ path: resolve(__dirname, '../.env') })

import { readFileSync, mkdirSync, readdirSync } from 'fs'
import { DOMParser } from '@xmldom/xmldom'
import { PrismaClient } from '@prisma/client'
import { extractFromP12 } from '../src/firma/certificate'
import { signXml } from '../src/firma/signer'
import { generarRepresentacionImpresa } from '../src/pdf'
import type { EcfPdfInput, EcfItem } from '../src/pdf'

// ── Config ────────────────────────────────────────────────────────────────────

const CERT_PATH  = process.env['DGII_CERT_PATH'] as string
const PASSPHRASE = process.env['DGII_CERT_PASSPHRASE'] as string
const OUTPUT_DIR = resolve(__dirname, '../dgii-cert/output/pdfs-v2')

// XMLs firmados de E32 RFCE del proceso de certificación anterior
const RFCE_XML_DIR = '/Users/wilmer/WebstormProjects/spynde/firma-digital/dgii-cert/output'

mkdirSync(OUTPUT_DIR, { recursive: true })

// ── Helpers ───────────────────────────────────────────────────────────────────

const ITBIS_RATE: Record<number, number> = { 1: 0.18, 2: 0.16, 3: 0.00, 4: 0.00 }
function r2(n: number): number { return Math.round(n * 100) / 100 }

function nowFechaHoraFirma(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function buildSignableXml(tipoECF: number, encf: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<ECF>` +
    `<Encabezado><IdDoc>` +
    `<TipoeCF>${tipoECF}</TipoeCF>` +
    `<eNCF>${encf}</eNCF>` +
    `</IdDoc></Encabezado>` +
    `<FechaHoraFirma>${nowFechaHoraFirma()}</FechaHoraFirma>` +
    `</ECF>`
  )
}

function firmar(xml: string): string {
  const certData = extractFromP12(readFileSync(CERT_PATH), PASSPHRASE)
  return signXml(xml, certData, { referenceXPath: `//*[local-name(.)='ECF']` })
}

const TIPO_SUFIJO: Record<number, string> = {
  31: 'Factura_Credito_Fiscal',
  33: 'Nota_Debito',
  34: 'Nota_Credito',
  41: 'Comprobante_Compras',
  43: 'Gastos_Menores',
  44: 'Regimenes_Especiales',
  45: 'Gubernamental',
  46: 'Exportaciones',
  47: 'Pagos_Exterior',
}

function pdfName(encf: string, tipo: number | string, montoTotal: number): string {
  const n = Number(tipo)
  let sufijo: string
  if (n === 32) {
    sufijo = montoTotal >= 250_000 ? 'Factura_Consumo_Mayor250K' : 'Factura_Consumo_Menor250K'
  } else {
    sufijo = TIPO_SUFIJO[n] ?? `Tipo${tipo}`
  }
  return `${encf}_${sufijo}.pdf`
}

// ── Datos de casos (21 e-CFs no-RFCE) ────────────────────────────────────────

// EMISOR se rellena en main() desde la DB — se asigna aquí para uso en CASOS
let EMISOR = {
  rncEmisor:       '132883225',
  razonSocial:     'DMAIA SRL',
  nombreComercial: 'DMAIA',
  direccion:       'Santo Domingo, República Dominicana',
}
const RNC_B = '131880681'
const NOM_B = 'DOCUMENTOS ELECTRONICOS DE 03'

interface Item { nombre: string; indicadorFacturacion: number; cantidad: number; unidadMedida?: number; precioUnitario: number; montoItem: number }
interface Caso {
  tipoeCF: number; encf: string; fechaEmision: string; fechaVencimiento?: string
  rncEmisor: string; razonSocial: string; nombreComercial?: string; direccion: string
  rncComprador?: string; nombreComprador?: string; items: Item[]
  montoGravado?: number; itbisTotal?: number; montoExento?: number; montoTotal: number; ncfModificado?: string
}

const CASOS: Caso[] = [
  // ── E31 — Factura Crédito Fiscal ──────────────────────────────────────────
  { tipoeCF: 31, encf: 'E310000000136', fechaEmision: '01-05-2026', fechaVencimiento: '31-12-2028', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Consultoria Especializada IT', indicadorFacturacion: 1, cantidad: 1, precioUnitario: 15000, montoItem: 15000 }], montoGravado: 15000, itbisTotal: 2700, montoTotal: 17700 },
  { tipoeCF: 31, encf: 'E310000000137', fechaEmision: '01-05-2026', fechaVencimiento: '31-12-2028', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Laptop Dell Latitude', indicadorFacturacion: 1, cantidad: 2, precioUnitario: 45000, montoItem: 90000 }, { nombre: 'Monitor LG 27"', indicadorFacturacion: 1, cantidad: 3, precioUnitario: 15000, montoItem: 45000 }], montoGravado: 135000, itbisTotal: 24300, montoTotal: 159300 },
  { tipoeCF: 31, encf: 'E310000000138', fechaEmision: '01-05-2026', fechaVencimiento: '31-12-2028', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Arroz 25kg', indicadorFacturacion: 4, cantidad: 50, precioUnitario: 1200, montoItem: 60000 }, { nombre: 'Aceite vegetal 5L', indicadorFacturacion: 4, cantidad: 30, precioUnitario: 800, montoItem: 24000 }], montoExento: 84000, montoTotal: 84000 },
  { tipoeCF: 31, encf: 'E310000000139', fechaEmision: '01-05-2026', fechaVencimiento: '31-12-2028', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Soporte Tecnico Premium', indicadorFacturacion: 1, cantidad: 1, precioUnitario: 50000, montoItem: 50000 }, { nombre: 'Papel Bond Letter 500h', indicadorFacturacion: 4, cantidad: 20, precioUnitario: 2500, montoItem: 50000 }], montoGravado: 50000, itbisTotal: 9000, montoExento: 50000, montoTotal: 109000 },

  // ── E32 ≥250K — Flujo A ────────────────────────────────────────────────────
  { tipoeCF: 32, encf: 'E320000000108', fechaEmision: '01-05-2026', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'TV Samsung 65"', indicadorFacturacion: 1, cantidad: 5, precioUnitario: 65000, montoItem: 325000 }], montoGravado: 325000, itbisTotal: 58500, montoTotal: 383500 },
  { tipoeCF: 32, encf: 'E320000000109', fechaEmision: '01-05-2026', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Refrigerador Samsung 2 puertas', indicadorFacturacion: 1, cantidad: 2, precioUnitario: 120000, montoItem: 240000 }, { nombre: 'Lavadora LG 17kg', indicadorFacturacion: 1, cantidad: 1, precioUnitario: 95000, montoItem: 95000 }], montoGravado: 335000, itbisTotal: 60300, montoTotal: 395300 },

  // ── E33 — Nota Débito ──────────────────────────────────────────────────────
  { tipoeCF: 33, encf: 'E330000000071', fechaEmision: '01-05-2026', fechaVencimiento: '31-12-2028', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Cargo adicional por descuento', indicadorFacturacion: 1, cantidad: 1, precioUnitario: 25000, montoItem: 25000 }], montoGravado: 25000, itbisTotal: 4500, montoTotal: 29500, ncfModificado: 'E320000000108' },

  // ── E34 — Notas Crédito ────────────────────────────────────────────────────
  { tipoeCF: 34, encf: 'E340000000028', fechaEmision: '01-05-2026', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Devolucion parcial de consultoria', indicadorFacturacion: 1, cantidad: 1, precioUnitario: 0, montoItem: 0 }], montoGravado: 0, itbisTotal: 0, montoTotal: 0, ncfModificado: 'E310000000136' },
  { tipoeCF: 34, encf: 'E340000000029', fechaEmision: '01-05-2026', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Devolucion equipo defectuoso', indicadorFacturacion: 1, cantidad: 1, precioUnitario: 0, montoItem: 0 }], montoGravado: 0, itbisTotal: 0, montoTotal: 0, ncfModificado: 'E310000000137' },

  // ── E41 — Comprobante de Compras ───────────────────────────────────────────
  { tipoeCF: 41, encf: 'E410000000089', fechaEmision: '01-05-2026', fechaVencimiento: '31-12-2028', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Asesoria Legal', indicadorFacturacion: 1, cantidad: 1, precioUnitario: 25000, montoItem: 25000 }, { nombre: 'Servicio Notarial', indicadorFacturacion: 4, cantidad: 1, precioUnitario: 8000, montoItem: 8000 }], montoGravado: 25000, itbisTotal: 4500, montoExento: 8000, montoTotal: 37500 },
  { tipoeCF: 41, encf: 'E410000000090', fechaEmision: '01-05-2026', fechaVencimiento: '31-12-2028', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Horas de Programacion Backend', indicadorFacturacion: 1, cantidad: 3, precioUnitario: 4500, montoItem: 13500 }], montoGravado: 13500, itbisTotal: 2430, montoTotal: 15930 },

  // ── E43 — Gastos Menores ───────────────────────────────────────────────────
  { tipoeCF: 43, encf: 'E430000000096', fechaEmision: '01-05-2026', fechaVencimiento: '31-12-2028', ...EMISOR, items: [{ nombre: 'Almuerzo ejecutivo', indicadorFacturacion: 4, cantidad: 2, precioUnitario: 1200, montoItem: 2400 }], montoExento: 2400, montoTotal: 2400 },
  { tipoeCF: 43, encf: 'E430000000097', fechaEmision: '01-05-2026', fechaVencimiento: '31-12-2028', ...EMISOR, items: [{ nombre: 'Taxi aeropuerto', indicadorFacturacion: 4, cantidad: 1, precioUnitario: 3500, montoItem: 3500 }, { nombre: 'Estacionamiento', indicadorFacturacion: 4, cantidad: 1, precioUnitario: 800, montoItem: 800 }], montoExento: 4300, montoTotal: 4300 },

  // ── E44 — Regímenes Especiales ─────────────────────────────────────────────
  { tipoeCF: 44, encf: 'E440000000096', fechaEmision: '01-05-2026', fechaVencimiento: '31-12-2028', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Camisas polo export', indicadorFacturacion: 4, cantidad: 100, precioUnitario: 1800, montoItem: 180000 }], montoExento: 180000, montoTotal: 180000 },
  { tipoeCF: 44, encf: 'E440000000097', fechaEmision: '01-05-2026', fechaVencimiento: '31-12-2028', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Pantalones drill', indicadorFacturacion: 4, cantidad: 50, precioUnitario: 2500, montoItem: 125000 }, { nombre: 'Zapatos de trabajo', indicadorFacturacion: 4, cantidad: 80, precioUnitario: 3200, montoItem: 256000 }], montoExento: 381000, montoTotal: 381000 },

  // ── E45 — Gubernamental ────────────────────────────────────────────────────
  { tipoeCF: 45, encf: 'E450000000084', fechaEmision: '01-05-2026', fechaVencimiento: '31-12-2028', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Cemento Portland 42.5kg', indicadorFacturacion: 1, cantidad: 200, precioUnitario: 900, montoItem: 180000 }], montoGravado: 180000, itbisTotal: 32400, montoTotal: 212400 },
  { tipoeCF: 45, encf: 'E450000000085', fechaEmision: '01-05-2026', fechaVencimiento: '31-12-2028', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Servicio de Diseno Grafico', indicadorFacturacion: 1, cantidad: 1, precioUnitario: 53100, montoItem: 53100 }], montoGravado: 45000, itbisTotal: 8100, montoTotal: 53100 },

  // ── E46 — Exportaciones ────────────────────────────────────────────────────
  { tipoeCF: 46, encf: 'E460000000082', fechaEmision: '01-05-2026', fechaVencimiento: '31-12-2028', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Cacao en grano kg', indicadorFacturacion: 3, cantidad: 500, precioUnitario: 850, montoItem: 425000 }], montoGravado: 425000, montoTotal: 425000 },
  { tipoeCF: 46, encf: 'E460000000083', fechaEmision: '01-05-2026', fechaVencimiento: '31-12-2028', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Ron anejado premium Lts', indicadorFacturacion: 3, cantidad: 200, precioUnitario: 1200, montoItem: 240000 }], montoGravado: 240000, montoTotal: 240000 },

  // ── E47 — Pagos al Exterior ────────────────────────────────────────────────
  { tipoeCF: 47, encf: 'E470000000083', fechaEmision: '01-05-2026', fechaVencimiento: '31-12-2028', ...EMISOR, items: [{ nombre: 'Horas Developer Senior', indicadorFacturacion: 4, cantidad: 40, precioUnitario: 2500, montoItem: 100000 }], montoExento: 100000, montoTotal: 100000 },
  { tipoeCF: 47, encf: 'E470000000084', fechaEmision: '01-05-2026', fechaVencimiento: '31-12-2028', ...EMISOR, items: [{ nombre: 'Horas Disenador UX', indicadorFacturacion: 4, cantidad: 20, precioUnitario: 3000, montoItem: 60000 }], montoExento: 60000, montoTotal: 60000 },

  // ── E32 RFCE <250K — Factura Consumo Electrónica (Flujo B) ───────────────
  { tipoeCF: 32, encf: 'E320000000011', fechaEmision: '01-05-2026', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Celular iPhone 15 128GB', indicadorFacturacion: 1, cantidad: 1, precioUnitario: 75000, montoItem: 75000 }], montoGravado: 75000, itbisTotal: 13500, montoTotal: 88500 },
  { tipoeCF: 32, encf: 'E320000000012', fechaEmision: '01-05-2026', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Tablet Samsung Galaxy S7', indicadorFacturacion: 1, cantidad: 2, precioUnitario: 35000, montoItem: 70000 }], montoGravado: 70000, itbisTotal: 12600, montoTotal: 82600 },
  { tipoeCF: 32, encf: 'E320000000013', fechaEmision: '01-05-2026', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Impresora HP LaserJet Pro', indicadorFacturacion: 1, cantidad: 1, precioUnitario: 28000, montoItem: 28000 }], montoGravado: 28000, itbisTotal: 5040, montoTotal: 33040 },
  { tipoeCF: 32, encf: 'E320000000014', fechaEmision: '01-05-2026', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Mueble escritorio ejecutivo', indicadorFacturacion: 1, cantidad: 1, precioUnitario: 45000, montoItem: 45000 }], montoGravado: 45000, itbisTotal: 8100, montoTotal: 53100 },
  { tipoeCF: 32, encf: 'E320000000120', fechaEmision: '01-05-2026', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Audífonos Sony WH-1000XM5', indicadorFacturacion: 1, cantidad: 3, precioUnitario: 18000, montoItem: 54000 }], montoGravado: 54000, itbisTotal: 9720, montoTotal: 63720 },
  { tipoeCF: 32, encf: 'E320000000121', fechaEmision: '01-05-2026', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Silla ergonómica oficina', indicadorFacturacion: 1, cantidad: 2, precioUnitario: 22000, montoItem: 44000 }], montoGravado: 44000, itbisTotal: 7920, montoTotal: 51920 },
  { tipoeCF: 32, encf: 'E320000000122', fechaEmision: '01-05-2026', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Teclado mecánico Keychron K2', indicadorFacturacion: 1, cantidad: 5, precioUnitario: 8500, montoItem: 42500 }], montoGravado: 42500, itbisTotal: 7650, montoTotal: 50150 },
  { tipoeCF: 32, encf: 'E320000000123', fechaEmision: '01-05-2026', ...EMISOR, rncComprador: RNC_B, nombreComprador: NOM_B, items: [{ nombre: 'Monitor Dell 27" 4K USB-C', indicadorFacturacion: 1, cantidad: 2, precioUnitario: 58000, montoItem: 116000 }], montoGravado: 116000, itbisTotal: 20880, montoTotal: 136880 },
]

// ── Generador para CASOS (firma XML mínimo) ────────────────────────────────────

async function generarDesdeCaso(caso: Caso): Promise<void> {
  const signed = firmar(buildSignableXml(caso.tipoeCF, caso.encf))
  const fhf    = signed.match(/<FechaHoraFirma>([^<]+)/)?.[1]
  const sigVal = signed.match(/<SignatureValue[^>]*>([A-Za-z0-9+/=]+)/)?.[1]
  const codSeg = sigVal?.substring(0, 6)

  const items: EcfItem[] = caso.items.map(it => {
    const itbis = r2(it.montoItem * (ITBIS_RATE[it.indicadorFacturacion] ?? 0))
    const base = {
      descripcion:    it.nombre,
      cantidad:       it.cantidad,
      precioUnitario: it.precioUnitario,
      itbis,
      valor:          it.montoItem,
    }
    return it.unidadMedida !== undefined ? { ...base, unidadMedida: String(it.unidadMedida) } : base
  })

  // Siempre usar EMISOR module-level (actualizado desde DB en main()),
  // no caso.rncEmisor/razonSocial/direccion que tienen los valores del snapshot inicial.
  const input: EcfPdfInput = {
    rncEmisor:       EMISOR.rncEmisor,
    nombreEmisor:    EMISOR.razonSocial,
    eNCF:            caso.encf,
    tipoECF:         String(caso.tipoeCF),
    fechaEmision:    caso.fechaEmision,
    fechaHoraFirma:  fhf,
    codigoSeguridad: codSeg,
    ambiente:        'certecf',
    items,
    ...(EMISOR.nombreComercial ? { nombreComercial: EMISOR.nombreComercial } : {}),
    ...(EMISOR.direccion        ? { direccionEmisor: EMISOR.direccion }       : {}),
    ...(caso.fechaVencimiento ? { fechaVencimiento: caso.fechaVencimiento } : {}),
    ...(caso.ncfModificado    ? { eNCFReferencia: caso.ncfModificado }    : {}),
    ...(caso.rncComprador     ? { rncComprador: caso.rncComprador }       : {}),
    ...(caso.nombreComprador  ? { nombreComprador: caso.nombreComprador } : {}),
    ...(caso.montoGravado && caso.montoGravado > 0 ? { montoGravadoTotal: caso.montoGravado } : {}),
    ...(caso.itbisTotal  && caso.itbisTotal  > 0 ? { itbisTotal:        caso.itbisTotal }  : {}),
    ...(caso.montoExento && caso.montoExento > 0 ? { montoExentoTotal:  caso.montoExento } : {}),
    montoTotal: caso.montoTotal,
  }

  const file = pdfName(caso.encf, caso.tipoeCF, caso.montoTotal)
  await generarRepresentacionImpresa(input, resolve(OUTPUT_DIR, file))
}

// ── Generador para E32 RFCE — parsea XML firmado ───────────────────────────────

function textTag(doc: Document, tag: string): string {
  return doc.getElementsByTagName(tag)[0]?.textContent?.trim() ?? ''
}
function numTag(doc: Document, tag: string): number {
  const v = parseFloat(textTag(doc, tag)); return isNaN(v) ? 0 : v
}

const ITBIS_RATE_S: Record<string, number> = { '1': 0.18, '2': 0.16, '3': 0.00, '4': 0.00 }

async function generarDesdeXml(xmlPath: string): Promise<void> {
  const xml = readFileSync(xmlPath, 'utf-8')
  const doc = new DOMParser().parseFromString(xml, 'text/xml') as unknown as Document

  const tipoECF        = textTag(doc, 'TipoeCF')
  const encf           = textTag(doc, 'eNCF')
  const fechaEmision   = textTag(doc, 'FechaEmision')
  const fechaVenc      = textTag(doc, 'FechaVencimientoSecuencia') || undefined
  const fechaHoraFirma = textTag(doc, 'FechaHoraFirma') || undefined
  const sigVal         = textTag(doc, 'SignatureValue')
  const codSeg         = sigVal ? sigVal.substring(0, 6) : undefined
  const rncComprador   = textTag(doc, 'RNCComprador') || undefined
  const nombreComp     = textTag(doc, 'RazonSocialComprador') || undefined
  const montoTotal     = numTag(doc, 'MontoTotal')

  const itemNodes = doc.getElementsByTagName('Item')
  const items: EcfItem[] = []
  for (let i = 0; i < itemNodes.length; i++) {
    const node = itemNodes[i]!
    const g  = (t: string) => node.getElementsByTagName(t)[0]?.textContent?.trim() ?? ''
    const gn = (t: string) => { const v = parseFloat(g(t)); return isNaN(v) ? 0 : v }
    const montoItem = gn('MontoItem')
    const indicador = g('IndicadorFacturacion')
    const itbis = r2(montoItem * (ITBIS_RATE_S[indicador] ?? 0))
    const unidadMedida = g('UnidadMedida') || undefined
    const base = {
      descripcion:    g('NombreItem'),
      cantidad:       gn('CantidadItem'),
      precioUnitario: gn('PrecioUnitarioItem'),
      itbis,
      valor:          montoItem,
    }
    items.push(unidadMedida !== undefined ? { ...base, unidadMedida } : base)
  }

  const input: EcfPdfInput = {
    rncEmisor:       textTag(doc, 'RNCEmisor'),
    nombreEmisor:    textTag(doc, 'RazonSocialEmisor'),
    eNCF:            encf,
    tipoECF,
    fechaEmision,
    fechaHoraFirma,
    codigoSeguridad: codSeg,
    ambiente:        'certecf',
    items,
    montoTotal,
    ...(textTag(doc, 'NombreComercial') ? { nombreComercial: textTag(doc, 'NombreComercial') } : {}),
    ...(textTag(doc, 'DireccionEmisor') ? { direccionEmisor: textTag(doc, 'DireccionEmisor') } : {}),
    ...(fechaVenc                        ? { fechaVencimiento: fechaVenc }                      : {}),
    ...(rncComprador                     ? { rncComprador }                                     : {}),
    ...(nombreComp                       ? { nombreComprador: nombreComp }                      : {}),
    ...(numTag(doc, 'MontoGravadoTotal') > 0 ? { montoGravadoTotal: numTag(doc, 'MontoGravadoTotal') } : {}),
    ...(numTag(doc, 'TotalITBIS')        > 0 ? { itbisTotal:        numTag(doc, 'TotalITBIS') }        : {}),
    ...(numTag(doc, 'MontoExento')       > 0 ? { montoExentoTotal:  numTag(doc, 'MontoExento') }       : {}),
  }

  const file = pdfName(encf, tipoECF, montoTotal)
  await generarRepresentacionImpresa(input, resolve(OUTPUT_DIR, file))
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!CERT_PATH || !PASSPHRASE) {
    console.error('Faltan DGII_CERT_PATH / DGII_CERT_PASSPHRASE en .env')
    process.exit(1)
  }

  // ── Leer emisor desde DB para usar la razón social oficial ─────────────────
  const prisma = new PrismaClient({ log: [] })
  try {
    const tenant = await prisma.tenant.findUnique({ where: { rnc: '132883225' } })
    if (tenant) {
      EMISOR = {
        rncEmisor:       tenant.rnc,
        razonSocial:     tenant.razonSocial,
        nombreComercial: tenant.nombreComercial ?? tenant.razonSocial,
        direccion:       tenant.direccion ?? 'Santo Domingo, República Dominicana',
      }
      console.log(`\nEmisor desde DB: ${tenant.razonSocial} (${tenant.rnc})`)
    } else {
      console.warn('Tenant RNC 132883225 no encontrado en DB — usando valores por defecto')
    }
  } finally {
    await prisma.$disconnect()
  }

  console.log(`Regenerando PDFs de certificación DGII — ambiente: certecf`)
  console.log(`Output: ${OUTPUT_DIR}\n`)

  let ok = 0
  const errores: { encf: string; error: string }[] = []

  // ── Parte 1: CASOS (21 e-CFs) ─────────────────────────────────────────────
  console.log(`── Parte 1: ${CASOS.length} e-CFs (firma XML mínimo) ──`)
  for (const caso of CASOS) {
    try {
      await generarDesdeCaso(caso)
      const file = pdfName(caso.encf, caso.tipoeCF, caso.montoTotal)
      console.log(`  ✅  E${caso.tipoeCF} ${caso.encf}  →  ${file}`)
      ok++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ❌  ${caso.encf}  →  ${msg}`)
      errores.push({ encf: caso.encf, error: msg })
    }
  }

  // ── Los E32 RFCE <250K se incluyeron en CASOS — no se necesitan XMLs ─────

  // ── Resumen ────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════')
  console.log(`  PDFs generados : ${ok} / ${CASOS.length}`)
  if (errores.length > 0) {
    console.log(`  Fallidos       : ${errores.length}`)
    errores.forEach(e => console.log(`    • ${e.encf}: ${e.error}`))
  }
  console.log(`  Directorio     : ${OUTPUT_DIR}`)
  console.log('══════════════════════════════════════════════════\n')
}

main().catch(err => { console.error(err); process.exit(1) })
