import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, TestTenant } from './helpers/factory'
import { DgiiContribuyentesService } from '../src/modules/tenants/dgii-contribuyentes.service'

// e2e Sprint 3 — sincronización de contactos desde GHL (fetch + DGII mockeados).
describe('GHL sync de contactos (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenant: TestTenant
  const buscarPorRNC = jest.fn()
  let fetchSpy: jest.SpyInstance

  const page1 = {
    contacts: [
      { id: 'g1', companyName: 'ACME SRL', email: 'a@acme.do', phone: '8091111111', customFields: [{ id: 'rnc_cf', value: '131880681' }] },
      { id: 'g2', name: 'Juan Pérez', email: 'juan@correo.do' }, // sin RNC
    ],
    meta: { nextPageUrl: 'https://services.leadconnectorhq.com/contacts/?limit=100&page=2' },
  }
  const page2 = {
    contacts: [
      { id: 'g3', companyName: 'ByteCorp SRL', customFields: [{ id: 'rnc_cf', value: '130111333' }] },
    ],
    meta: { nextPageUrl: null },
  }

  const jsonRes = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response

  beforeAll(async () => {
    ctx = await createTestApp([{ provide: DgiiContribuyentesService, useValue: { buscarPorRNC } }])
    app = ctx.app
    tenant = await createTenant()
  })

  afterAll(async () => { await app.close() })

  beforeEach(() => {
    buscarPorRNC.mockReset()
    buscarPorRNC.mockResolvedValue({ rnc: 'x', razonSocial: 'VALIDADO', nombreComercial: undefined, estado: 'ACTIVO', categoria: undefined })
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      return Promise.resolve(jsonRes(url.includes('page=2') ? page2 : page1))
    })
  })

  afterEach(() => fetchSpy.mockRestore())

  const auth = () => ({ Authorization: `Bearer ${tenant.token}` })

  it('configurar-ghl guarda token + rncFieldKey', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/contactos/configurar-ghl').set(auth())
      .send({ ghlAccessToken: 'ghl-token-secreto', ghlRncFieldKey: 'rnc_cf' }).expect(200)

    const t = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.tenant.id } })
    expect(t.ghlRncFieldKey).toBe('rnc_cf')
    expect(t.ghlAccessToken).toBeTruthy()
    expect(t.ghlAccessToken).not.toContain('ghl-token-secreto') // cifrado
  })

  it('sincroniza 2 páginas → importados/actualizados/sinRnc y valida RNC mapeado', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contactos/sincronizar-ghl').set(auth()).expect(201)

    expect(res.body).toEqual({ importados: 3, actualizados: 0, sinRnc: 1 })

    const g1 = await prisma.contacto.findFirstOrThrow({ where: { tenantId: tenant.tenant.id, ghlContactId: 'g1' } })
    expect(g1.rnc).toBe('131880681')
    expect(g1.rncValidado).toBe(true)
    expect(g1.origen).toBe('GHL')
  })

  it('re-ejecutar → todos actualizados, cero duplicados', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contactos/sincronizar-ghl').set(auth()).expect(201)

    expect(res.body).toEqual({ importados: 0, actualizados: 3, sinRnc: 1 })

    const total = await prisma.contacto.count({ where: { tenantId: tenant.tenant.id, origen: 'GHL' } })
    expect(total).toBe(3)
  })
})
