import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, TestTenant } from './helpers/factory'

// finanzasHabilitado: derivado de la existencia de CapitalInicial para el tenant
// (sin columna nueva en Tenant). Gatea la sección Finanzas en el frontend.
describe('Finanzas habilitado (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenant: TestTenant

  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })
  const srv = () => app.getHttpServer()

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
    tenant = await createTenant()
  })

  afterAll(async () => { await app.close() })

  it('GET /tenants → finanzasHabilitado: false para un tenant sin Capital inicial', async () => {
    const res = await request(srv()).get('/api/v1/tenants').set(auth(tenant)).expect(200)
    expect(res.body[0].finanzasHabilitado).toBe(false)
  })

  it('PUT /finanzas/capital → finanzasHabilitado pasa a true', async () => {
    await request(srv())
      .put('/api/v1/finanzas/capital')
      .set(auth(tenant))
      .send({ monto: 5000, fecha: '2026-01-01' })
      .expect(200)

    const res = await request(srv()).get('/api/v1/tenants').set(auth(tenant)).expect(200)
    expect(res.body[0].finanzasHabilitado).toBe(true)
  })

  it('otro tenant sin Capital inicial sigue viendo false (aislamiento)', async () => {
    const otro = await createTenant()
    const res = await request(srv()).get('/api/v1/tenants').set(auth(otro)).expect(200)
    expect(res.body[0].finanzasHabilitado).toBe(false)
  })
})
