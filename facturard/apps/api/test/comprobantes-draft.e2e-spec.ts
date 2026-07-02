import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, initSequences, uploadCert, generateP12, TestTenant } from './helpers/factory'

// e2e Sprint 1.1 — borradores (DRAFT) y emisión bajo demanda.
// La cola BullMQ está mockeada (ver test-app.ts): la DGII nunca es contactada.
describe('Comprobantes — draft + emisión (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenantA: TestTenant
  let tenantB: TestTenant

  const draftBody = {
    tipoECF: 'E31',
    emitir: false,
    fechaEmision: '01-07-2026',
    fechaVencimiento: '31-12-2028',
    rncComprador: '131880681',
    razonSocialComprador: 'CLIENTE TEST SRL',
    items: [
      { numeroLinea: 1, indicadorFacturacion: 'I1', nombreItem: 'Servicio', indicadorBienoServicio: 2, cantidad: 1, precioUnitarioItem: 1000 },
    ],
  }

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
    tenantA = await createTenant()
    tenantB = await createTenant()
    await initSequences(tenantA.tenant.id)
    await initSequences(tenantB.tenant.id)
    await uploadCert(app, tenantA.tenant.id, generateP12('TENANT-A'))
  })

  afterAll(async () => {
    await app.close()
  })

  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })

  it('crea un borrador (emitir=false): estado DRAFT, sin e-NCF, sin encolar', async () => {
    ctx.queueAdd.mockClear()
    const res = await request(app.getHttpServer())
      .post('/api/v1/comprobantes')
      .set(auth(tenantA))
      .send(draftBody)
      .expect(201)

    expect(res.body.estado).toBe('DRAFT')
    expect(res.body.eNCF).toBeNull()
    expect(Number(res.body.montoTotal)).toBe(1180) // 1000 + 18% ITBIS
    expect(ctx.queueAdd).not.toHaveBeenCalled()
  })

  it('el filtro ?estado=DRAFT devuelve los borradores', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/comprobantes?estado=DRAFT')
      .set(auth(tenantA))
      .expect(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    expect(res.body.data.every((c: { estado: string }) => c.estado === 'DRAFT')).toBe(true)
  })

  it('PATCH recalcula totales con líneas mixtas I1 + EXENTO', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send(draftBody).expect(201)

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/comprobantes/${created.body.id}`)
      .set(auth(tenantA))
      .send({
        items: [
          { numeroLinea: 1, indicadorFacturacion: 'I1', nombreItem: 'A', indicadorBienoServicio: 2, cantidad: 1, precioUnitarioItem: 1000 },
          { numeroLinea: 2, indicadorFacturacion: 'E', nombreItem: 'B', indicadorBienoServicio: 1, cantidad: 1, precioUnitarioItem: 500 },
        ],
      })
      .expect(200)

    // 1000 gravado + 180 ITBIS + 500 exento = 1680
    expect(Number(res.body.montoTotal)).toBe(1680)
    expect(res.body.estado).toBe('DRAFT')
  })

  it('emite un borrador: asigna e-NCF, encola una vez', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send(draftBody).expect(201)

    ctx.queueAdd.mockClear()
    const res = await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${created.body.id}/emitir`)
      .set(auth(tenantA))
      .expect(201)

    expect(res.body.eNCF).toMatch(/^E31\d{10}$/)
    expect(res.body.estado).toBe('PENDIENTE')
    expect(ctx.queueAdd).toHaveBeenCalledTimes(1)
  })

  it('PATCH sobre un comprobante ya emitido → 409', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send(draftBody).expect(201)
    await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${created.body.id}/emitir`).set(auth(tenantA)).expect(201)

    await request(app.getHttpServer())
      .patch(`/api/v1/comprobantes/${created.body.id}`)
      .set(auth(tenantA))
      .send({ items: draftBody.items })
      .expect(409)
  })

  it('emitir un comprobante ya emitido → 409 (idempotencia)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send(draftBody).expect(201)
    await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${created.body.id}/emitir`).set(auth(tenantA)).expect(201)

    await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${created.body.id}/emitir`).set(auth(tenantA)).expect(409)
  })

  it('aislamiento multi-tenant: B no ve ni edita ni emite el borrador de A (404)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send(draftBody).expect(201)

    await request(app.getHttpServer()).get(`/api/v1/comprobantes/${created.body.id}`).set(auth(tenantB)).expect(404)
    await request(app.getHttpServer()).patch(`/api/v1/comprobantes/${created.body.id}`).set(auth(tenantB)).send({ items: draftBody.items }).expect(404)
    await request(app.getHttpServer()).post(`/api/v1/comprobantes/${created.body.id}/emitir`).set(auth(tenantB)).expect(404)
  })
})
