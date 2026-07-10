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
  const LOCATION_ID = 'loc-ghl-sync-test'

  // El contacto trae customFields keyed por el ID del campo (RNC_FIELD_ID), no por
  // el nombre visible. El tenant configura el NOMBRE ("RNC / Cedula") y el backend
  // resuelve nombre → id vía GET /customFields.
  const RNC_FIELD_ID = 'cf_rnc_id'
  const page1 = {
    contacts: [
      { id: 'g1', firstNameRaw: 'Adelina', lastNameRaw: 'Gomez', email: 'a@acme.do', phone: '8091111111', customFields: [{ id: RNC_FIELD_ID, value: '131880681' }] },
      { id: 'g2', contactName: 'juan perez', email: 'juan@correo.do', customFields: [] }, // sin RNC
    ],
    meta: { nextPageUrl: 'https://services.leadconnectorhq.com/contacts/?limit=100&page=2' },
  }
  const page2 = {
    contacts: [
      { id: 'g3', companyName: 'ByteCorp SRL', customFields: [{ id: RNC_FIELD_ID, value: '130111333' }] },
    ],
    meta: { nextPageUrl: null },
  }
  const customFieldsDef = { customFields: [{ id: RNC_FIELD_ID, name: 'RNC / Cedula', fieldKey: 'contact.rnc_cedula' }] }

  const jsonRes = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response

  beforeAll(async () => {
    ctx = await createTestApp([{ provide: DgiiContribuyentesService, useValue: { buscarPorRNC } }])
    app = ctx.app
    tenant = await createTenant()
    // GHL exige locationId → el tenant debe tener un GhlLocation vinculado.
    await prisma.ghlLocation.create({ data: { locationId: LOCATION_ID, tenantId: tenant.tenant.id } })
  })

  afterAll(async () => { await app.close() })

  beforeEach(() => {
    buscarPorRNC.mockReset()
    buscarPorRNC.mockResolvedValue({ rnc: 'x', razonSocial: 'VALIDADO', nombreComercial: undefined, estado: 'ACTIVO', categoria: undefined })
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/customFields')) return Promise.resolve(jsonRes(customFieldsDef))
      return Promise.resolve(jsonRes(url.includes('page=2') ? page2 : page1))
    })
  })

  afterEach(() => fetchSpy.mockRestore())

  const auth = () => ({ Authorization: `Bearer ${tenant.token}` })

  it('configurar-ghl guarda token + rncFieldKey (nombre visible del campo)', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/contactos/configurar-ghl').set(auth())
      .send({ ghlAccessToken: 'ghl-token-secreto', ghlRncFieldKey: 'RNC / Cedula' }).expect(200)

    const t = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.tenant.id } })
    expect(t.ghlRncFieldKey).toBe('RNC / Cedula')
    expect(t.ghlAccessToken).toBeTruthy()
    expect(t.ghlAccessToken).not.toContain('ghl-token-secreto') // cifrado
  })

  it('sincroniza 2 páginas → importados/actualizados/sinRnc y valida RNC mapeado', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contactos/sincronizar-ghl').set(auth()).expect(201)

    expect(res.body).toEqual({ importados: 3, actualizados: 0, sinRnc: 1 })

    const g1 = await prisma.contacto.findFirstOrThrow({ where: { tenantId: tenant.tenant.id, ghlContactId: 'g1' } })
    expect(g1.rnc).toBe('131880681') // RNC resuelto por id del customField (nombre → id)
    expect(g1.razonSocial).toBe('Adelina Gomez') // nombre desde firstNameRaw/lastNameRaw
    expect(g1.rncValidado).toBe(true)
    expect(g1.origen).toBe('GHL')
  })

  it('la llamada a GHL de contactos incluye el locationId del tenant y el header de auth', async () => {
    await request(app.getHttpServer()).post('/api/v1/contactos/sincronizar-ghl').set(auth()).expect(201)

    const urls = fetchSpy.mock.calls.map((c) => String(c[0]))
    // Se resuelve el campo RNC contra /customFields del location...
    expect(urls.some((u) => u.includes(`/locations/${LOCATION_ID}/customFields`))).toBe(true)
    // ...y la lista de contactos lleva ?locationId=<location del tenant>.
    const contactosCall = fetchSpy.mock.calls.find(([u]) => String(u).includes('/contacts/'))
    expect(String(contactosCall?.[0])).toContain(`locationId=${LOCATION_ID}`)

    const init = contactosCall?.[1] as { headers?: Record<string, string> } | undefined
    expect(init?.headers?.Authorization).toMatch(/^Bearer /)
    expect(init?.headers?.Version).toBe('2021-07-28')
  })

  it('re-ejecutar → todos actualizados, cero duplicados', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contactos/sincronizar-ghl').set(auth()).expect(201)

    expect(res.body).toEqual({ importados: 0, actualizados: 3, sinRnc: 1 })

    const total = await prisma.contacto.count({ where: { tenantId: tenant.tenant.id, origen: 'GHL' } })
    expect(total).toBe(3)
  })

  // La re-sync puede AGREGAR/MEJORAR datos, pero nunca degradar/revertir lo que el
  // usuario editó a mano en FacturaRD.
  describe('re-sync no degrada datos editados en FacturaRD', () => {
    const setGhlContacts = (contacts: unknown[]) => {
      fetchSpy.mockImplementation((input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/customFields')) return Promise.resolve(jsonRes(customFieldsDef))
        return Promise.resolve(jsonRes({ contacts, meta: { nextPageUrl: null } }))
      })
    }

    it('RNC manual + rncValidado=true → re-sync con GHL sin RNC conserva ambos (no resetea)', async () => {
      await prisma.contacto.create({
        data: { tenantId: tenant.tenant.id, ghlContactId: 'g-pres', origen: 'GHL', tipo: 'CLIENTE', razonSocial: 'Cliente Pres', rnc: '40200000001', rncValidado: true },
      })
      setGhlContacts([{ id: 'g-pres', companyName: 'Cliente Pres', customFields: [] }]) // GHL sin RNC

      await request(app.getHttpServer()).post('/api/v1/contactos/sincronizar-ghl').set(auth()).expect(201)

      const c = await prisma.contacto.findFirstOrThrow({ where: { tenantId: tenant.tenant.id, ghlContactId: 'g-pres' } })
      expect(c.rnc).toBe('40200000001')
      expect(c.rncValidado).toBe(true)
      expect(buscarPorRNC).not.toHaveBeenCalled() // no revalida con RNC vacío
    })

    it('renombrado en FacturaRD → re-sync con GHL sin nombre útil conserva el nombre manual', async () => {
      await prisma.contacto.create({
        data: { tenantId: tenant.tenant.id, ghlContactId: 'g-name', origen: 'GHL', tipo: 'CLIENTE', razonSocial: 'Nombre Editado A Mano' },
      })
      setGhlContacts([{ id: 'g-name', customFields: [] }]) // GHL sin nombre ni empresa

      await request(app.getHttpServer()).post('/api/v1/contactos/sincronizar-ghl').set(auth()).expect(201)

      const c = await prisma.contacto.findFirstOrThrow({ where: { tenantId: tenant.tenant.id, ghlContactId: 'g-name' } })
      expect(c.razonSocial).toBe('Nombre Editado A Mano')
    })

    it('marcado PROVEEDOR → re-sync lo mantiene como PROVEEDOR (no lo revierte a CLIENTE)', async () => {
      await prisma.contacto.create({
        data: { tenantId: tenant.tenant.id, ghlContactId: 'g-prov', origen: 'GHL', tipo: 'PROVEEDOR', razonSocial: 'Proveedor X' },
      })
      setGhlContacts([{ id: 'g-prov', companyName: 'Proveedor X', customFields: [] }])

      await request(app.getHttpServer()).post('/api/v1/contactos/sincronizar-ghl').set(auth()).expect(201)

      const c = await prisma.contacto.findFirstOrThrow({ where: { tenantId: tenant.tenant.id, ghlContactId: 'g-prov' } })
      expect(c.tipo).toBe('PROVEEDOR')
    })

    it('RNC nuevo que SÍ viene de GHL → se actualiza y revalida (el caso bueno sigue funcionando)', async () => {
      await prisma.contacto.create({
        data: { tenantId: tenant.tenant.id, ghlContactId: 'g-newrnc', origen: 'GHL', tipo: 'CLIENTE', razonSocial: 'Cliente Sin RNC', rncValidado: false },
      })
      buscarPorRNC.mockResolvedValue({ rnc: '40299988877', razonSocial: 'X', nombreComercial: undefined, estado: 'ACTIVO', categoria: undefined })
      setGhlContacts([{ id: 'g-newrnc', companyName: 'Cliente Sin RNC', customFields: [{ id: RNC_FIELD_ID, value: '40299988877' }] }])

      await request(app.getHttpServer()).post('/api/v1/contactos/sincronizar-ghl').set(auth()).expect(201)

      const c = await prisma.contacto.findFirstOrThrow({ where: { tenantId: tenant.tenant.id, ghlContactId: 'g-newrnc' } })
      expect(c.rnc).toBe('40299988877')
      expect(c.rncValidado).toBe(true)
      expect(buscarPorRNC).toHaveBeenCalledWith('40299988877')
    })
  })
})
