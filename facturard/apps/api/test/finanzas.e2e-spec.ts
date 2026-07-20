import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma, TipoECF, ComprobanteEstado } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, TestTenant } from './helpers/factory'

// e2e Sprint 13 — Finanzas (flujo de caja: ingresos/egresos, pagos, capital).
// Módulo 100% de lectura sobre lo fiscal + tablas propias. NO toca el ciclo DGII.
describe('Finanzas (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenantA: TestTenant
  let tenantB: TestTenant

  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })
  const srv = () => app.getHttpServer()

  let encfSeq = 0
  // Crea un comprobante directamente por prisma (el módulo sólo lo LEE).
  async function mkComprobante(
    t: TestTenant,
    opts: { tipoECF?: TipoECF; estado?: ComprobanteEstado; montoTotal: number; createdAt: Date; esFiscal?: boolean },
  ) {
    const tipoECF = opts.tipoECF ?? 'E31'
    return prisma.comprobante.create({
      data: {
        tenantId: t.tenant.id,
        eNCF: `${tipoECF.slice(1)}${String(++encfSeq).padStart(10, '0')}`,
        tipoECF,
        estado: opts.estado ?? 'ACEPTADO',
        esFiscal: opts.esFiscal ?? true,
        montoTotal: opts.montoTotal,
        rnc: '131880681',
        razonSocial: 'CLIENTE SRL',
        createdAt: opts.createdAt,
      },
    })
  }

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
    tenantA = await createTenant()
    tenantB = await createTenant()
  })

  afterAll(async () => { await app.close() })

  // ─── MOVIMIENTOS MANUALES ────────────────────────────────────────────────
  describe('Movimientos manuales', () => {
    it('CRUD completo', async () => {
      const created = await request(srv())
        .post('/api/v1/finanzas/movimientos')
        .set(auth(tenantA))
        .send({ tipo: 'EGRESO', categoria: 'NOMINA', monto: 15000, fecha: '2026-06-05', descripcion: 'Quincena' })
        .expect(201)
      expect(created.body.tipo).toBe('EGRESO')
      expect(Number(created.body.monto)).toBe(15000)
      const id = created.body.id

      await request(srv()).get(`/api/v1/finanzas/movimientos/${id}`).set(auth(tenantA)).expect(200)

      const list = await request(srv())
        .get('/api/v1/finanzas/movimientos?tipo=EGRESO&categoria=NOMINA')
        .set(auth(tenantA))
        .expect(200)
      expect(list.body.data.some((m: { id: string }) => m.id === id)).toBe(true)
      expect(list.body.total).toBeGreaterThanOrEqual(1)

      const upd = await request(srv())
        .patch(`/api/v1/finanzas/movimientos/${id}`)
        .set(auth(tenantA))
        .send({ monto: 16000 })
        .expect(200)
      expect(Number(upd.body.monto)).toBe(16000)

      await request(srv()).delete(`/api/v1/finanzas/movimientos/${id}`).set(auth(tenantA)).expect(200)
      await request(srv()).get(`/api/v1/finanzas/movimientos/${id}`).set(auth(tenantA)).expect(404)
    })

    it('tenant isolation → otro tenant ve 404', async () => {
      const created = await request(srv())
        .post('/api/v1/finanzas/movimientos')
        .set(auth(tenantA))
        .send({ tipo: 'INGRESO', categoria: 'OTROS', monto: 100, fecha: '2026-06-05' })
        .expect(201)
      const id = created.body.id
      await request(srv()).get(`/api/v1/finanzas/movimientos/${id}`).set(auth(tenantB)).expect(404)
      await request(srv()).patch(`/api/v1/finanzas/movimientos/${id}`).set(auth(tenantB)).send({ monto: 1 }).expect(404)
      await request(srv()).delete(`/api/v1/finanzas/movimientos/${id}`).set(auth(tenantB)).expect(404)
    })

    it('validaciones: monto positivo, tipo/categoría válidos', async () => {
      await request(srv()).post('/api/v1/finanzas/movimientos').set(auth(tenantA))
        .send({ tipo: 'EGRESO', categoria: 'NOMINA', monto: -5, fecha: '2026-06-05' }).expect(400)
      await request(srv()).post('/api/v1/finanzas/movimientos').set(auth(tenantA))
        .send({ tipo: 'EGRESO', categoria: 'NOMINA', monto: 0, fecha: '2026-06-05' }).expect(400)
      await request(srv()).post('/api/v1/finanzas/movimientos').set(auth(tenantA))
        .send({ tipo: 'INVALIDO', categoria: 'NOMINA', monto: 10, fecha: '2026-06-05' }).expect(400)
      await request(srv()).post('/api/v1/finanzas/movimientos').set(auth(tenantA))
        .send({ tipo: 'EGRESO', categoria: 'NO_EXISTE', monto: 10, fecha: '2026-06-05' }).expect(400)
    })
  })

  // ─── PAGOS / COBROS ──────────────────────────────────────────────────────
  describe('Pagos / cobros', () => {
    it('registrar cobro NO modifica el estado DGII de la factura (assert explícito)', async () => {
      const factura = await mkComprobante(tenantA, { montoTotal: 1000, createdAt: new Date('2026-06-10T10:00:00-04:00') })
      const antes = await prisma.comprobante.findUniqueOrThrow({ where: { id: factura.id } })

      await request(srv()).post('/api/v1/finanzas/pagos').set(auth(tenantA))
        .send({ tipo: 'COBRO', comprobanteId: factura.id, monto: 400, fecha: '2026-06-11' }).expect(201)

      const despues = await prisma.comprobante.findUniqueOrThrow({ where: { id: factura.id } })
      expect(despues.estado).toBe(antes.estado)
      expect(despues.eNCF).toBe(antes.eNCF)
      expect(despues.trackId).toBe(antes.trackId)
      expect(despues.updatedAt.getTime()).toBe(antes.updatedAt.getTime()) // ni siquiera se tocó la fila
    })

    it('pagos parciales: 3 abonos sobre factura de 1000 → saldo pendiente correcto', async () => {
      const f = await mkComprobante(tenantA, { montoTotal: 1000, createdAt: new Date('2026-06-10T10:00:00-04:00') })
      for (const monto of [300, 300, 400]) {
        await request(srv()).post('/api/v1/finanzas/pagos').set(auth(tenantA))
          .send({ tipo: 'COBRO', comprobanteId: f.id, monto, fecha: '2026-06-12' }).expect(201)
      }
      const saldo = await request(srv())
        .get(`/api/v1/finanzas/saldo?comprobanteId=${f.id}`).set(auth(tenantA)).expect(200)
      expect(saldo.body.montoTotal).toBe(1000)
      expect(saldo.body.pagado).toBe(1000)
      expect(saldo.body.saldoPendiente).toBe(0)

      const pagos = await request(srv())
        .get(`/api/v1/finanzas/pagos?comprobanteId=${f.id}`).set(auth(tenantA)).expect(200)
      expect(pagos.body).toHaveLength(3)
    })

    it('no permite cobrar más del monto (sobrepago → 400)', async () => {
      const f = await mkComprobante(tenantA, { montoTotal: 1000, createdAt: new Date('2026-06-10T10:00:00-04:00') })
      await request(srv()).post('/api/v1/finanzas/pagos').set(auth(tenantA))
        .send({ tipo: 'COBRO', comprobanteId: f.id, monto: 600, fecha: '2026-06-12' }).expect(201)
      await request(srv()).post('/api/v1/finanzas/pagos').set(auth(tenantA))
        .send({ tipo: 'COBRO', comprobanteId: f.id, monto: 500, fecha: '2026-06-12' }).expect(400)
      const saldo = await request(srv())
        .get(`/api/v1/finanzas/saldo?comprobanteId=${f.id}`).set(auth(tenantA)).expect(200)
      expect(saldo.body.saldoPendiente).toBe(400)
    })

    it('no se puede cobrar un borrador (DRAFT → 400)', async () => {
      const draft = await mkComprobante(tenantA, { estado: 'DRAFT', montoTotal: 500, createdAt: new Date('2026-06-10T10:00:00-04:00') })
      await request(srv()).post('/api/v1/finanzas/pagos').set(auth(tenantA))
        .send({ tipo: 'COBRO', comprobanteId: draft.id, monto: 100, fecha: '2026-06-12' }).expect(400)
    })

    it('coherencia tipo↔documento (COBRO exige comprobanteId; PAGO exige compraId)', async () => {
      await request(srv()).post('/api/v1/finanzas/pagos').set(auth(tenantA))
        .send({ tipo: 'COBRO', monto: 100, fecha: '2026-06-12' }).expect(400)
      await request(srv()).post('/api/v1/finanzas/pagos').set(auth(tenantA))
        .send({ tipo: 'PAGO', monto: 100, fecha: '2026-06-12' }).expect(400)
    })

    it('pago sobre compra + saldo; tenant isolation', async () => {
      const compra = await prisma.compraRecibida.create({
        data: { tenantId: tenantA.tenant.id, tipo: 'E41', subtotal: 2000, itbis: 360, total: 2360,
          fechaComprobante: new Date('2026-06-10T10:00:00-04:00') },
      })
      await request(srv()).post('/api/v1/finanzas/pagos').set(auth(tenantA))
        .send({ tipo: 'PAGO', compraId: compra.id, monto: 2360, fecha: '2026-06-13' }).expect(201)
      const saldo = await request(srv())
        .get(`/api/v1/finanzas/saldo?compraId=${compra.id}`).set(auth(tenantA)).expect(200)
      expect(saldo.body.saldoPendiente).toBe(0)

      // tenantB no puede pagar la compra de A (404) ni ve su saldo
      await request(srv()).post('/api/v1/finanzas/pagos').set(auth(tenantB))
        .send({ tipo: 'PAGO', compraId: compra.id, monto: 1, fecha: '2026-06-13' }).expect(404)
      await request(srv()).get(`/api/v1/finanzas/saldo?compraId=${compra.id}`).set(auth(tenantB)).expect(404)
    })

    it('tenant isolation en cobros y borrado de pagos', async () => {
      const f = await mkComprobante(tenantA, { montoTotal: 1000, createdAt: new Date('2026-06-10T10:00:00-04:00') })
      // B no puede cobrar la factura de A
      await request(srv()).post('/api/v1/finanzas/pagos').set(auth(tenantB))
        .send({ tipo: 'COBRO', comprobanteId: f.id, monto: 100, fecha: '2026-06-13' }).expect(404)
      // A cobra; B no puede borrar ese pago
      const pago = await request(srv()).post('/api/v1/finanzas/pagos').set(auth(tenantA))
        .send({ tipo: 'COBRO', comprobanteId: f.id, monto: 100, fecha: '2026-06-13' }).expect(201)
      await request(srv()).delete(`/api/v1/finanzas/pagos/${pago.body.id}`).set(auth(tenantB)).expect(404)
      await request(srv()).delete(`/api/v1/finanzas/pagos/${pago.body.id}`).set(auth(tenantA)).expect(200)
    })
  })

  // ─── CAPITAL Y RESUMEN ───────────────────────────────────────────────────
  describe('Capital y resumen', () => {
    const RANGO = 'desde=2026-05-01&hasta=2026-05-31'

    it('devengado vs cobrado DIFIEREN cuando hay facturas sin cobrar; capital acumulado distinto', async () => {
      const t = await createTenant()
      await request(srv()).put('/api/v1/finanzas/capital').set(auth(t))
        .send({ monto: 100000, fecha: '2026-01-01' }).expect(200)
      await mkComprobante(t, { montoTotal: 1000, createdAt: new Date('2026-05-10T10:00:00-04:00') })
      await request(srv()).post('/api/v1/finanzas/movimientos').set(auth(t))
        .send({ tipo: 'EGRESO', categoria: 'NOMINA', monto: 300, fecha: '2026-05-15' }).expect(201)
      await request(srv()).post('/api/v1/finanzas/movimientos').set(auth(t))
        .send({ tipo: 'INGRESO', categoria: 'APORTE_CAPITAL', monto: 500, fecha: '2026-05-16' }).expect(201)

      const r1 = (await request(srv()).get(`/api/v1/finanzas/resumen?${RANGO}`).set(auth(t)).expect(200)).body
      // Devengado: factura 1000 + aporte 500 = 1500 ingresos; egreso 300.
      expect(r1.devengado.ingresos).toBe(1500)
      expect(r1.devengado.ingresosFiscal).toBe(1000)
      expect(r1.devengado.egresos).toBe(300)
      expect(r1.devengado.balance).toBe(1200)
      // Cobrado: la factura NO está cobrada → sólo el aporte manual 500; egreso 300.
      expect(r1.cobrado.ingresos).toBe(500)
      expect(r1.cobrado.egresos).toBe(300)
      expect(r1.cobrado.balance).toBe(200)
      // Los totales DIFIEREN (hay factura sin cobrar).
      expect(r1.devengado.ingresos).not.toBe(r1.cobrado.ingresos)
      // Capital acumulado: 100000 + balance de cada vista.
      expect(r1.devengado.capitalAcumulado).toBe(101200)
      expect(r1.cobrado.capitalAcumulado).toBe(100200)
      expect(r1.devengado.capitalAcumulado).not.toBe(r1.cobrado.capitalAcumulado)

      // Al cobrar la factura (1000), la vista cobrado alcanza a la devengada.
      const factura = await prisma.comprobante.findFirstOrThrow({ where: { tenantId: t.tenant.id, esFiscal: true } })
      await request(srv()).post('/api/v1/finanzas/pagos').set(auth(t))
        .send({ tipo: 'COBRO', comprobanteId: factura.id, monto: 1000, fecha: '2026-05-20' }).expect(201)
      const r2 = (await request(srv()).get(`/api/v1/finanzas/resumen?${RANGO}`).set(auth(t)).expect(200)).body
      expect(r2.cobrado.ingresos).toBe(1500)
      expect(r2.cobrado.ingresos).toBe(r2.devengado.ingresos)
    })

    it('notas de crédito E34 NETEAN el ingreso fiscal', async () => {
      const t = await createTenant()
      await mkComprobante(t, { tipoECF: 'E31', montoTotal: 1000, createdAt: new Date('2026-05-10T10:00:00-04:00') })
      await mkComprobante(t, { tipoECF: 'E34', montoTotal: 200, createdAt: new Date('2026-05-11T10:00:00-04:00') })
      const r = (await request(srv()).get(`/api/v1/finanzas/resumen?${RANGO}`).set(auth(t)).expect(200)).body
      expect(r.devengado.ingresosFiscal).toBe(800) // 1000 − 200
    })

    it('nota de venta interna cuenta como ingreso pero distinguible del fiscal', async () => {
      const t = await createTenant()
      await mkComprobante(t, { tipoECF: 'E31', montoTotal: 1000, createdAt: new Date('2026-05-10T10:00:00-04:00') })
      await mkComprobante(t, { esFiscal: false, estado: 'INTERNO', montoTotal: 500, createdAt: new Date('2026-05-12T10:00:00-04:00') })
      const r = (await request(srv()).get(`/api/v1/finanzas/resumen?${RANGO}`).set(auth(t)).expect(200)).body
      expect(r.devengado.ingresosFiscal).toBe(1000)
      expect(r.devengado.ingresosNotaVenta).toBe(500)
      expect(r.devengado.ingresos).toBe(1500)
    })

    it('capital inicial: GET default 0, PUT lo setea (upsert)', async () => {
      const t = await createTenant()
      const g0 = (await request(srv()).get('/api/v1/finanzas/capital').set(auth(t)).expect(200)).body
      expect(Number(g0.monto)).toBe(0)
      await request(srv()).put('/api/v1/finanzas/capital').set(auth(t)).send({ monto: 50000, fecha: '2026-01-01' }).expect(200)
      await request(srv()).put('/api/v1/finanzas/capital').set(auth(t)).send({ monto: 75000, fecha: '2026-01-01' }).expect(200)
      const g1 = (await request(srv()).get('/api/v1/finanzas/capital').set(auth(t)).expect(200)).body
      expect(Number(g1.monto)).toBe(75000) // upsert, no duplica
    })
  })

  // ─── SERIE TEMPORAL Y CATEGORÍAS ─────────────────────────────────────────
  describe('Serie temporal y categorías', () => {
    it('flujo: movimientos en distintos meses caen en el bucket correcto', async () => {
      const t = await createTenant()
      await request(srv()).post('/api/v1/finanzas/movimientos').set(auth(t))
        .send({ tipo: 'INGRESO', categoria: 'OTROS', monto: 100, fecha: '2026-03-10' }).expect(201)
      await request(srv()).post('/api/v1/finanzas/movimientos').set(auth(t))
        .send({ tipo: 'INGRESO', categoria: 'OTROS', monto: 200, fecha: '2026-04-10' }).expect(201)
      await request(srv()).post('/api/v1/finanzas/movimientos').set(auth(t))
        .send({ tipo: 'EGRESO', categoria: 'ALQUILER', monto: 50, fecha: '2026-04-20' }).expect(201)

      const r = (await request(srv())
        .get('/api/v1/finanzas/flujo?desde=2026-01-01&hasta=2026-12-31&agrupacion=mes&vista=cobrado')
        .set(auth(t)).expect(200)).body
      const mar = r.serie.find((s: { periodo: string }) => s.periodo === '2026-03')
      const abr = r.serie.find((s: { periodo: string }) => s.periodo === '2026-04')
      expect(mar).toMatchObject({ ingresos: 100, egresos: 0, balance: 100 })
      expect(abr).toMatchObject({ ingresos: 200, egresos: 50, balance: 150 })
    })

    it('categorías: el desglose suma bien', async () => {
      const t = await createTenant()
      const RANGO = 'desde=2026-07-01&hasta=2026-07-31'
      const movs = [
        { tipo: 'EGRESO', categoria: 'NOMINA', monto: 300 },
        { tipo: 'EGRESO', categoria: 'NOMINA', monto: 200 },
        { tipo: 'EGRESO', categoria: 'ALQUILER', monto: 500 },
        { tipo: 'INGRESO', categoria: 'OTROS', monto: 100 },
      ]
      for (const m of movs) {
        await request(srv()).post('/api/v1/finanzas/movimientos').set(auth(t))
          .send({ ...m, fecha: '2026-07-10' }).expect(201)
      }
      const r = (await request(srv()).get(`/api/v1/finanzas/categorias?${RANGO}`).set(auth(t)).expect(200)).body
      const nomina = r.categorias.find((c: { categoria: string }) => c.categoria === 'NOMINA')
      const alquiler = r.categorias.find((c: { categoria: string }) => c.categoria === 'ALQUILER')
      const otros = r.categorias.find((c: { categoria: string }) => c.categoria === 'OTROS')
      expect(nomina).toMatchObject({ ingresos: 0, egresos: 500, neto: -500 })
      expect(alquiler).toMatchObject({ ingresos: 0, egresos: 500, neto: -500 })
      expect(otros).toMatchObject({ ingresos: 100, egresos: 0, neto: 100 })
      const sumaNeto = r.categorias.reduce((acc: number, c: { neto: number }) => acc + c.neto, 0)
      expect(sumaNeto).toBe(-900) // 100 − 500 − 500
    })
  })

  // ─── AISLAMIENTO FISCAL (crítico) ────────────────────────────────────────
  describe('Aislamiento fiscal', () => {
    it('operaciones de finanzas NO alteran comprobantes ni el reporte 607', async () => {
      const t = await createTenant()
      const f = await mkComprobante(t, { tipoECF: 'E31', montoTotal: 1180, createdAt: new Date('2026-05-15T10:00:00-04:00') })
      const RANGO = 'desde=2026-05-01&hasta=2026-05-31'

      const base607 = (await request(srv()).get(`/api/v1/reportes/607?${RANGO}`).set(auth(t)).expect(200)).body

      // Registrar cobro + movimiento + capital: nada de esto debe rozar lo fiscal.
      await request(srv()).post('/api/v1/finanzas/pagos').set(auth(t))
        .send({ tipo: 'COBRO', comprobanteId: f.id, monto: 1180, fecha: '2026-05-20' }).expect(201)
      await request(srv()).post('/api/v1/finanzas/movimientos').set(auth(t))
        .send({ tipo: 'EGRESO', categoria: 'IMPUESTOS', monto: 999, fecha: '2026-05-21' }).expect(201)
      await request(srv()).put('/api/v1/finanzas/capital').set(auth(t)).send({ monto: 1, fecha: '2026-01-01' }).expect(200)

      const post607 = (await request(srv()).get(`/api/v1/reportes/607?${RANGO}`).set(auth(t)).expect(200)).body
      expect(post607).toEqual(base607) // reporte 607 idéntico

      // La fila del comprobante intacta.
      const comp = await prisma.comprobante.findUniqueOrThrow({ where: { id: f.id } })
      expect(comp.estado).toBe('ACEPTADO')
      expect(comp.eNCF).toBe(f.eNCF)
    })
  })
})
