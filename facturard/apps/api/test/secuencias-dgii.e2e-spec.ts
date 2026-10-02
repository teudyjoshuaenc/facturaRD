import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, generateP12, initSequences, uploadCert, TestTenant } from './helpers/factory'
import { DgiiTrackIdsClient } from '../src/modules/secuencias/dgii-trackids.client'
import { SecuenciasService } from '../src/modules/secuencias/secuencias.service'

// Detección automática de secuencias desde la DGII (consulta TrackIds).
// La DGII se simula con un mapa RNC → e-NCF recibidos; nunca hay red real.
describe('Secuencias — detección desde la DGII (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let secuencias: SecuenciasService

  /** e-NCF que "la DGII" ya tiene, por RNC. */
  const recibidos = new Map<string, Set<string>>()
  const fallan = new Set<string>() // e-NCF cuya consulta responde error
  let authFalla = false
  const consultas: string[] = []

  const dgiiFake = {
    autenticar: jest.fn(async () => {
      if (authFalla) throw new Error('semilla rechazada')
      return 'token-fake'
    }),
    recibido: jest.fn(async (rnc: string, eNCF: string) => {
      consultas.push(eNCF)
      if (fallan.has(eNCF)) throw new Error('DGII 500')
      return recibidos.get(rnc)?.has(eNCF) ?? false
    }),
  }

  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })
  const encf = (tipo: string, n: number) => `${tipo}${String(n).padStart(10, '0')}`
  const marcarRecibidos = (rnc: string, tipo: string, desde: number, hasta: number) => {
    const set = recibidos.get(rnc) ?? new Set<string>()
    for (let n = desde; n <= hasta; n++) set.add(encf(tipo, n))
    recibidos.set(rnc, set)
  }
  const detectar = (t: TestTenant) =>
    request(app.getHttpServer()).post('/api/v1/secuencias/detectar-dgii').set(auth(t))
  const contador = async (tenantId: string, tipoECF: 'E31' | 'E32' | 'E33' | 'E34') =>
    (await prisma.secuencia.findUniqueOrThrow({ where: { tenantId_tipoECF: { tenantId, tipoECF } } }))
      .ultimaSecuencia

  async function tenantCertificado(): Promise<TestTenant> {
    const t = await createTenant()
    await initSequences(t.tenant.id)
    await uploadCert(app, t.tenant.id, generateP12(`Emisor ${t.tenant.rnc}`))
    return t
  }

  beforeAll(async () => {
    ctx = await createTestApp([{ provide: DgiiTrackIdsClient, useValue: dgiiFake }])
    app = ctx.app
    secuencias = app.get(SecuenciasService)
  })

  beforeEach(() => {
    authFalla = false
    fallan.clear()
    consultas.length = 0
  })

  afterAll(async () => { await app.close() })

  it('avanza cada tipo hasta el último e-NCF recibido y el próximo es last+1', async () => {
    const t = await tenantCertificado()
    marcarRecibidos(t.tenant.rnc, 'E31', 1, 13)
    marcarRecibidos(t.tenant.rnc, 'E34', 1, 2)

    const res = await detectar(t).expect(201)

    const e31 = res.body.tipos.find((x: { tipoECF: string }) => x.tipoECF === 'E31')
    expect(e31).toMatchObject({ antes: 0, detectada: 13, despues: 13, estado: 'actualizada', proximoENCF: 'E310000000014' })
    const e34 = res.body.tipos.find((x: { tipoECF: string }) => x.tipoECF === 'E34')
    expect(e34).toMatchObject({ despues: 2, estado: 'actualizada' })
    const e33 = res.body.tipos.find((x: { tipoECF: string }) => x.tipoECF === 'E33')
    expect(e33).toMatchObject({ despues: 0, estado: 'sinCambios', proximoENCF: 'E330000000001' })

    expect((await secuencias.siguienteENCF(t.tenant.id, 'E31')).eNCF).toBe('E310000000014')
    expect(res.body.tipos).toHaveLength(10)
  })

  it('salta un e-NCF quemado que nunca llegó a la DGII', async () => {
    const t = await tenantCertificado()
    marcarRecibidos(t.tenant.rnc, 'E31', 1, 11)
    marcarRecibidos(t.tenant.rnc, 'E31', 13, 20) // el 12 se quemó localmente

    await detectar(t).expect(201)
    expect(await contador(t.tenant.id, 'E31')).toBe(20)
  })

  it('NUNCA retrocede: si el contador local va más adelante, queda igual', async () => {
    const t = await tenantCertificado()
    await prisma.secuencia.update({
      where: { tenantId_tipoECF: { tenantId: t.tenant.id, tipoECF: 'E31' } },
      data: { ultimaSecuencia: 50 },
    })
    marcarRecibidos(t.tenant.rnc, 'E31', 1, 10)

    const res = await detectar(t).expect(201)
    expect(res.body.tipos.find((x: { tipoECF: string }) => x.tipoECF === 'E31'))
      .toMatchObject({ antes: 50, despues: 50, estado: 'sinCambios' })
    expect(await contador(t.tenant.id, 'E31')).toBe(50)
    // parte del contador local: no vuelve a preguntar números ya conocidos
    expect(consultas.filter((c) => c.startsWith('E31')).every((c) => Number(c.slice(3)) > 50)).toBe(true)
  })

  it('cada emisor consulta con SU RNC (aislamiento entre tenants)', async () => {
    const a = await tenantCertificado()
    const b = await tenantCertificado()
    marcarRecibidos(a.tenant.rnc, 'E31', 1, 30)

    dgiiFake.recibido.mockClear()
    await detectar(b).expect(201)
    expect(await contador(b.tenant.id, 'E31')).toBe(0)
    expect(await contador(a.tenant.id, 'E31')).toBe(0) // A no se tocó
    expect(dgiiFake.recibido.mock.calls.every(([rnc]) => rnc === b.tenant.rnc)).toBe(true)
  })

  it('un error de la DGII en un tipo NO avanza ese tipo y no afecta a los demás', async () => {
    const t = await tenantCertificado()
    marcarRecibidos(t.tenant.rnc, 'E31', 1, 5)
    marcarRecibidos(t.tenant.rnc, 'E34', 1, 5)
    fallan.add(encf('E34', 1))

    const res = await detectar(t).expect(201)
    expect(res.body.tipos.find((x: { tipoECF: string }) => x.tipoECF === 'E34'))
      .toMatchObject({ estado: 'error', detectada: null, despues: 0 })
    expect(await contador(t.tenant.id, 'E34')).toBe(0)
    expect(await contador(t.tenant.id, 'E31')).toBe(5)
  })

  it('E32 lleva la nota del resumen RFCE', async () => {
    const t = await tenantCertificado()
    const res = await detectar(t).expect(201)
    expect(res.body.tipos.find((x: { tipoECF: string }) => x.tipoECF === 'E32').nota).toMatch(/RFCE/)
  })

  it('sin certificado → 409 y no consulta a la DGII', async () => {
    const t = await createTenant()
    await initSequences(t.tenant.id)
    dgiiFake.autenticar.mockClear()

    const res = await detectar(t).expect(409)
    expect(res.body.message).toMatch(/certificado/)
    expect(dgiiFake.autenticar).not.toHaveBeenCalled()
  })

  it('si la DGII rechaza la autenticación → 502 y no se toca ningún contador', async () => {
    const t = await tenantCertificado()
    marcarRecibidos(t.tenant.rnc, 'E31', 1, 9)
    authFalla = true

    await detectar(t).expect(502)
    expect(await contador(t.tenant.id, 'E31')).toBe(0)
  })

  it('después de detectar, sincronizar con el mismo número no da 409 (paso del onboarding)', async () => {
    const t = await tenantCertificado()
    marcarRecibidos(t.tenant.rnc, 'E31', 1, 13)
    await detectar(t).expect(201)

    await request(app.getHttpServer())
      .post('/api/v1/secuencias/sincronizar').set(auth(t))
      .send([{ tipoECF: 'E31', ultimaSecuencia: 13, fechaVencimiento: '2027-12-31' }])
      .expect(201)
    expect((await secuencias.siguienteENCF(t.tenant.id, 'E31')).eNCF).toBe('E310000000014')
  })

  it('no consume e-NCF ni encola nada', async () => {
    const t = await tenantCertificado()
    ctx.queueAdd.mockClear()
    await detectar(t).expect(201)
    expect(ctx.queueAdd).not.toHaveBeenCalled()
    expect(await prisma.comprobante.count({ where: { tenantId: t.tenant.id } })).toBe(0)
  })
})
