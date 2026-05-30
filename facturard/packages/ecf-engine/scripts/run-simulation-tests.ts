/**
 * run-simulation-tests.ts — Paso 4 de certificación DGII: Pruebas de Simulación
 *
 * Ejecutar (desde packages/ecf-engine): pnpm test:sim
 *            o: npx ts-node --project tsconfig.seed.json scripts/run-simulation-tests.ts
 *
 * CRÍTICO: Los eNCFs no se pueden reutilizar si son rechazados.
 *          El script se detiene completamente ante cualquier rechazo.
 *
 * Fase 1 — Envío directo: E31 (077-080), E32≥250K (055-056), E41 (036-037),
 *           E43 (043-044), E44 (043-044), E45 (031-032), E46 (029-030), E47 (030-031)
 * Fase 2 — Dependientes: E33 (021 ref E32-055), E34 (038 ref E31-077, 039 ref E31-078)
 * Fase 3+4 — RFCE-32 <250K (070-073) → fc.dgii.gov.do + E32 XML para portal
 *
 * Para cada e-CF aceptado se genera un PDF en dgii-cert/output/pdfs/.
 */
import * as dotenv from 'dotenv';
import { resolve as _envResolve } from 'path';
dotenv.config({ path: _envResolve(__dirname, '../.env') });
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { extractFromP12, signXml } from '../src/firma';
import {
  autenticar, enviarECF, enviarResumenFC, consultarEstado, DgiiApiError,
} from '../src/dgii';
import type { DgiiRecepcionFCResponse, DgiiResultadoResponse } from '../src/dgii';
import { generarRepresentacionImpresa } from '../src/pdf';
import type { EcfPdfInput } from '../src/pdf';

const CERT_PATH  = process.env['DGII_CERT_PATH']       as string;
const PASSPHRASE = process.env['DGII_CERT_PASSPHRASE'] as string;
const ENV        = 'certecf' as const;

// ─── Tipos internos (idénticos a run-cert-tests.ts) ──────────────────────────

interface ItemRetencion {
  indicadorAgente?: number;
  montoITBISRetenido?: number;
  montoISRRetenido?: number;
}

interface TablaSubDescuento {
  tipoSubDescuento: '$' | '%';
  subDescuentoPorcentaje?: number;
  montoSubDescuento?: number;
}

interface TablaSubRecargo {
  tipoSubRecargo: '$' | '%';
  subRecargoPorcentaje?: number;
  montoSubRecargo?: number;
}

interface Item {
  nombre: string;
  descripcionItem?: string;
  indicadorFacturacion: number;
  indicadorBienoServicio: 1 | 2;
  cantidad: number;
  cantidadDecimals?: 0 | 2;
  unidadMedida?: number;
  precioUnitario: number;
  precioDecimals?: 2 | 4;
  descuentoMonto?: number;
  tablaSubDescuento?: TablaSubDescuento;
  recargoMonto?: number;
  tablaSubRecargo?: TablaSubRecargo;
  retencion?: ItemRetencion;
  montoItem: number;
}

interface Totales {
  montoGravadoTotal?: number;
  montoGravadoI1?: number;
  montoGravadoI2?: number;
  montoGravadoI3?: number;
  montoExento?: number;
  itbis1?: number;
  itbis2?: number;
  itbis3?: number;
  totalITBIS?: number;
  totalITBIS1?: number;
  totalITBIS2?: number;
  totalITBIS3?: number;
  totalITBISRetenido?: number;
  totalISRRetencion?: number;
  montoTotal: number;
  montoNoFacturable?: number;
  montoPeriodo?: number;
  valorPagar?: number;
}

interface CasoTest {
  tipoeCF: number;
  encf: string;
  fechaVencimientoSecuencia?: string;
  indicadorNotaCredito?: number;
  indicadorMontoGravado?: number;
  tipoIngresos?: string;
  tipoPago?: number;
  rncEmisor: string;
  razonSocialEmisor: string;
  nombreComercial?: string;
  direccionEmisor: string;
  municipio?: string;
  provincia?: string;
  telefono?: string;
  correoEmisor?: string;
  webSite?: string;
  codigoVendedor?: string;
  numeroFacturaInterna?: string;
  numeroPedidoInterno?: string;
  zonaVenta?: string;
  telefono2?: string;
  fechaEmision: string;
  rncComprador?: string;
  razonSocialComprador?: string;
  contactoComprador?: string;
  correoComprador?: string;
  direccionComprador?: string;
  municipioComprador?: string;
  provinciaComprador?: string;
  fechaEntrega?: string;
  fechaOrdenCompra?: string;
  numeroOrdenCompra?: string;
  codigoInternoComprador?: string;
  contactoEntrega?: string;
  direccionEntrega?: string;
  telefonoAdicional?: string;
  fechaLimitePago?: string;
  terminoPago?: string;
  items: Item[];
  totales: Totales;
  ncfModificado?: string;
  fechaNCFModificado?: string;
  codigoModificacion?: number;
  razonModificacion?: string;
  rncModificado?: string;
}

// ─── Emisores y compradores ───────────────────────────────────────────────────

const CORREO_EMISOR   = 'DOCUMENTOSELECTRONICOSDE0612345678969789+9000000000000000000000000000001@123.COM';
const WEBSITE_EMISOR  = 'www.facturaelectronica.com';
const CODIGO_VENDEDOR = 'AA0000000100000000010000000002000000000300000000050000000006';
const NUM_FACTURA     = '123456789016';

const EMISOR_PRINCIPAL = {
  rncEmisor: '132883225',
  razonSocialEmisor: 'DOCUMENTOS ELECTRONICOS DE 02',
  nombreComercial: 'DOCUMENTOS ELECTRONICOS DE 02',
  direccionEmisor: 'AVE. ISABEL AGUIAR NO. 269, ZONA INDUSTRIAL DE HERRERA',
  municipio: '010100',
  provincia: '010000',
  telefono: '809-472-7676',
  correoEmisor: CORREO_EMISOR,
  webSite: WEBSITE_EMISOR,
  codigoVendedor: CODIGO_VENDEDOR,
  numeroFacturaInterna: NUM_FACTURA,
  numeroPedidoInterno: NUM_FACTURA,
};

// E41 / E43: sin CodigoVendedor, WebSite, NumeroFacturaInterna, NumeroPedidoInterno
const EMISOR_SIN_VENDEDOR = {
  rncEmisor: '132883225',
  razonSocialEmisor: 'DOCUMENTOS ELECTRONICOS DE 02',
  nombreComercial: 'DOCUMENTOS ELECTRONICOS DE 02',
  direccionEmisor: 'AVE. ISABEL AGUIAR NO. 269, ZONA INDUSTRIAL DE HERRERA',
  municipio: '010100',
  provincia: '010000',
  telefono: '809-472-7676',
  correoEmisor: CORREO_EMISOR,
};

// E32 RFCE (<250K): emisor sin municipio/provincia/webSite/codigoVendedor (igual que Paso 2)
const EMISOR_RFCE32 = {
  rncEmisor: '132883225',
  razonSocialEmisor: 'DOCUMENTOS ELECTRONICOS PRUEBA FACTURA DE CONSUMO MENOR 250MIL',
  nombreComercial: 'DOCUMENTOS ELECTRONICOS',
  direccionEmisor: 'AVE. ISABEL AGUIAR NO. 269, ZONA INDUSTRIAL DE HERRERA',
  telefono: '809-472-7676',
  correoEmisor: 'DOCUMENTOSELECTRONICOS@123.COM',
};

const COMPRADOR_B = {
  rncComprador: '131880681',
  razonSocialComprador: 'DOCUMENTOS ELECTRONICOS DE 03',
  municipioComprador: '010100',
  provinciaComprador: '010000',
};

// Comprador para los RFCE (mismo que Paso 2, datos exactos del portal)
const COMPRADOR_RFCE_BASE = {
  rncComprador: '131880681',
  razonSocialComprador: 'DOCUMENTOS ELECTRONICOS DE 03',
  correoComprador: 'DOCUMENTOSELECTRONICOSDE0612345678969789@123.COM',
  direccionComprador: 'AVE. ISABEL AGUIAR NO. 269, ZONA INDUSTRIAL DE HERRERA',
  telefonoAdicional: '809-472-7676',
};

// ─── FASE 1A: E31 — Factura Crédito Fiscal ───────────────────────────────────

const CASOS_E31: CasoTest[] = [
  {
    tipoeCF: 31, encf: 'E310000000176', fechaVencimientoSecuencia: '31-12-2028',
    indicadorMontoGravado: 0, tipoIngresos: '01', tipoPago: 1,
    ...EMISOR_PRINCIPAL, fechaEmision: '01-05-2026',
    ...COMPRADOR_B,
    items: [
      { nombre: 'Consultoria Especializada IT', indicadorFacturacion: 1, indicadorBienoServicio: 2,
        cantidad: 1, precioUnitario: 15000, montoItem: 15000 },
    ],
    totales: { montoGravadoTotal: 15000, montoGravadoI1: 15000, itbis1: 18,
               totalITBIS: 2700, totalITBIS1: 2700, montoTotal: 17700 },
  },
  {
    tipoeCF: 31, encf: 'E310000000177', fechaVencimientoSecuencia: '31-12-2028',
    indicadorMontoGravado: 0, tipoIngresos: '01', tipoPago: 1,
    ...EMISOR_PRINCIPAL, fechaEmision: '01-05-2026',
    ...COMPRADOR_B,
    items: [
      { nombre: 'Laptop Dell Latitude', indicadorFacturacion: 1, indicadorBienoServicio: 1,
        cantidad: 2, precioUnitario: 45000, montoItem: 90000 },
      { nombre: 'Monitor LG 27"', indicadorFacturacion: 1, indicadorBienoServicio: 1,
        cantidad: 3, precioUnitario: 15000, montoItem: 45000 },
    ],
    totales: { montoGravadoTotal: 135000, montoGravadoI1: 135000, itbis1: 18,
               totalITBIS: 24300, totalITBIS1: 24300, montoTotal: 159300 },
  },
  {
    tipoeCF: 31, encf: 'E310000000178', fechaVencimientoSecuencia: '31-12-2028',
    tipoIngresos: '01', tipoPago: 1,
    ...EMISOR_PRINCIPAL, fechaEmision: '01-05-2026',
    ...COMPRADOR_B,
    items: [
      { nombre: 'Arroz 25kg', indicadorFacturacion: 4, indicadorBienoServicio: 1,
        cantidad: 50, precioUnitario: 1200, montoItem: 60000 },
      { nombre: 'Aceite vegetal 5L', indicadorFacturacion: 4, indicadorBienoServicio: 1,
        cantidad: 30, precioUnitario: 800, montoItem: 24000 },
    ],
    totales: { montoExento: 84000, montoTotal: 84000 },
  },
  {
    tipoeCF: 31, encf: 'E310000000179', fechaVencimientoSecuencia: '31-12-2028',
    indicadorMontoGravado: 0, tipoIngresos: '01', tipoPago: 1,
    ...EMISOR_PRINCIPAL, fechaEmision: '01-05-2026',
    ...COMPRADOR_B,
    items: [
      { nombre: 'Soporte Tecnico Premium', indicadorFacturacion: 1, indicadorBienoServicio: 2,
        cantidad: 1, precioUnitario: 50000, montoItem: 50000 },
      { nombre: 'Papel Bond Letter 500h', indicadorFacturacion: 4, indicadorBienoServicio: 1,
        cantidad: 20, precioUnitario: 2500, montoItem: 50000 },
    ],
    totales: { montoGravadoTotal: 50000, montoGravadoI1: 50000, montoExento: 50000,
               itbis1: 18, totalITBIS: 9000, totalITBIS1: 9000, montoTotal: 109000 },
  },
];

// ─── FASE 1B: E32 ≥ RD$250,000 (Flujo A — enviarECF + consultarEstado) ───────

const CASOS_E32_FLUJO_A: CasoTest[] = [
  {
    tipoeCF: 32, encf: 'E320000000143',
    indicadorMontoGravado: 0, tipoIngresos: '01', tipoPago: 1,
    ...EMISOR_PRINCIPAL, fechaEmision: '01-05-2026',
    ...COMPRADOR_B,
    items: [
      { nombre: 'TV Samsung 65"', indicadorFacturacion: 1, indicadorBienoServicio: 1,
        cantidad: 5, precioUnitario: 65000, montoItem: 325000 },
    ],
    totales: { montoGravadoTotal: 325000, montoGravadoI1: 325000, itbis1: 18,
               totalITBIS: 58500, totalITBIS1: 58500, montoTotal: 383500 },
  },
  {
    tipoeCF: 32, encf: 'E320000000144',
    indicadorMontoGravado: 0, tipoIngresos: '01', tipoPago: 1,
    ...EMISOR_PRINCIPAL, fechaEmision: '01-05-2026',
    ...COMPRADOR_B,
    items: [
      { nombre: 'Refrigerador Samsung 2 puertas', indicadorFacturacion: 1, indicadorBienoServicio: 1,
        cantidad: 2, precioUnitario: 120000, montoItem: 240000 },
      { nombre: 'Lavadora LG 17kg', indicadorFacturacion: 1, indicadorBienoServicio: 1,
        cantidad: 1, precioUnitario: 95000, montoItem: 95000 },
    ],
    totales: { montoGravadoTotal: 335000, montoGravadoI1: 335000, itbis1: 18,
               totalITBIS: 60300, totalITBIS1: 60300, montoTotal: 395300 },
  },
];

// ─── FASE 1C: E41 — Comprobante de Gastos ────────────────────────────────────

const CASOS_E41: CasoTest[] = [
  {
    tipoeCF: 41, encf: 'E410000000110', fechaVencimientoSecuencia: '31-12-2028',
    indicadorMontoGravado: 0, tipoPago: 1,
    ...EMISOR_SIN_VENDEDOR, fechaEmision: '01-05-2026',
    rncComprador: '131880681', razonSocialComprador: 'DOCUMENTOS ELECTRONICOS DE 03',
    items: [
      { nombre: 'Asesoria Legal', indicadorFacturacion: 1, indicadorBienoServicio: 2,
        cantidad: 1, precioUnitario: 25000, montoItem: 25000,
        retencion: { indicadorAgente: 1, montoITBISRetenido: 4500, montoISRRetenido: 2500 } },
      { nombre: 'Servicio Notarial', indicadorFacturacion: 4, indicadorBienoServicio: 2,
        cantidad: 1, precioUnitario: 8000, montoItem: 8000,
        retencion: { indicadorAgente: 1, montoISRRetenido: 800 } },
    ],
    totales: { montoGravadoTotal: 25000, montoGravadoI1: 25000, montoExento: 8000,
               itbis1: 18, totalITBIS: 4500, totalITBIS1: 4500,
               montoTotal: 37500, totalITBISRetenido: 4500, totalISRRetencion: 3300 },
  },
  {
    tipoeCF: 41, encf: 'E410000000111', fechaVencimientoSecuencia: '31-12-2028',
    indicadorMontoGravado: 0, tipoPago: 1,
    ...EMISOR_SIN_VENDEDOR, fechaEmision: '01-05-2026',
    rncComprador: '131880681', razonSocialComprador: 'DOCUMENTOS ELECTRONICOS DE 03',
    items: [
      { nombre: 'Horas de Programacion Backend', indicadorFacturacion: 1, indicadorBienoServicio: 2,
        cantidad: 3, precioUnitario: 4500, montoItem: 13500,
        retencion: { indicadorAgente: 1, montoITBISRetenido: 2430, montoISRRetenido: 1350 } },
    ],
    totales: { montoGravadoTotal: 13500, montoGravadoI1: 13500,
               itbis1: 18, totalITBIS: 2430, totalITBIS1: 2430,
               montoTotal: 15930, totalITBISRetenido: 2430, totalISRRetencion: 1350 },
  },
];

// ─── FASE 1D: E43 — Gastos Menores (sin Comprador) ───────────────────────────

const CASOS_E43: CasoTest[] = [
  {
    tipoeCF: 43, encf: 'E430000000117', fechaVencimientoSecuencia: '31-12-2028',
    ...EMISOR_SIN_VENDEDOR, webSite: WEBSITE_EMISOR, fechaEmision: '01-05-2026',
    items: [
      { nombre: 'Almuerzo ejecutivo', indicadorFacturacion: 4, indicadorBienoServicio: 2,
        cantidad: 2, precioUnitario: 1200, montoItem: 2400 },
    ],
    totales: { montoExento: 2400, montoTotal: 2400 },
  },
  {
    tipoeCF: 43, encf: 'E430000000118', fechaVencimientoSecuencia: '31-12-2028',
    tipoPago: 1,
    ...EMISOR_SIN_VENDEDOR, webSite: WEBSITE_EMISOR, fechaEmision: '01-05-2026',
    items: [
      { nombre: 'Taxi aeropuerto', indicadorFacturacion: 4, indicadorBienoServicio: 2,
        cantidad: 1, precioUnitario: 3500, montoItem: 3500 },
      { nombre: 'Estacionamiento', indicadorFacturacion: 4, indicadorBienoServicio: 2,
        cantidad: 1, precioUnitario: 800, montoItem: 800 },
    ],
    totales: { montoExento: 4300, montoTotal: 4300 },
  },
];

// ─── FASE 1E: E44 — Regímenes Especiales ─────────────────────────────────────

const CASOS_E44: CasoTest[] = [
  {
    tipoeCF: 44, encf: 'E440000000117', fechaVencimientoSecuencia: '31-12-2028',
    tipoIngresos: '01', tipoPago: 1,
    ...EMISOR_PRINCIPAL, fechaEmision: '01-05-2026',
    ...COMPRADOR_B,
    items: [
      { nombre: 'Camisas polo export', indicadorFacturacion: 4, indicadorBienoServicio: 1,
        cantidad: 100, precioUnitario: 1800, montoItem: 180000 },
    ],
    totales: { montoExento: 180000, montoTotal: 180000 },
  },
  {
    tipoeCF: 44, encf: 'E440000000118', fechaVencimientoSecuencia: '31-12-2028',
    tipoIngresos: '01', tipoPago: 1,
    ...EMISOR_PRINCIPAL, fechaEmision: '01-05-2026',
    ...COMPRADOR_B,
    items: [
      { nombre: 'Pantalones drill', indicadorFacturacion: 4, indicadorBienoServicio: 1,
        cantidad: 50, precioUnitario: 2500, montoItem: 125000 },
      { nombre: 'Zapatos de trabajo', indicadorFacturacion: 4, indicadorBienoServicio: 1,
        cantidad: 80, precioUnitario: 3200, montoItem: 256000 },
    ],
    totales: { montoExento: 381000, montoTotal: 381000 },
  },
];

// ─── FASE 1F: E45 — Gubernamental ────────────────────────────────────────────

const CASOS_E45: CasoTest[] = [
  {
    tipoeCF: 45, encf: 'E450000000105', fechaVencimientoSecuencia: '31-12-2028',
    indicadorMontoGravado: 0, tipoIngresos: '01', tipoPago: 1,
    ...EMISOR_PRINCIPAL, fechaEmision: '01-05-2026',
    ...COMPRADOR_B,
    items: [
      { nombre: 'Cemento Portland 42.5kg', indicadorFacturacion: 1, indicadorBienoServicio: 1,
        cantidad: 200, precioUnitario: 900, montoItem: 180000 },
    ],
    totales: { montoGravadoTotal: 180000, montoGravadoI1: 180000, itbis1: 18,
               totalITBIS: 32400, totalITBIS1: 32400, montoTotal: 212400 },
  },
  {
    tipoeCF: 45, encf: 'E450000000106', fechaVencimientoSecuencia: '31-12-2028',
    indicadorMontoGravado: 1, tipoIngresos: '01', tipoPago: 1,
    ...EMISOR_PRINCIPAL, fechaEmision: '01-05-2026',
    ...COMPRADOR_B,
    items: [
      { nombre: 'Servicio de Diseno Grafico', indicadorFacturacion: 1, indicadorBienoServicio: 2,
        cantidad: 1, precioUnitario: 53100, montoItem: 53100 },
    ],
    // IndicadorMontoGravado=1: MontoItem es precio bruto (ITBIS incluido)
    // MontoGravadoI1 = 53100 / 1.18 = 45000 (base exacta)
    totales: { montoGravadoTotal: 45000, montoGravadoI1: 45000, itbis1: 18,
               totalITBIS: 8100, totalITBIS1: 8100, montoTotal: 53100 },
  },
];

// ─── FASE 1G: E46 — Exportaciones ────────────────────────────────────────────

const CASOS_E46: CasoTest[] = [
  {
    tipoeCF: 46, encf: 'E460000000103', fechaVencimientoSecuencia: '31-12-2028',
    tipoIngresos: '01', tipoPago: 1,
    ...EMISOR_PRINCIPAL, fechaEmision: '01-05-2026',
    ...COMPRADOR_B,
    items: [
      { nombre: 'Cacao en grano kg', indicadorFacturacion: 3, indicadorBienoServicio: 1,
        cantidad: 500, precioUnitario: 850, montoItem: 425000 },
    ],
    totales: { montoGravadoTotal: 425000, montoGravadoI3: 425000,
               itbis3: 0, totalITBIS: 0, totalITBIS3: 0, montoTotal: 425000 },
  },
  {
    tipoeCF: 46, encf: 'E460000000104', fechaVencimientoSecuencia: '31-12-2028',
    tipoIngresos: '01', tipoPago: 1,
    ...EMISOR_PRINCIPAL, fechaEmision: '01-05-2026',
    ...COMPRADOR_B,
    items: [
      { nombre: 'Ron anejado premium Lts', indicadorFacturacion: 3, indicadorBienoServicio: 1,
        cantidad: 200, precioUnitario: 1200, montoItem: 240000 },
    ],
    totales: { montoGravadoTotal: 240000, montoGravadoI3: 240000,
               itbis3: 0, totalITBIS: 0, totalITBIS3: 0, montoTotal: 240000 },
  },
];

// ─── FASE 1H: E47 — Pagos al Exterior ────────────────────────────────────────

const CASOS_E47: CasoTest[] = [
  {
    tipoeCF: 47, encf: 'E470000000104', fechaVencimientoSecuencia: '31-12-2028',
    tipoPago: 1,
    ...EMISOR_PRINCIPAL, codigoVendedor: undefined, fechaEmision: '01-05-2026',
    items: [
      { nombre: 'Horas Developer Senior', indicadorFacturacion: 4, indicadorBienoServicio: 2,
        cantidad: 40, precioUnitario: 2500, precioDecimals: 4,
        retencion: { indicadorAgente: 1, montoISRRetenido: 27000 }, montoItem: 100000 },
    ],
    totales: { montoExento: 100000, totalISRRetencion: 27000, montoTotal: 100000 },
  },
  {
    tipoeCF: 47, encf: 'E470000000105', fechaVencimientoSecuencia: '31-12-2028',
    tipoPago: 1,
    ...EMISOR_PRINCIPAL, codigoVendedor: undefined, fechaEmision: '01-05-2026',
    items: [
      { nombre: 'Horas Disenador UX', indicadorFacturacion: 4, indicadorBienoServicio: 2,
        cantidad: 20, precioUnitario: 3000, precioDecimals: 4,
        retencion: { indicadorAgente: 1, montoISRRetenido: 16200 }, montoItem: 60000 },
    ],
    totales: { montoExento: 60000, totalISRRetencion: 16200, montoTotal: 60000 },
  },
];

// ─── FASE 2: E33 (Nota Débito) y E34 (Notas Crédito) ─────────────────────────

const CASOS_E33: CasoTest[] = [
  {
    tipoeCF: 33, encf: 'E330000000091', fechaVencimientoSecuencia: '31-12-2028',
    indicadorMontoGravado: 0, tipoIngresos: '01', tipoPago: 1,
    ...EMISOR_PRINCIPAL, fechaEmision: '01-05-2026',
    ...COMPRADOR_B,
    items: [
      { nombre: 'Cargo adicional por descuento', indicadorFacturacion: 1, indicadorBienoServicio: 1,
        cantidad: 1, precioUnitario: 25000, montoItem: 25000 },
    ],
    totales: { montoGravadoTotal: 25000, montoGravadoI1: 25000, itbis1: 18,
               totalITBIS: 4500, totalITBIS1: 4500, montoTotal: 29500 },
    ncfModificado: 'E320000000143', fechaNCFModificado: '01-05-2026',
    codigoModificacion: 3,
  },
];

const CASOS_E34: CasoTest[] = [
  {
    tipoeCF: 34, encf: 'E340000000059',
    indicadorNotaCredito: 0, indicadorMontoGravado: 0, tipoIngresos: '01', tipoPago: 1,
    ...EMISOR_PRINCIPAL, fechaEmision: '01-05-2026',
    ...COMPRADOR_B,
    items: [
      { nombre: 'Devolucion parcial de consultoria', indicadorFacturacion: 1, indicadorBienoServicio: 2,
        cantidad: 1, cantidadDecimals: 0, precioUnitario: 0, montoItem: 0 },
    ],
    totales: { montoGravadoTotal: 0, montoGravadoI1: 0, itbis1: 18,
               totalITBIS: 0, totalITBIS1: 0, montoTotal: 0 },
    ncfModificado: 'E310000000176', fechaNCFModificado: '01-05-2026',
    codigoModificacion: 2, razonModificacion: 'Devolucion parcial',
  },
  {
    tipoeCF: 34, encf: 'E340000000060',
    indicadorNotaCredito: 0, indicadorMontoGravado: 0, tipoIngresos: '01', tipoPago: 1,
    ...EMISOR_PRINCIPAL, fechaEmision: '01-05-2026',
    ...COMPRADOR_B,
    items: [
      { nombre: 'Devolucion equipo defectuoso', indicadorFacturacion: 1, indicadorBienoServicio: 1,
        cantidad: 1, cantidadDecimals: 0, precioUnitario: 0, montoItem: 0 },
    ],
    totales: { montoGravadoTotal: 0, montoGravadoI1: 0, itbis1: 18,
               totalITBIS: 0, totalITBIS1: 0, montoTotal: 0 },
    ncfModificado: 'E310000000177', fechaNCFModificado: '01-05-2026',
    codigoModificacion: 2, razonModificacion: 'Devolucion equipo defectuoso',
  },
];

// ─── FASE 3+4: RFCE-32 < RD$250,000 ─────────────────────────────────────────

const CASOS_RFCE32: CasoTest[] = [
  {
    tipoeCF: 32, encf: 'E320000000165',
    indicadorMontoGravado: 0, tipoIngresos: '01', tipoPago: 1,
    ...EMISOR_RFCE32, fechaEmision: '01-05-2026',
    ...COMPRADOR_RFCE_BASE, municipioComprador: '170203', provinciaComprador: '170000',
    items: [
      { nombre: 'Aire acondicionado 18000 BTU', indicadorFacturacion: 1, indicadorBienoServicio: 1,
        cantidad: 1, cantidadDecimals: 0, unidadMedida: 55, precioUnitario: 35000, montoItem: 35000 },
    ],
    totales: { montoGravadoTotal: 35000, montoGravadoI1: 35000, itbis1: 18,
               totalITBIS: 6300, totalITBIS1: 6300, montoTotal: 41300 },
  },
  {
    tipoeCF: 32, encf: 'E320000000166',
    indicadorMontoGravado: 0, tipoIngresos: '01', tipoPago: 1,
    ...EMISOR_RFCE32, fechaEmision: '01-05-2026',
    ...COMPRADOR_RFCE_BASE, municipioComprador: '170203', provinciaComprador: '170000',
    items: [
      { nombre: 'Impresora HP LaserJet', indicadorFacturacion: 1, indicadorBienoServicio: 1,
        cantidad: 1, cantidadDecimals: 0, unidadMedida: 55, precioUnitario: 18000, montoItem: 18000 },
      { nombre: 'Toner HP original', indicadorFacturacion: 1, indicadorBienoServicio: 1,
        cantidad: 1, cantidadDecimals: 0, unidadMedida: 55, precioUnitario: 5000, montoItem: 5000 },
    ],
    totales: { montoGravadoTotal: 23000, montoGravadoI1: 23000, itbis1: 18,
               totalITBIS: 4140, totalITBIS1: 4140, montoTotal: 27140 },
  },
  {
    tipoeCF: 32, encf: 'E320000000167',
    indicadorMontoGravado: 0, tipoIngresos: '01', tipoPago: 1,
    ...EMISOR_RFCE32, fechaEmision: '01-05-2026',
    ...COMPRADOR_RFCE_BASE, municipioComprador: '170203', provinciaComprador: '170000',
    items: [
      { nombre: 'Silla ergonomica ejecutiva', indicadorFacturacion: 1, indicadorBienoServicio: 1,
        cantidad: 2, cantidadDecimals: 0, unidadMedida: 55, precioUnitario: 12500, montoItem: 25000 },
    ],
    totales: { montoGravadoTotal: 25000, montoGravadoI1: 25000, itbis1: 18,
               totalITBIS: 4500, totalITBIS1: 4500, montoTotal: 29500 },
  },
  {
    tipoeCF: 32, encf: 'E320000000168',
    indicadorMontoGravado: 0, tipoIngresos: '01', tipoPago: 1,
    ...EMISOR_RFCE32, fechaEmision: '01-05-2026',
    ...COMPRADOR_RFCE_BASE, municipioComprador: '170203', provinciaComprador: '170000',
    items: [
      { nombre: 'Escritorio ejecutivo L-shape', indicadorFacturacion: 1, indicadorBienoServicio: 1,
        cantidad: 1, cantidadDecimals: 0, unidadMedida: 55, precioUnitario: 45000, montoItem: 45000 },
    ],
    totales: { montoGravadoTotal: 45000, montoGravadoI1: 45000, itbis1: 18,
               totalITBIS: 8100, totalITBIS1: 8100, montoTotal: 53100 },
  },
];

// ─── XML Builder (idéntico a run-cert-tests.ts) ───────────────────────────────

function d(n: number | undefined): string {
  return (n ?? 0).toFixed(2);
}

function nowFechaHoraFirma(): string {
  const now = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${p(now.getDate())}-${p(now.getMonth() + 1)}-${now.getFullYear()} ` +
    `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`
  );
}

function buildECFXml(caso: CasoTest): string {
  const t    = caso.totales;
  const tipo = caso.tipoeCF;
  const isE32 = tipo === 32;
  const isE34 = tipo === 34;

  const idDocXml =
    `    <IdDoc>\n` +
    `      <TipoeCF>${tipo}</TipoeCF>\n` +
    `      <eNCF>${caso.encf}</eNCF>\n` +
    (caso.fechaVencimientoSecuencia && !isE32 && !isE34
      ? `      <FechaVencimientoSecuencia>${caso.fechaVencimientoSecuencia}</FechaVencimientoSecuencia>\n` : '') +
    (isE34 ? `      <IndicadorNotaCredito>${caso.indicadorNotaCredito ?? 1}</IndicadorNotaCredito>\n` : '') +
    (caso.indicadorMontoGravado !== undefined
      ? `      <IndicadorMontoGravado>${caso.indicadorMontoGravado}</IndicadorMontoGravado>\n` : '') +
    (caso.tipoIngresos ? `      <TipoIngresos>${caso.tipoIngresos}</TipoIngresos>\n` : '') +
    (caso.tipoPago     ? `      <TipoPago>${caso.tipoPago}</TipoPago>\n` : '') +
    (caso.fechaLimitePago ? `      <FechaLimitePago>${caso.fechaLimitePago}</FechaLimitePago>\n` : '') +
    (caso.terminoPago     ? `      <TerminoPago>${caso.terminoPago}</TerminoPago>\n` : '') +
    `    </IdDoc>\n`;

  const emisorXml =
    `    <Emisor>\n` +
    `      <RNCEmisor>${caso.rncEmisor}</RNCEmisor>\n` +
    `      <RazonSocialEmisor>${caso.razonSocialEmisor}</RazonSocialEmisor>\n` +
    (caso.nombreComercial   ? `      <NombreComercial>${caso.nombreComercial}</NombreComercial>\n` : '') +
    `      <DireccionEmisor>${caso.direccionEmisor}</DireccionEmisor>\n` +
    (caso.municipio         ? `      <Municipio>${caso.municipio}</Municipio>\n` : '') +
    (caso.provincia         ? `      <Provincia>${caso.provincia}</Provincia>\n` : '') +
    (caso.telefono
      ? `      <TablaTelefonoEmisor>\n        <TelefonoEmisor>${caso.telefono}</TelefonoEmisor>\n` +
        (caso.telefono2 ? `        <TelefonoEmisor>${caso.telefono2}</TelefonoEmisor>\n` : '') +
        `      </TablaTelefonoEmisor>\n`
      : '') +
    (caso.correoEmisor   ? `      <CorreoEmisor>${caso.correoEmisor}</CorreoEmisor>\n` : '') +
    (caso.webSite        ? `      <WebSite>${caso.webSite}</WebSite>\n` : '') +
    (caso.codigoVendedor ? `      <CodigoVendedor>${caso.codigoVendedor}</CodigoVendedor>\n` : '') +
    (caso.numeroFacturaInterna ? `      <NumeroFacturaInterna>${caso.numeroFacturaInterna}</NumeroFacturaInterna>\n` : '') +
    (caso.numeroPedidoInterno  ? `      <NumeroPedidoInterno>${caso.numeroPedidoInterno}</NumeroPedidoInterno>\n` : '') +
    (caso.zonaVenta      ? `      <ZonaVenta>${caso.zonaVenta}</ZonaVenta>\n` : '') +
    `      <FechaEmision>${caso.fechaEmision}</FechaEmision>\n` +
    `    </Emisor>\n`;

  const compradorXml = caso.rncComprador || isE32
    ? `    <Comprador>\n` +
      (caso.rncComprador         ? `      <RNCComprador>${caso.rncComprador}</RNCComprador>\n` : '') +
      (caso.razonSocialComprador ? `      <RazonSocialComprador>${caso.razonSocialComprador}</RazonSocialComprador>\n` : '') +
      (caso.contactoComprador    ? `      <ContactoComprador>${caso.contactoComprador}</ContactoComprador>\n` : '') +
      (caso.correoComprador      ? `      <CorreoComprador>${caso.correoComprador}</CorreoComprador>\n` : '') +
      (caso.direccionComprador   ? `      <DireccionComprador>${caso.direccionComprador}</DireccionComprador>\n` : '') +
      (caso.municipioComprador   ? `      <MunicipioComprador>${caso.municipioComprador}</MunicipioComprador>\n` : '') +
      (caso.provinciaComprador   ? `      <ProvinciaComprador>${caso.provinciaComprador}</ProvinciaComprador>\n` : '') +
      (caso.fechaEntrega         ? `      <FechaEntrega>${caso.fechaEntrega}</FechaEntrega>\n` : '') +
      (caso.contactoEntrega      ? `      <ContactoEntrega>${caso.contactoEntrega}</ContactoEntrega>\n` : '') +
      (caso.direccionEntrega     ? `      <DireccionEntrega>${caso.direccionEntrega}</DireccionEntrega>\n` : '') +
      (caso.telefonoAdicional    ? `      <TelefonoAdicional>${caso.telefonoAdicional}</TelefonoAdicional>\n` : '') +
      (caso.fechaOrdenCompra     ? `      <FechaOrdenCompra>${caso.fechaOrdenCompra}</FechaOrdenCompra>\n` : '') +
      (caso.numeroOrdenCompra    ? `      <NumeroOrdenCompra>${caso.numeroOrdenCompra}</NumeroOrdenCompra>\n` : '') +
      (caso.codigoInternoComprador ? `      <CodigoInternoComprador>${caso.codigoInternoComprador}</CodigoInternoComprador>\n` : '') +
      `    </Comprador>\n`
    : '';

  const totalesXml =
    `    <Totales>\n` +
    (t.montoGravadoTotal !== undefined ? `      <MontoGravadoTotal>${d(t.montoGravadoTotal)}</MontoGravadoTotal>\n` : '') +
    (t.montoGravadoI1    !== undefined ? `      <MontoGravadoI1>${d(t.montoGravadoI1)}</MontoGravadoI1>\n` : '') +
    (t.montoGravadoI2    !== undefined ? `      <MontoGravadoI2>${d(t.montoGravadoI2)}</MontoGravadoI2>\n` : '') +
    (t.montoGravadoI3    !== undefined ? `      <MontoGravadoI3>${d(t.montoGravadoI3)}</MontoGravadoI3>\n` : '') +
    (t.montoExento       !== undefined ? `      <MontoExento>${d(t.montoExento)}</MontoExento>\n` : '') +
    (t.itbis1            !== undefined ? `      <ITBIS1>${t.itbis1}</ITBIS1>\n` : '') +
    (t.itbis2            !== undefined ? `      <ITBIS2>${t.itbis2}</ITBIS2>\n` : '') +
    (t.itbis3            !== undefined ? `      <ITBIS3>${t.itbis3}</ITBIS3>\n` : '') +
    (t.totalITBIS        !== undefined ? `      <TotalITBIS>${d(t.totalITBIS)}</TotalITBIS>\n` : '') +
    (t.totalITBIS1       !== undefined ? `      <TotalITBIS1>${d(t.totalITBIS1)}</TotalITBIS1>\n` : '') +
    (t.totalITBIS2       !== undefined ? `      <TotalITBIS2>${d(t.totalITBIS2)}</TotalITBIS2>\n` : '') +
    (t.totalITBIS3       !== undefined ? `      <TotalITBIS3>${d(t.totalITBIS3)}</TotalITBIS3>\n` : '') +
    `      <MontoTotal>${d(t.montoTotal)}</MontoTotal>\n` +
    (t.montoNoFacturable !== undefined ? `      <MontoNoFacturable>${d(t.montoNoFacturable)}</MontoNoFacturable>\n` : '') +
    (t.montoPeriodo      !== undefined ? `      <MontoPeriodo>${d(t.montoPeriodo)}</MontoPeriodo>\n` : '') +
    (t.valorPagar        !== undefined ? `      <ValorPagar>${d(t.valorPagar)}</ValorPagar>\n` : '') +
    (t.totalITBISRetenido !== undefined ? `      <TotalITBISRetenido>${d(t.totalITBISRetenido)}</TotalITBISRetenido>\n` : '') +
    (t.totalISRRetencion  !== undefined ? `      <TotalISRRetencion>${d(t.totalISRRetencion)}</TotalISRRetencion>\n` : '') +
    `    </Totales>\n`;

  const refXml = caso.ncfModificado
    ? `  <InformacionReferencia>\n` +
      `    <NCFModificado>${caso.ncfModificado}</NCFModificado>\n` +
      (caso.rncModificado ? `    <RNCOtroContribuyente>${caso.rncModificado}</RNCOtroContribuyente>\n` : '') +
      `    <FechaNCFModificado>${caso.fechaNCFModificado}</FechaNCFModificado>\n` +
      `    <CodigoModificacion>${caso.codigoModificacion}</CodigoModificacion>\n` +
      (caso.razonModificacion ? `    <RazonModificacion>${caso.razonModificacion}</RazonModificacion>\n` : '') +
      `  </InformacionReferencia>\n`
    : '';

  const itemsXml =
    `  <DetallesItems>\n` +
    caso.items.map((it, idx) =>
      `    <Item>\n` +
      `      <NumeroLinea>${idx + 1}</NumeroLinea>\n` +
      `      <IndicadorFacturacion>${it.indicadorFacturacion}</IndicadorFacturacion>\n` +
      (it.retencion
        ? `      <Retencion>\n` +
          (it.retencion.indicadorAgente !== undefined
            ? `        <IndicadorAgenteRetencionoPercepcion>${it.retencion.indicadorAgente}</IndicadorAgenteRetencionoPercepcion>\n` : '') +
          (it.retencion.montoITBISRetenido !== undefined
            ? `        <MontoITBISRetenido>${d(it.retencion.montoITBISRetenido)}</MontoITBISRetenido>\n` : '') +
          (it.retencion.montoISRRetenido !== undefined
            ? `        <MontoISRRetenido>${d(it.retencion.montoISRRetenido)}</MontoISRRetenido>\n` : '') +
          `      </Retencion>\n`
        : '') +
      `      <NombreItem>${it.nombre}</NombreItem>\n` +
      `      <IndicadorBienoServicio>${it.indicadorBienoServicio}</IndicadorBienoServicio>\n` +
      (it.descripcionItem ? `      <DescripcionItem>${it.descripcionItem}</DescripcionItem>\n` : '') +
      `      <CantidadItem>${it.cantidadDecimals === 0 ? String(it.cantidad) : it.cantidad.toFixed(2)}</CantidadItem>\n` +
      (it.unidadMedida !== undefined ? `      <UnidadMedida>${it.unidadMedida}</UnidadMedida>\n` : '') +
      `      <PrecioUnitarioItem>${it.precioUnitario.toFixed(it.precioDecimals ?? 2)}</PrecioUnitarioItem>\n` +
      (it.descuentoMonto !== undefined ? `      <DescuentoMonto>${d(it.descuentoMonto)}</DescuentoMonto>\n` : '') +
      (it.tablaSubDescuento
        ? `      <TablaSubDescuento>\n        <SubDescuento>\n` +
          `          <TipoSubDescuento>${it.tablaSubDescuento.tipoSubDescuento}</TipoSubDescuento>\n` +
          (it.tablaSubDescuento.subDescuentoPorcentaje !== undefined
            ? `          <SubDescuentoPorcentaje>${it.tablaSubDescuento.subDescuentoPorcentaje.toFixed(2)}</SubDescuentoPorcentaje>\n` : '') +
          (it.tablaSubDescuento.montoSubDescuento !== undefined
            ? `          <MontoSubDescuento>${d(it.tablaSubDescuento.montoSubDescuento)}</MontoSubDescuento>\n` : '') +
          `        </SubDescuento>\n      </TablaSubDescuento>\n`
        : '') +
      (it.recargoMonto !== undefined ? `      <RecargoMonto>${d(it.recargoMonto)}</RecargoMonto>\n` : '') +
      (it.tablaSubRecargo
        ? `      <TablaSubRecargo>\n        <SubRecargo>\n` +
          `          <TipoSubRecargo>${it.tablaSubRecargo.tipoSubRecargo}</TipoSubRecargo>\n` +
          (it.tablaSubRecargo.subRecargoPorcentaje !== undefined
            ? `          <SubRecargoPorcentaje>${it.tablaSubRecargo.subRecargoPorcentaje.toFixed(2)}</SubRecargoPorcentaje>\n` : '') +
          (it.tablaSubRecargo.montoSubRecargo !== undefined
            ? `          <MontoSubRecargo>${d(it.tablaSubRecargo.montoSubRecargo)}</MontoSubRecargo>\n` : '') +
          `        </SubRecargo>\n      </TablaSubRecargo>\n`
        : '') +
      `      <MontoItem>${d(it.montoItem)}</MontoItem>\n` +
      `    </Item>\n`,
    ).join('') +
    `  </DetallesItems>\n`;

  const encabezado =
    `  <Encabezado>\n` +
    `    <Version>1.0</Version>\n` +
    idDocXml + emisorXml + compradorXml + totalesXml +
    `  </Encabezado>\n`;

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<ECF>\n` +
    encabezado +
    itemsXml +
    refXml +
    `  <FechaHoraFirma>${nowFechaHoraFirma()}</FechaHoraFirma>\n` +
    `</ECF>`
  );
}

function buildRFCEXml(caso: CasoTest, codigoSeguridad: string): string {
  const t = caso.totales;
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<RFCE>\n` +
    `  <Encabezado>\n` +
    `    <Version>1.0</Version>\n` +
    `    <IdDoc>\n` +
    `      <TipoeCF>32</TipoeCF>\n` +
    `      <eNCF>${caso.encf}</eNCF>\n` +
    `      <TipoIngresos>${caso.tipoIngresos ?? '01'}</TipoIngresos>\n` +
    `      <TipoPago>${caso.tipoPago ?? 1}</TipoPago>\n` +
    `    </IdDoc>\n` +
    `    <Emisor>\n` +
    `      <RNCEmisor>${caso.rncEmisor}</RNCEmisor>\n` +
    `      <RazonSocialEmisor>${caso.razonSocialEmisor}</RazonSocialEmisor>\n` +
    `      <FechaEmision>${caso.fechaEmision}</FechaEmision>\n` +
    `    </Emisor>\n` +
    `    <Comprador>\n` +
    (caso.rncComprador         ? `      <RNCComprador>${caso.rncComprador}</RNCComprador>\n` : '') +
    (caso.razonSocialComprador ? `      <RazonSocialComprador>${caso.razonSocialComprador}</RazonSocialComprador>\n` : '') +
    `    </Comprador>\n` +
    `    <Totales>\n` +
    (t.montoGravadoTotal !== undefined ? `      <MontoGravadoTotal>${d(t.montoGravadoTotal)}</MontoGravadoTotal>\n` : '') +
    (t.montoGravadoI1    !== undefined ? `      <MontoGravadoI1>${d(t.montoGravadoI1)}</MontoGravadoI1>\n` : '') +
    (t.totalITBIS ? `      <TotalITBIS>${d(t.totalITBIS)}</TotalITBIS>\n` : '') +
    (t.totalITBIS1 ? `      <TotalITBIS1>${d(t.totalITBIS1)}</TotalITBIS1>\n` : '') +
    `      <MontoTotal>${d(t.montoTotal)}</MontoTotal>\n` +
    `    </Totales>\n` +
    `    <CodigoSeguridadeCF>${codigoSeguridad}</CodigoSeguridadeCF>\n` +
    `  </Encabezado>\n` +
    `</RFCE>`
  );
}

// ─── Firma ────────────────────────────────────────────────────────────────────

function firmar(xml: string, rootTag = 'ECF'): string {
  const certData = extractFromP12(readFileSync(CERT_PATH), PASSPHRASE);
  return signXml(xml, certData, { referenceXPath: `//*[local-name(.)='${rootTag}']` });
}

// ─── Registro persistente de eNCFs usados ────────────────────────────────────

interface EncfRegistro {
  [encf: string]: {
    tipo: number;
    enviado: string;
    estado: string;
    trackId?: string;
    mensajes?: string[];
  };
}

const REGISTRO_PATH  = resolve(__dirname, '../dgii-cert/output/encfs-usados.json');
const ACEPTADOS_PATH = resolve(__dirname, '../dgii-cert/output/aceptados.json');
const XML_DIR        = resolve(__dirname, '../dgii-cert/output/xmls-aceptados');

// ─── CodigoSeguridad + persistencia de aceptados ──────────────────────────────

function extraerCodigoSeguridad(signedXml: string): string {
  const sv = signedXml.match(/<SignatureValue[^>]*>([^<]+)<\/SignatureValue>/)?.[1]?.replace(/\s/g, '') ?? '';
  return sv.substring(0, 6);
}

interface EntradaAceptado {
  eNCF:             string;
  tipo:             string;
  trackId:          string | null;
  codigoSeguridad:  string;
  fechaFirma:       string;
  montoTotal:       number;
  rncComprador:     string;
  xmlPath:          string;
  estado:           string;
  timestamp:        string;
}

function extraerFechaFirma(signedXml: string): string {
  return signedXml.match(/<FechaHoraFirma>([^<]+)<\/FechaHoraFirma>/)?.[1]?.trim() ?? '';
}

function guardarAceptado(
  caso: CasoTest,
  signedXml: string,
  estado: string,
  trackId: string | null,
): void {
  mkdirSync(XML_DIR, { recursive: true });

  const xmlFile = `${caso.encf}.xml`;
  const xmlPath = resolve(XML_DIR, xmlFile);
  writeFileSync(xmlPath, signedXml, 'utf-8');

  const codigoSeguridad = extraerCodigoSeguridad(signedXml);
  const fechaFirma      = extraerFechaFirma(signedXml);

  let lista: EntradaAceptado[] = [];
  if (existsSync(ACEPTADOS_PATH)) {
    try { lista = JSON.parse(readFileSync(ACEPTADOS_PATH, 'utf-8')) as EntradaAceptado[]; }
    catch { lista = []; }
  }

  lista = lista.filter(e => e.eNCF !== caso.encf);
  lista.push({
    eNCF:            caso.encf,
    tipo:            `E${caso.tipoeCF}`,
    trackId,
    codigoSeguridad,
    fechaFirma,
    montoTotal:      caso.totales.montoTotal,
    rncComprador:    caso.rncComprador ?? '',
    xmlPath,
    estado,
    timestamp:       new Date().toISOString(),
  });

  writeFileSync(ACEPTADOS_PATH, JSON.stringify(lista, null, 2), 'utf-8');
  console.log(`   [XML+CS] ${xmlFile}  CodigoSeguridad="${codigoSeguridad}"  FechaFirma="${fechaFirma}"`);
}

function cargarRegistro(): EncfRegistro {
  if (!existsSync(REGISTRO_PATH)) return {};
  try {
    return JSON.parse(readFileSync(REGISTRO_PATH, 'utf-8')) as EncfRegistro;
  } catch {
    return {};
  }
}

function guardarRegistro(reg: EncfRegistro): void {
  writeFileSync(REGISTRO_PATH, JSON.stringify(reg, null, 2), 'utf-8');
}

function verificarNoUsado(encf: string, reg: EncfRegistro): void {
  const prev = reg[encf];
  if (prev) {
    console.error(`\n⛔ COLISIÓN: ${encf} ya fue enviado el ${prev.enviado}`);
    console.error(`   Estado anterior: ${prev.estado}`);
    console.error(`   Actualiza el script con un número de secuencia diferente.`);
    process.exit(1);
  }
}

function registrarEncf(
  encf: string,
  tipo: number,
  estado: string,
  reg: EncfRegistro,
  opts: { trackId?: string | null; mensajes?: string[] } = {},
): void {
  reg[encf] = {
    tipo,
    enviado: new Date().toISOString(),
    estado,
    ...(opts.trackId ? { trackId: opts.trackId } : {}),
    ...(opts.mensajes?.length ? { mensajes: opts.mensajes } : {}),
  };
  guardarRegistro(reg);
}

// ─── PDF generator helper ─────────────────────────────────────────────────────

const TIPO_LABELS: Record<number, string> = {
  31: 'Factura Crédito Fiscal (31)',
  32: 'Factura Consumo (32)',
  33: 'Nota de Débito (33)',
  34: 'Nota de Crédito (34)',
  41: 'Comprobante de Gastos (41)',
  43: 'Gastos Menores (43)',
  44: 'Regímenes Especiales (44)',
  45: 'Gubernamental (45)',
  46: 'Exportaciones (46)',
  47: 'Pagos al Exterior (47)',
};

async function guardarPDF(caso: CasoTest, signedXml: string, pdfDir: string): Promise<void> {
  const fhfMatch = signedXml.match(/<FechaHoraFirma>([^<]+)<\/FechaHoraFirma>/);
  const t = caso.totales;

  const input: EcfPdfInput = {
    rncEmisor:       caso.rncEmisor,
    nombreEmisor:    caso.razonSocialEmisor,
    direccionEmisor: caso.direccionEmisor,
    telefonoEmisor:  caso.telefono,
    eNCF:            caso.encf,
    tipoECF:         TIPO_LABELS[caso.tipoeCF] ?? `Tipo ${caso.tipoeCF}`,
    fechaEmision:    caso.fechaEmision,
    fechaHoraFirma:  fhfMatch?.[1],
    rncComprador:    caso.rncComprador,
    nombreComprador: caso.razonSocialComprador,
    items: caso.items.map(it => ({
      descripcion:    it.nombre,
      cantidad:       it.cantidad,
      precioUnitario: it.precioUnitario,
      valor:          it.montoItem,
    })),
    montoGravadoTotal: t.montoGravadoTotal,
    itbisTotal:        t.totalITBIS,
    montoExentoTotal:  t.montoExento,
    montoTotal:        t.montoTotal,
  };

  const pdfPath = resolve(pdfDir, `${caso.rncEmisor}${caso.encf}.pdf`);
  await generarRepresentacionImpresa(input, pdfPath);
  console.log(`   [PDF] ${pdfPath}`);
}

// ─── Envío + polling ──────────────────────────────────────────────────────────

async function enviarYConsultar(
  caso: CasoTest,
  token: string,
  signedXml: string,
): Promise<DgiiResultadoResponse | null> {
  try {
    const recepcion = await enviarECF(signedXml, token, { env: ENV });
    if (!recepcion.trackId) {
      console.log(`❌ [E${caso.tipoeCF}] ${caso.encf} — Sin trackId: ${recepcion.mensaje ?? recepcion.error ?? '?'}`);
      return null;
    }
    console.log(`   → trackId: ${recepcion.trackId} — consultando...`);
    const resultado = await consultarEstado(recepcion.trackId, token, { env: ENV });
    const icon = resultado?.estado === 'Aceptado' ? '✅' :
                 resultado?.estado === 'AceptadoCondicional' ? '⚠️ ' : '❌';
    console.log(`${icon} [E${caso.tipoeCF}] ${caso.encf} — estado: ${resultado?.estado} | codigo: ${resultado?.codigo}`);
    console.log(`   encf: ${resultado?.encf} | rnc: ${resultado?.rnc} | fechaRecepcion: ${resultado?.fechaRecepcion}`);
    if (resultado?.mensajes?.length) {
      resultado.mensajes.forEach(m => console.log(`   mensaje [${m.codigo}]: "${m.valor}"`));
    }
    if (resultado?.estado !== 'Aceptado' && resultado?.estado !== 'AceptadoCondicional') {
      console.log(`   raw: ${JSON.stringify(resultado)}`);
    }
    return resultado;
  } catch (err) {
    if (err instanceof DgiiApiError) {
      console.log(`❌ [E${caso.tipoeCF}] ${caso.encf} — HTTP ${err.statusCode ?? '?'}: ${err.body || err.message}`);
    } else {
      console.log(`❌ [E${caso.tipoeCF}] ${caso.encf} — ${(err as Error).message}`);
    }
    return null;
  }
}

// ─── Aborto en caso de rechazo o error ───────────────────────────────────────

function abortarSiNoAceptado(resultado: DgiiResultadoResponse | null, encf: string): void {
  if (!resultado) {
    console.error(`\n⛔ ERROR EN ${encf} — abortando. Corrija el error antes de reintentar.`);
    process.exit(1);
  }
  if (resultado.estado === 'Rechazado') {
    console.error(`\n⛔ RECHAZO EN ${encf} — abortando. Este eNCF no puede reutilizarse.`);
    console.error('   Corrija el problema y use el siguiente número de secuencia.');
    process.exit(1);
  }
}

function abortarSiRechazadoFC(resultado: DgiiRecepcionFCResponse | null, encf: string): void {
  if (!resultado) {
    console.error(`\n⛔ ERROR EN RFCE ${encf} — abortando.`);
    process.exit(1);
  }
  if (resultado.estado?.toLowerCase().includes('rechaz')) {
    console.error(`\n⛔ RECHAZO EN RFCE ${encf} — abortando. Este eNCF no puede reutilizarse.`);
    process.exit(1);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!CERT_PATH || !PASSPHRASE) {
    console.error('Faltan variables: DGII_CERT_PATH y DGII_CERT_PASSPHRASE en .env');
    process.exit(1);
  }

  console.log('\n🔐 Autenticando con la DGII...');
  let token: string;
  let tokenTs = 0;
  try {
    token = await autenticar({ certPath: CERT_PATH, passphrase: PASSPHRASE, env: ENV });
    tokenTs = Date.now();
    console.log('   Token obtenido ✅');
  } catch (err) {
    console.error(`❌ Error de autenticación: ${(err as Error).message}`);
    process.exit(1);
  }

  async function refreshTokenIfNeeded(): Promise<void> {
    if (Date.now() - tokenTs < 50 * 60 * 1000) return;
    console.log('\n🔄 Token próximo a vencer — re-autenticando...');
    token = await autenticar({ certPath: CERT_PATH, passphrase: PASSPHRASE, env: ENV });
    tokenTs = Date.now();
    console.log('   Token renovado ✅');
  }

  const outputDir = resolve(__dirname, '../dgii-cert/output');
  const pdfDir    = resolve(outputDir, 'pdfs');
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(pdfDir,    { recursive: true });

  const registro = cargarRegistro();
  const totalRegistrados = Object.keys(registro).length;
  if (totalRegistrados > 0) {
    console.log(`\n📋 Registro: ${totalRegistrados} eNCFs previos cargados de encfs-usados.json`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FASE 1 — Envío directo
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('FASE 1 — E31, E32≥250K, E41, E43, E44, E45, E46, E47');
  console.log('═'.repeat(70));

  const fase1Grupos = [
    { label: 'E-CF Tipo 31 — Factura Crédito Fiscal',   casos: CASOS_E31 },
    { label: 'E-CF Tipo 32 — Factura Consumo ≥250K',    casos: CASOS_E32_FLUJO_A },
    { label: 'E-CF Tipo 41 — Comprobante de Gastos',    casos: CASOS_E41 },
    { label: 'E-CF Tipo 43 — Gastos Menores',           casos: CASOS_E43 },
    { label: 'E-CF Tipo 44 — Regímenes Especiales',     casos: CASOS_E44 },
    { label: 'E-CF Tipo 45 — Gubernamental',            casos: CASOS_E45 },
    { label: 'E-CF Tipo 46 — Exportaciones',            casos: CASOS_E46 },
    { label: 'E-CF Tipo 47 — Pagos al Exterior',        casos: CASOS_E47 },
  ];

  for (const { label, casos } of fase1Grupos) {
    console.log(`\n── ${label} ──`);
    for (const caso of casos) {
      await refreshTokenIfNeeded();
      verificarNoUsado(caso.encf, registro);
      process.stdout.write(`   ${caso.encf}... firmando... `);

      let signedXml: string;
      try {
        signedXml = firmar(buildECFXml(caso));
        process.stdout.write('enviando... ');
      } catch (err) {
        console.log(`\n❌ Error de firma: ${(err as Error).message}`);
        console.error(`\n⛔ FALLO EN ${caso.encf} — abortando.`);
        process.exit(1);
      }

      const resultado = await enviarYConsultar(caso, token, signedXml);
      registrarEncf(caso.encf, caso.tipoeCF, resultado?.estado ?? 'Error', registro, {
        trackId: resultado?.trackId,
        mensajes: resultado?.mensajes?.map(m => `[${m.codigo}] ${m.valor}`) ?? [],
      });
      abortarSiNoAceptado(resultado, caso.encf);
      guardarAceptado(caso, signedXml, resultado?.estado ?? 'Aceptado', resultado?.trackId ?? null);
      await guardarPDF(caso, signedXml, pdfDir);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FASE 2 — E33 y E34 (requieren que sus referencias estén ya en DGII)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n   ⏳ Esperando 120s para que los e-CFs de Fase 1 se indexen en DGII...');
  await new Promise(resolve => setTimeout(resolve, 120000));

  console.log('\n' + '═'.repeat(70));
  console.log('FASE 2 — E33 (Nota Débito) y E34 (Notas Crédito)');
  console.log('═'.repeat(70));

  for (const caso of [...CASOS_E33, ...CASOS_E34]) {
    await refreshTokenIfNeeded();
    verificarNoUsado(caso.encf, registro);
    process.stdout.write(`\n   ${caso.encf} (ref: ${caso.ncfModificado})... firmando... `);

    let signedXml: string;
    try {
      signedXml = firmar(buildECFXml(caso));
      process.stdout.write('enviando... ');
    } catch (err) {
      console.log(`\n❌ Error de firma: ${(err as Error).message}`);
      console.error(`\n⛔ FALLO EN ${caso.encf} — abortando.`);
      process.exit(1);
    }

    const resultado = await enviarYConsultar(caso, token, signedXml);
    registrarEncf(caso.encf, caso.tipoeCF, resultado?.estado ?? 'Error', registro, {
      trackId: resultado?.trackId,
      mensajes: resultado?.mensajes?.map(m => `[${m.codigo}] ${m.valor}`) ?? [],
    });
    abortarSiNoAceptado(resultado, caso.encf);
    guardarAceptado(caso, signedXml, resultado?.estado ?? 'Aceptado', resultado?.trackId ?? null);
    await guardarPDF(caso, signedXml, pdfDir);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FASES 3+4 — RFCE-32 <250K + E32 completo XML para portal
  //   1. Firmar E32 completo → extraer primeros 6 chars SignatureValue
  //   2. Construir y firmar RFCE con ese CodigoSeguridadeCF
  //   3. Enviar RFCE a fc.dgii.gov.do (sincrónico)
  //   4. Guardar E32 firmado en disco + generar PDF
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('FASES 3+4 — RFCE-32 <250K + E32 XML para portal');
  console.log('═'.repeat(70));

  for (const caso of CASOS_RFCE32) {
    await refreshTokenIfNeeded();
    verificarNoUsado(caso.encf, registro);
    console.log(`\n── ${caso.encf} (MontoTotal: ${caso.totales.montoTotal.toFixed(2)}) ──`);

    // Paso 1: firmar E32 completo y extraer CodigoSeguridadeCF
    let signedE32: string;
    let codigoSeguridad: string;
    try {
      process.stdout.write('   [1/4] Firmando E32... ');
      signedE32 = firmar(buildECFXml(caso));
      const svMatch = signedE32.match(/<SignatureValue[^>]*>([A-Za-z0-9+/=]+)/);
      codigoSeguridad = svMatch ? svMatch[1].slice(0, 6) : '??????';
      console.log(`OK  CodigoSeguridadeCF="${codigoSeguridad}"`);
    } catch (err) {
      console.error(`\n⛔ Error firmando E32 ${caso.encf}: ${(err as Error).message} — abortando.`);
      process.exit(1);
    }

    // Paso 2-3: firmar RFCE y enviarlo
    let rfceXml: string;
    try {
      process.stdout.write('   [2/4] Firmando RFCE... ');
      rfceXml = firmar(buildRFCEXml(caso, codigoSeguridad), 'RFCE');
      console.log('OK');
    } catch (err) {
      console.error(`\n⛔ Error firmando RFCE ${caso.encf}: ${(err as Error).message} — abortando.`);
      process.exit(1);
    }

    process.stdout.write('   [3/4] Enviando RFCE a fc.dgii.gov.do... ');
    let fcResp: DgiiRecepcionFCResponse | null = null;
    try {
      fcResp = await enviarResumenFC(rfceXml, token, { env: ENV });
      const icon = fcResp.estado?.toLowerCase().includes('aceptad') ? '✅' : '❌';
      console.log(`\n   ${icon} ${fcResp.estado} (código ${fcResp.codigo})`);
      fcResp.mensajes?.forEach(m => console.log(`      [${m.codigo}] ${m.valor}`));
    } catch (err) {
      console.log(`\n   ❌ ${(err as Error).message}`);
    }
    registrarEncf(caso.encf, 32, fcResp?.estado ?? 'Error-FC', registro, {
      mensajes: fcResp?.mensajes?.map(m => `[${m.codigo}] ${m.valor}`) ?? [],
    });
    abortarSiRechazadoFC(fcResp, caso.encf);

    // Paso 4: guardar E32 XML en disco, registrar en aceptados.json y generar PDF
    const xmlPath = resolve(outputDir, `${caso.rncEmisor}${caso.encf}.xml`);
    writeFileSync(xmlPath, signedE32, 'utf-8');
    console.log(`   [4/4] E32 XML → ${xmlPath}`);
    // Guardar en aceptados.json con el CodigoSeguridad del E32 firmado (usado en RFCE y en QR)
    guardarAceptado(caso, signedE32, fcResp?.estado ?? 'Aceptado-FC', null);
    await guardarPDF(caso, signedE32, pdfDir);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✅ Simulación completada sin rechazos.');
  console.log(`   XMLs firmados: dgii-cert/output/xmls-aceptados/`);
  console.log(`   Registro:      dgii-cert/output/aceptados.json`);
  console.log(`   PDFs:          dgii-cert/output/pdfs/`);
  console.log('   Sube los E32 XML del portal y los PDFs de Fase 4 al certecf.');
  console.log('═'.repeat(70));
}

main().catch(err => {
  console.error('\n💥 Error fatal:', err);
  process.exit(1);
});
