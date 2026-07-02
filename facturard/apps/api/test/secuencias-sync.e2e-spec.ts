import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, initSequences, TestTenant } from './helpers/factory'
import { SecuenciasService } from '../src/modules/secuencias/secuencias.service'

// e2e Sprint 10 — sincronización de secuencias (fix error DGII 1209).
describe('Secuencias sync (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let secuencias: SecuenciasService

  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
    secuencias = app.get(SecuenciasService)
  })

  afterAll(async () => { await app.close() })

  it('setear una última secuencia mayor → el próximo e-NCF es last+1', async () => {
    const t = await createTenant()
    await request(app.getHttpServer())
      .post('/api/v1/secuencias/sincronizar').set(auth(t))
      .send([{ tipoECF: 'E31', ultimaSecuencia: 100 }]).expect(201)

    const encf = await secuencias.siguienteENCF(t.tenant.id, 'E31')
    expect(encf).toBe('E310000000101')
  })

  it('intentar retroceder una secuencia → 409', async () => {
    const t = await createTenant()
    await request(app.getHttpServer())
      .post('/api/v1/secuencias/sincronizar').set(auth(t))
      .send([{ tipoECF: 'E31', ultimaSecuencia: 100 }]).expect(201)

    await request(app.getHttpServer())
      .post('/api/v1/secuencias/sincronizar').set(auth(t))
      .send([{ tipoECF: 'E31', ultimaSecuencia: 50 }]).expect(409)

    // el valor no se movió: próximo sigue siendo 101
    expect(await secuencias.siguienteENCF(t.tenant.id, 'E31')).toBe('E310000000101')
  })

  it('cliente nuevo sin sync → arranca en 1', async () => {
    const t = await createTenant()
    await initSequences(t.tenant.id) // onboarding inicializa en 0
    expect(await secuencias.siguienteENCF(t.tenant.id, 'E31')).toBe('E310000000001')
  })

  it('asignación concurrente tras sync → e-NCFs distintos y consecutivos', async () => {
    const t = await createTenant()
    await request(app.getHttpServer())
      .post('/api/v1/secuencias/sincronizar').set(auth(t))
      .send([{ tipoECF: 'E32', ultimaSecuencia: 200 }]).expect(201)

    const N = 12
    const encfs = await Promise.all(Array.from({ length: N }, () => secuencias.siguienteENCF(t.tenant.id, 'E32')))
    expect(new Set(encfs).size).toBe(N) // sin colisiones

    const nums = encfs.map((e) => Number(e.slice(3))).sort((a, b) => a - b)
    expect(nums[0]).toBe(201)
    expect(nums[N - 1]).toBe(200 + N)
  })

  it('sincroniza varios tipos a la vez', async () => {
    const t = await createTenant()
    const res = await request(app.getHttpServer())
      .post('/api/v1/secuencias/sincronizar').set(auth(t))
      .send([
        { tipoECF: 'E31', ultimaSecuencia: 10 },
        { tipoECF: 'E34', ultimaSecuencia: 5 },
      ]).expect(201)
    expect(res.body).toHaveLength(2)
    expect(await secuencias.siguienteENCF(t.tenant.id, 'E31')).toBe('E310000000011')
    expect(await secuencias.siguienteENCF(t.tenant.id, 'E34')).toBe('E340000000006')
  })
})
