import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, TestTenant } from './helpers/factory'

// e2e — Caja diaria (apertura/cierre de efectivo). NO fiscal: sólo control
// interno de caja física sobre lo ya expuesto por Finanzas (pagos + movimientos).
describe('Caja diaria (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication

  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })
  const srv = () => app.getHttpServer()

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
  })

  afterAll(async () => { await app.close() })

  it('sin abrir: GET /caja devuelve NO_ABIERTA', async () => {
    const t = await createTenant()
    const r = await request(srv()).get('/api/v1/finanzas/caja?fecha=2026-06-01').set(auth(t)).expect(200)
    expect(r.body).toMatchObject({ estado: 'NO_ABIERTA', montoApertura: null, montoActual: null })
  })

  it('abrir → montoActual en vivo refleja pagos/movimientos del día; cerrar calcula esperado y diferencia', async () => {
    const t = await createTenant()
    const fecha = '2026-06-02'

    const ap = await request(srv())
      .post('/api/v1/finanzas/caja/apertura')
      .set(auth(t))
      .send({ fecha, monto: 2000, notas: 'Cambio inicial' })
      .expect(201)
    expect(Number(ap.body.montoApertura)).toBe(2000)
    expect(ap.body.estado).toBe('ABIERTA')

    const g0 = await request(srv()).get(`/api/v1/finanzas/caja?fecha=${fecha}`).set(auth(t)).expect(200)
    expect(g0.body).toMatchObject({ estado: 'ABIERTA', montoApertura: 2000, montoActual: 2000 })

    // Ingreso manual de 500 y egreso de 200 durante el día → actual = 2000+500-200 = 2300
    await request(srv()).post('/api/v1/finanzas/movimientos').set(auth(t))
      .send({ tipo: 'INGRESO', categoria: 'OTROS', monto: 500, fecha }).expect(201)
    await request(srv()).post('/api/v1/finanzas/movimientos').set(auth(t))
      .send({ tipo: 'EGRESO', categoria: 'SERVICIOS', monto: 200, fecha }).expect(201)

    const g1 = await request(srv()).get(`/api/v1/finanzas/caja?fecha=${fecha}`).set(auth(t)).expect(200)
    expect(g1.body.montoActual).toBe(2300)
    expect(g1.body.montoEsperado).toBeNull() // aún abierta, no calculado

    const cierre = await request(srv())
      .post('/api/v1/finanzas/caja/cierre')
      .set(auth(t))
      .send({ fecha, montoContado: 2250 })
      .expect(201)
    expect(cierre.body.estado).toBe('CERRADA')
    expect(Number(cierre.body.montoEsperado)).toBe(2300)
    expect(Number(cierre.body.montoContado)).toBe(2250)
    expect(Number(cierre.body.diferencia)).toBe(-50) // faltante

    const g2 = await request(srv()).get(`/api/v1/finanzas/caja?fecha=${fecha}`).set(auth(t)).expect(200)
    expect(g2.body).toMatchObject({ estado: 'CERRADA', montoEsperado: 2300, montoContado: 2250, diferencia: -50 })
  })

  it('no se puede abrir dos veces el mismo día (409)', async () => {
    const t = await createTenant()
    await request(srv()).post('/api/v1/finanzas/caja/apertura').set(auth(t))
      .send({ fecha: '2026-06-03', monto: 1000 }).expect(201)
    await request(srv()).post('/api/v1/finanzas/caja/apertura').set(auth(t))
      .send({ fecha: '2026-06-03', monto: 500 }).expect(409)
  })

  it('cerrar sin abrir → 404; cerrar dos veces → 409', async () => {
    const t = await createTenant()
    await request(srv()).post('/api/v1/finanzas/caja/cierre').set(auth(t))
      .send({ fecha: '2026-06-04', montoContado: 100 }).expect(404)

    await request(srv()).post('/api/v1/finanzas/caja/apertura').set(auth(t))
      .send({ fecha: '2026-06-04', monto: 100 }).expect(201)
    await request(srv()).post('/api/v1/finanzas/caja/cierre').set(auth(t))
      .send({ fecha: '2026-06-04', montoContado: 100 }).expect(201)
    await request(srv()).post('/api/v1/finanzas/caja/cierre').set(auth(t))
      .send({ fecha: '2026-06-04', montoContado: 100 }).expect(409)
  })

  it('historial: filtra por rango y pagina', async () => {
    const t = await createTenant()
    for (const fecha of ['2026-06-10', '2026-06-11', '2026-06-12']) {
      await request(srv()).post('/api/v1/finanzas/caja/apertura').set(auth(t)).send({ fecha, monto: 100 }).expect(201)
    }
    const r = await request(srv())
      .get('/api/v1/finanzas/caja/historial?desde=2026-06-11&hasta=2026-06-12')
      .set(auth(t))
      .expect(200)
    expect(r.body.total).toBe(2)
    expect(r.body.data.map((c: { fecha: string }) => c.fecha.slice(0, 10))).toEqual(['2026-06-12', '2026-06-11'])
  })

  it('tenant isolation: cada tenant tiene su propia caja por fecha', async () => {
    const a = await createTenant()
    const b = await createTenant()
    await request(srv()).post('/api/v1/finanzas/caja/apertura').set(auth(a))
      .send({ fecha: '2026-06-20', monto: 999 }).expect(201)
    const bView = await request(srv()).get('/api/v1/finanzas/caja?fecha=2026-06-20').set(auth(b)).expect(200)
    expect(bView.body.estado).toBe('NO_ABIERTA')
    // B puede abrir su propia caja la misma fecha sin chocar con A
    await request(srv()).post('/api/v1/finanzas/caja/apertura').set(auth(b))
      .send({ fecha: '2026-06-20', monto: 50 }).expect(201)
  })
})
