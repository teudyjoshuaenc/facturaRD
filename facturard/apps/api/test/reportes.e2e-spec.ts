import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma, TipoECF, ComprobanteEstado } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, TestTenant } from './helpers/factory'

// e2e Sprint 8 (TXT oficial) — Reportes 606/607/608 delimitados por pipe.
describe('Reportes DGII — TXT oficial (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenantA: TestTenant
  let tenantB: TestTenant
  let seq = 0

  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })
  const DESDE = '2026-05-01'
  const HASTA = '2026-05-31'
  const PERIODO = '202605'

  interface Item { indicadorFacturacion: string; precioUnitarioItem: number; cantidad?: number }
  async function venta(tenantId: string, tipoECF: TipoECF, estado: ComprobanteEstado, createdAt: Date, items: Item[], tipoPago = 1) {
    const base = items.reduce((s, it) => s + (it.cantidad ?? 1) * it.precioUnitarioItem, 0)
    const itbis = items.reduce((s, it) => s + (it.indicadorFacturacion === 'I1' ? (it.cantidad ?? 1) * it.precioUnitarioItem * 0.18 : 0), 0)
    const datosItems = items.map((it, i) => ({
      numeroLinea: i + 1, nombreItem: `Item ${i}`, cantidad: it.cantidad ?? 1,
      precioUnitarioItem: it.precioUnitarioItem, indicadorFacturacion: it.indicadorFacturacion, indicadorBienoServicio: 2,
    }))
    return prisma.comprobante.create({
      data: {
        tenantId, eNCF: `E${tipoECF.slice(1)}${String(++seq).padStart(10, '0')}`, tipoECF, estado,
        montoTotal: base + itbis, rnc: '131880681', razonSocial: 'CLIENTE SRL', createdAt,
        datos: { tipoECF, fechaEmision: '15-05-2026', tipoIngresos: '01', tipoPago, rncComprador: '131880681', razonSocialComprador: 'CLIENTE SRL', items: datosItems },
      },
    })
  }

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
    tenantA = await createTenant()
    tenantB = await createTenant()

    // 607 detalle: E31 (contado) + E32 grande >=250K (crédito). E32 chico <250K → consumo (excluido). + excluidos
    await venta(tenantA.tenant.id, 'E31', 'ACEPTADO', new Date('2026-05-10T12:00:00-04:00'), [{ indicadorFacturacion: 'I1', precioUnitarioItem: 1000 }], 1)
    await venta(tenantA.tenant.id, 'E32', 'ACEPTADO', new Date('2026-05-12T12:00:00-04:00'), [{ indicadorFacturacion: 'I1', precioUnitarioItem: 300000 }], 2)
    await venta(tenantA.tenant.id, 'E32', 'ACEPTADO', new Date('2026-05-13T12:00:00-04:00'), [{ indicadorFacturacion: 'I1', precioUnitarioItem: 2000 }], 1) // consumo <250K
    await venta(tenantA.tenant.id, 'E31', 'PENDIENTE', new Date('2026-05-14T12:00:00-04:00'), [{ indicadorFacturacion: 'I1', precioUnitarioItem: 9999 }])
    await venta(tenantA.tenant.id, 'E31', 'ACEPTADO', new Date('2026-06-01T10:00:00-04:00'), [{ indicadorFacturacion: 'I1', precioUnitarioItem: 7777 }]) // fuera de rango

    // 606
    await prisma.compraRecibida.create({ data: { tenantId: tenantA.tenant.id, tipo: 'E41', origen: 'MANUAL', ncf: 'E410000000001', rncProveedor: '130111222', subtotal: 1000, itbis: 180, itbisRetenido: 0, total: 1180, fechaComprobante: new Date('2026-05-05T10:00:00-04:00') } })
    await prisma.compraRecibida.create({ data: { tenantId: tenantA.tenant.id, tipo: 'GASTO_MENOR', origen: 'MANUAL', ncf: 'B0100000005', rncProveedor: '00112345678', subtotal: 500, itbis: 90, itbisRetenido: 10, total: 590, fechaComprobante: new Date('2026-05-20T10:00:00-04:00') } })
    await prisma.compraRecibida.create({ data: { tenantId: tenantA.tenant.id, tipo: 'E41', origen: 'MANUAL', subtotal: 3333, itbis: 0, itbisRetenido: 0, total: 3333, fechaComprobante: new Date('2026-06-02T10:00:00-04:00') } }) // fuera
  })

  afterAll(async () => { await app.close() })

  const getTxt = (t: TestTenant, formato: '606' | '607' | '608', desde = DESDE, hasta = HASTA) =>
    request(app.getHttpServer()).get(`/api/v1/reportes/${formato}?desde=${desde}&hasta=${hasta}&formato=txt`).set(auth(t))

  // ── 607 ───────────────────────────────────────────────────────────────────
  it('607: encabezado, conteo, orden de campos y consumo excluido del detalle', async () => {
    const res = await getTxt(tenantA, '607').expect(200)
    expect(res.headers['content-type']).toContain('text/plain')
    expect(res.headers['content-disposition']).toContain(`DGII_F_607_${tenantA.tenant.rnc}_${PERIODO}.TXT`)

    const lines = res.text.split('\n')
    const header = lines[0].split('|')
    expect(header).toEqual([tenantA.tenant.rnc, '607', PERIODO, '2']) // E31 + E32 grande (consumo excluido)
    const detalle = lines.slice(1)
    expect(detalle).toHaveLength(2)
    expect(Number(header[3])).toBe(detalle.length)

    // 23 campos por línea = 22 pipes
    for (const l of detalle) expect(l.split('|')).toHaveLength(23)

    // Orden: la factura E31 → eNCF en campo 3 (idx 2), base en 8 (idx 7), ITBIS en 9 (idx 8)
    const e31 = detalle.map((l) => l.split('|')).find((f) => f[2].startsWith('E31'))!
    expect(e31[2]).toMatch(/^E31\d{10}$/)
    expect(e31[7]).toBe('1000.00')
    expect(e31[8]).toBe('180.00')
    expect(e31[5]).toBe('20260515') // fecha AAAAMMDD
    expect(e31[16]).toBe('1180.00') // campo 17 Efectivo (contado) = total con impuestos
    expect(e31[19]).toBe('') // campo 20 Venta a Crédito vacío
    expect(res.text).toContain('||') // hay campos vacíos como ||

    // E32 grande (crédito): total con impuestos en campo 20
    const e32 = detalle.map((l) => l.split('|')).find((f) => f[2].startsWith('E32'))!
    expect(e32[19]).toBe('354000.00') // 300000 + 54000
    expect(e32[16]).toBe('') // efectivo vacío
  })

  it('607 json: resumen de consumo separado, NO en el detalle', async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/reportes/607?desde=${DESDE}&hasta=${HASTA}`).set(auth(tenantA)).expect(200)
    expect(res.body.totales.registros).toBe(2)
    expect(res.body.totales.montoFacturado).toBe(301000) // 1000 + 300000
    expect(res.body.resumenConsumo).toEqual({ cantidad: 1, montoTotal: 2360 }) // E32 chico
    // el e-NCF del consumo no está en el detalle
    const consumoEncf = res.body.rows.map((r: { ncf: string; tipoECF: string }) => r).filter((r: { tipoECF: string }) => r.tipoECF === 'E32')
    expect(consumoEncf.every((r: { montoFacturado: number }) => r.montoFacturado >= 250000)).toBe(true)
  })

  // ── 606 ───────────────────────────────────────────────────────────────────
  it('606: encabezado, 23 campos, proveedor en 1 y NCF en 4', async () => {
    const res = await getTxt(tenantA, '606').expect(200)
    expect(res.headers['content-disposition']).toContain(`DGII_F_606_${tenantA.tenant.rnc}_${PERIODO}.TXT`)
    const lines = res.text.split('\n')
    expect(lines[0].split('|')).toEqual([tenantA.tenant.rnc, '606', PERIODO, '2'])
    const detalle = lines.slice(1)
    expect(detalle).toHaveLength(2)
    for (const l of detalle) expect(l.split('|')).toHaveLength(23)

    const f = detalle[0].split('|') // primera compra: RNC 130111222
    expect(f[0]).toBe('130111222') // campo 1 proveedor
    expect(f[1]).toBe('1') // tipo id RNC (9 díg)
    expect(f[2]).toBe('09') // tipo bienes default
    expect(f[3]).toBe('E410000000001') // campo 4 NCF
    expect(f[8]).toBe('1000.00') // campo 9 bienes
    expect(f[9]).toBe('1000.00') // campo 10 total
    expect(f[10]).toBe('180.00') // campo 11 ITBIS
    expect(f[22]).toBe('1') // campo 23 forma pago default

    // compra con cédula (11 díg) e ITBIS retenido → campo 12 y fecha pago (7)
    const conRet = detalle.map((l) => l.split('|')).find((c) => c[0] === '00112345678')!
    expect(conRet[1]).toBe('2') // cédula
    expect(conRet[11]).toBe('10.00') // campo 12 ITBIS retenido
    expect(conRet[6]).toBe('20260520') // campo 7 fecha pago (por retención)
  })

  // ── 608 ───────────────────────────────────────────────────────────────────
  it('608: comprobante anulado (nota codigoModificacion=1), NCF en 1 y tipo anulación en 3', async () => {
    const src = await venta(tenantA.tenant.id, 'E31', 'ACEPTADO', new Date('2026-05-15T10:00:00-04:00'), [{ indicadorFacturacion: 'I1', precioUnitarioItem: 4000 }])
    await prisma.comprobante.create({
      data: {
        tenantId: tenantA.tenant.id, eNCF: `E34${String(++seq).padStart(10, '0')}`, tipoECF: 'E34', estado: 'ACEPTADO',
        montoTotal: 4720, rnc: '131880681', razonSocial: 'CLIENTE SRL', comprobanteReferenciaId: src.id, createdAt: new Date('2026-05-16T10:00:00-04:00'),
        datos: { tipoECF: 'E34', fechaEmision: '16-05-2026', codigoModificacion: 1, items: [{ numeroLinea: 1, nombreItem: 'x', cantidad: 1, precioUnitarioItem: 4000, indicadorFacturacion: 'I1', indicadorBienoServicio: 2 }] },
      },
    })

    const res = await getTxt(tenantA, '608').expect(200)
    const lines = res.text.split('\n')
    expect(lines[0].split('|')).toEqual([tenantA.tenant.rnc, '608', PERIODO, '1'])
    const f = lines[1].split('|')
    expect(f).toHaveLength(3) // 3 campos
    expect(f[0]).toBe(src.eNCF) // campo 1 NCF anulado
    expect(f[1]).toBe('20260515') // campo 2 fecha
    expect(f[2]).toBe('4') // campo 3 tipo anulación (Corrección de la información)
  })

  // ── Modo "en cero" ──────────────────────────────────────────────────────────
  it('modo en cero: encabezado con cantidad=0 y sin líneas de detalle (los 3 formatos)', async () => {
    for (const formato of ['606', '607', '608'] as const) {
      const res = await getTxt(tenantA, formato, '2026-01-01', '2026-01-31').expect(200)
      const lines = res.text.split('\n')
      expect(lines).toHaveLength(1) // sólo encabezado
      expect(lines[0].split('|')).toEqual([tenantA.tenant.rnc, formato, '202601', '0'])
    }
  })

  // ── Aislamiento + validación ────────────────────────────────────────────────
  it('aislamiento multi-tenant: B ve todo en cero', async () => {
    const r607 = await request(app.getHttpServer()).get(`/api/v1/reportes/607?desde=${DESDE}&hasta=${HASTA}`).set(auth(tenantB)).expect(200)
    expect(r607.body.totales.registros).toBe(0)
    const txt = await getTxt(tenantB, '606').expect(200)
    expect(txt.text.split('\n')).toHaveLength(1)
  })

  it('desde/hasta faltantes → 400', async () => {
    await request(app.getHttpServer()).get('/api/v1/reportes/607').set(auth(tenantA)).expect(400)
  })
})
