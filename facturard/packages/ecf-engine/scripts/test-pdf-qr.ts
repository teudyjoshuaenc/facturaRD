/**
 * Script de verificación: genera PDFs de ejemplo y muestra
 * la URL exacta que queda codificada en el QR de cada uno.
 *
 * Uso: pnpm --filter @facturard/ecf-engine test:pdf
 */
import { generarRepresentacionImpresa } from '../src/pdf'
import type { EcfPdfInput } from '../src/pdf'
import QRCode from 'qrcode'
import { join } from 'path'

// Reimplementamos buildQrUrl localmente para leer la URL sin escribir PDF
function buildQrUrl(ecf: EcfPdfInput): string {
  const ambiente = ecf.ambiente ?? 'certecf'
  const tipoCode = ecf.tipoECF.replace(/^[Ee]/, '')
  const isRfce = tipoCode === '32' && ecf.montoTotal < 250_000

  const base = isRfce
    ? `https://fc.dgii.gov.do/${ambiente}/consultatimbrefc`
    : `https://ecf.dgii.gov.do/${ambiente}/consultatimbre`

  const params: [string, string][] = [['rncemisor', ecf.rncEmisor]]
  if (!isRfce) params.push(['rnccomprador', ecf.rncComprador ?? ''])
  params.push(
    ['encf', ecf.eNCF.toLowerCase()],
    ['fechaemision', ecf.fechaEmision],
    ['montototal', ecf.montoTotal.toFixed(2)],
  )
  if (ecf.fechaHoraFirma) params.push(['fechafirma', ecf.fechaHoraFirma])
  if (ecf.codigoSeguridad) params.push(['codigoseguridad', ecf.codigoSeguridad])

  const query = params
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/\+/g, '%20')}`)
    .join('&')
  return `${base}?${query}`
}

const E31_INPUT: EcfPdfInput = {
  rncEmisor: '132883225',
  nombreEmisor: 'DMAIA AI Solutions SRL',
  nombreComercial: 'DMAIA',
  eNCF: 'E310000000200',
  tipoECF: 'E31',
  fechaEmision: '14-05-2026',
  fechaVencimiento: '31-12-2028',
  fechaHoraFirma: '14-05-2026 20:04:50',
  codigoSeguridad: 'zbhajb',
  ambiente: 'certecf',
  rncComprador: '131880681',
  nombreComprador: 'EMPRESA TEST SRL',
  items: [
    {
      descripcion: 'Servicio de facturación electrónica',
      cantidad: 1,
      precioUnitario: 5000,
      valor: 5000,
    },
  ],
  montoTotal: 5900,
  itbisTotal: 900,
  montoGravadoTotal: 5000,
}

// E32 < 250K → RFCE route (fc.dgii.gov.do)
const E32_RFCE_INPUT: EcfPdfInput = {
  rncEmisor: '132883225',
  nombreEmisor: 'DMAIA AI Solutions SRL',
  eNCF: 'E320000000001',
  tipoECF: 'E32',
  fechaEmision: '14-05-2026',
  fechaHoraFirma: '14-05-2026 20:10:00',
  codigoSeguridad: 'abc123',
  ambiente: 'certecf',
  nombreComprador: 'Consumidor Final',
  items: [
    { descripcion: 'Producto', cantidad: 2, precioUnitario: 500, valor: 1000 },
  ],
  montoTotal: 1180,
  itbisTotal: 180,
  montoGravadoTotal: 1000,
}

// E32 ≥ 250K → recepcion route (ecf.dgii.gov.do)
const E32_FULL_INPUT: EcfPdfInput = {
  ...E32_RFCE_INPUT,
  eNCF: 'E320000000002',
  montoTotal: 295_400,
  montoGravadoTotal: 250_000,
  itbisTotal: 45_000,
  codigoSeguridad: 'def456',
}

async function run(): Promise<void> {
  const outDir = '/tmp/pdfs/test'

  const cases: { label: string; input: EcfPdfInput; path: string }[] = [
    { label: 'E31 (certecf)',            input: E31_INPUT,      path: join(outDir, 'e31-test.pdf') },
    { label: 'E32 < 250K RFCE (certecf)', input: E32_RFCE_INPUT, path: join(outDir, 'e32-rfce-test.pdf') },
    { label: 'E32 ≥ 250K (certecf)',     input: E32_FULL_INPUT, path: join(outDir, 'e32-full-test.pdf') },
  ]

  for (const { label, input, path } of cases) {
    await generarRepresentacionImpresa(input, path)
    const url = buildQrUrl(input)
    console.log(`\n──────────────────────────────────────────`)
    console.log(`${label}`)
    console.log(`PDF: ${path}`)
    console.log(`QR URL:`)
    console.log(url)
  }

  console.log('\n✅ PDFs generados correctamente')
}

void run().catch((e) => { console.error(e); process.exit(1) })
