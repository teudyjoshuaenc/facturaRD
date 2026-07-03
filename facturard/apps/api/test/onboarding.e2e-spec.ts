import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { generateP12, nextRnc } from './helpers/factory'
import { DgiiContribuyentesService } from '../src/modules/tenants/dgii-contribuyentes.service'

// e2e Tarea 0 — onboarding GHL transaccional con P12 (multipart).
describe('GHL onboarding transaccional (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  const buscarPorRNC = jest.fn()
  const cert = generateP12('DMAIA SRL') // { p12Buffer, passphrase }

  beforeAll(async () => {
    ctx = await createTestApp([{ provide: DgiiContribuyentesService, useValue: { buscarPorRNC } }])
    app = ctx.app
  })
  afterAll(async () => { await app.close() })
  beforeEach(() => {
    buscarPorRNC.mockReset()
    buscarPorRNC.mockResolvedValue({ rnc: 'x', razonSocial: 'DMAIA SRL', nombreComercial: 'DMAIA', estado: 'ACTIVO', categoria: undefined })
  })

  const onboard = (fields: { locationId: string; rnc: string; passphrase: string }, p12: Buffer) =>
    request(app.getHttpServer())
      .post('/api/v1/ghl/onboarding')
      .attach('file', p12, { filename: 'cert.p12', contentType: 'application/x-pkcs12' })
      .field('locationId', fields.locationId)
      .field('rnc', fields.rnc)
      .field('passphrase', fields.passphrase)

  it('RNC válido + P12 válido + passphrase correcta → crea todo y devuelve JWT', async () => {
    const rnc = nextRnc()
    const locationId = `loc-${rnc}`
    const res = await onboard({ locationId, rnc, passphrase: cert.passphrase }, cert.p12Buffer).expect(201)

    expect(typeof res.body.token).toBe('string')
    expect(res.body.tenant.rnc).toBe(rnc)
    expect(res.body.tenant.razonSocial).toBe('DMAIA SRL')

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { rnc } })
    const [loc, secs, certActivo] = await Promise.all([
      prisma.ghlLocation.findUnique({ where: { locationId } }),
      prisma.secuencia.count({ where: { tenantId: tenant.id } }),
      prisma.certificado.findFirst({ where: { tenantId: tenant.id, activo: true } }),
    ])
    expect(loc?.tenantId).toBe(tenant.id)
    expect(secs).toBe(10) // todos los tipos e-CF
    expect(certActivo).not.toBeNull()
    expect(certActivo?.titular).toBeTruthy()
  })

  it('passphrase incorrecta → 400 y NO se crea ningún tenant (rollback total)', async () => {
    const rnc = nextRnc()
    const locationId = `loc-${rnc}`
    const antesTenants = await prisma.tenant.count()
    const antesCerts = await prisma.certificado.count()

    await onboard({ locationId, rnc, passphrase: 'passphrase-incorrecta' }, cert.p12Buffer).expect(400)

    expect(await prisma.tenant.count({ where: { rnc } })).toBe(0)
    expect(await prisma.ghlLocation.count({ where: { locationId } })).toBe(0)
    expect(await prisma.tenant.count()).toBe(antesTenants) // sin basura
    expect(await prisma.certificado.count()).toBe(antesCerts) // sin certificado huérfano
  })

  it('archivo que no es un P12 válido → 400, sin efectos', async () => {
    const rnc = nextRnc()
    const locationId = `loc-${rnc}`
    await onboard({ locationId, rnc, passphrase: cert.passphrase }, Buffer.from('no soy un p12')).expect(400)
    expect(await prisma.tenant.count({ where: { rnc } })).toBe(0)
  })

  it('RNC con formato inválido → 400 (validación DTO), sin llamar DGII ni escribir', async () => {
    await onboard({ locationId: 'loc-bad', rnc: '123', passphrase: cert.passphrase }, cert.p12Buffer).expect(400)
    expect(buscarPorRNC).not.toHaveBeenCalled()
    expect(await prisma.ghlLocation.count({ where: { locationId: 'loc-bad' } })).toBe(0)
  })

  it('location ya existente → 409 (no crea un segundo tenant)', async () => {
    const rnc = nextRnc()
    const locationId = `loc-${rnc}`
    await onboard({ locationId, rnc, passphrase: cert.passphrase }, cert.p12Buffer).expect(201)

    // mismo locationId, RNC distinto → conflicto
    const otroRnc = nextRnc()
    await onboard({ locationId, rnc: otroRnc, passphrase: cert.passphrase }, cert.p12Buffer).expect(409)
    expect(await prisma.tenant.count({ where: { rnc: otroRnc } })).toBe(0)
  })

  it('GET /ghl/init: location existente devuelve token; inexistente indica onboarding', async () => {
    const rnc = nextRnc()
    const locationId = `loc-${rnc}`
    await onboard({ locationId, rnc, passphrase: cert.passphrase }, cert.p12Buffer).expect(201)

    const existente = await request(app.getHttpServer()).get(`/api/v1/ghl/init?location_id=${locationId}`).expect(200)
    expect(typeof existente.body.token).toBe('string')
    expect(existente.body.tenant.rnc).toBe(rnc)

    const nuevo = await request(app.getHttpServer()).get('/api/v1/ghl/init?location_id=loc-inexistente').expect(200)
    expect(nuevo.body.onboarding).toBe(true)
  })
})
