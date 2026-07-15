import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, TestTenant } from './helpers/factory'
import { DgiiContribuyentesService } from '../src/modules/tenants/dgii-contribuyentes.service'

// e2e Sprint 3 — contactos con validación DGII (mockeada).
describe('Contactos (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenantA: TestTenant
  let tenantB: TestTenant
  const buscarPorRNC = jest.fn()

  beforeAll(async () => {
    ctx = await createTestApp([{ provide: DgiiContribuyentesService, useValue: { buscarPorRNC } }])
    app = ctx.app
    tenantA = await createTenant()
    tenantB = await createTenant()
  })

  afterAll(async () => { await app.close() })
  beforeEach(() => buscarPorRNC.mockReset())

  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })

  it('CRUD + soft delete + cross-tenant 404', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/contactos').set(auth(tenantA))
      .send({ tipo: 'CONSUMIDOR_FINAL', razonSocial: 'Consumidor Final' }).expect(201)
    const id = created.body.id
    expect(buscarPorRNC).not.toHaveBeenCalled() // CONSUMIDOR_FINAL no valida

    await request(app.getHttpServer()).get(`/api/v1/contactos/${id}`).set(auth(tenantA)).expect(200)

    await request(app.getHttpServer())
      .patch(`/api/v1/contactos/${id}`).set(auth(tenantA)).send({ telefono: '8090000000' }).expect(200)

    await request(app.getHttpServer()).delete(`/api/v1/contactos/${id}`).set(auth(tenantA)).expect(200)
    // default (sin parámetro) → trae activos E inactivos: el soft-deleted sigue visible
    const list = await request(app.getHttpServer()).get('/api/v1/contactos').set(auth(tenantA)).expect(200)
    expect(list.body.data.some((c: { id: string }) => c.id === id)).toBe(true)

    // cross-tenant
    await request(app.getHttpServer()).get(`/api/v1/contactos/${id}`).set(auth(tenantB)).expect(404)
    await request(app.getHttpServer()).patch(`/api/v1/contactos/${id}`).set(auth(tenantB)).send({ telefono: '1' }).expect(404)
  })

  it('filtro 3 estados: default=todos, activo=true excluye inactivos, activo=false sólo inactivos; reactivable', async () => {
    const activo = await request(app.getHttpServer())
      .post('/api/v1/contactos').set(auth(tenantA))
      .send({ tipo: 'CONSUMIDOR_FINAL', razonSocial: 'Vigente SRL' }).expect(201)
    const inactivo = await request(app.getHttpServer())
      .post('/api/v1/contactos').set(auth(tenantA))
      .send({ tipo: 'CONSUMIDOR_FINAL', razonSocial: 'Dado de baja SRL' }).expect(201)
    await request(app.getHttpServer()).delete(`/api/v1/contactos/${inactivo.body.id}`).set(auth(tenantA)).expect(200)

    // default → ambos
    const todos = await request(app.getHttpServer()).get('/api/v1/contactos?limit=100').set(auth(tenantA)).expect(200)
    expect(todos.body.data.some((c: { id: string }) => c.id === activo.body.id)).toBe(true)
    expect(todos.body.data.some((c: { id: string }) => c.id === inactivo.body.id)).toBe(true)

    // activo=true → sólo activos
    const soloActivos = await request(app.getHttpServer()).get('/api/v1/contactos?activo=true&limit=100').set(auth(tenantA)).expect(200)
    expect(soloActivos.body.data.some((c: { id: string }) => c.id === inactivo.body.id)).toBe(false)
    expect(soloActivos.body.data.every((c: { activo: boolean }) => c.activo === true)).toBe(true)

    // activo=false → sólo inactivos
    const soloInactivos = await request(app.getHttpServer()).get('/api/v1/contactos?activo=false&limit=100').set(auth(tenantA)).expect(200)
    expect(soloInactivos.body.data.some((c: { id: string }) => c.id === inactivo.body.id)).toBe(true)
    expect(soloInactivos.body.data.every((c: { activo: boolean }) => c.activo === false)).toBe(true)

    // reactivar via PATCH activo=true
    const upd = await request(app.getHttpServer())
      .patch(`/api/v1/contactos/${inactivo.body.id}`).set(auth(tenantA)).send({ activo: true }).expect(200)
    expect(upd.body.activo).toBe(true)
  })

  it('RNC válido (DGII mock) → razonSocial autocompletada y rncValidado=true', async () => {
    buscarPorRNC.mockResolvedValueOnce({ rnc: '131880681', razonSocial: 'EMPRESA DGII SRL', nombreComercial: 'DGII', estado: 'ACTIVO', categoria: undefined })
    const res = await request(app.getHttpServer())
      .post('/api/v1/contactos').set(auth(tenantA))
      .send({ tipo: 'CLIENTE', rnc: '131880681' }).expect(201)
    expect(res.body.razonSocial).toBe('EMPRESA DGII SRL')
    expect(res.body.rncValidado).toBe(true)
    expect(res.body.warning).toBeUndefined()
  })

  it('DGII caída → persiste con rncValidado=false y warning', async () => {
    buscarPorRNC.mockRejectedValueOnce(new Error('DGII no disponible'))
    const res = await request(app.getHttpServer())
      .post('/api/v1/contactos').set(auth(tenantA))
      .send({ tipo: 'CLIENTE', rnc: '101000001', razonSocial: 'CLIENTE MANUAL SRL' }).expect(201)
    expect(res.body.rncValidado).toBe(false)
    expect(res.body.razonSocial).toBe('CLIENTE MANUAL SRL')
    expect(typeof res.body.warning).toBe('string')
  })

  it('RNC duplicado → update-in-place, sin fila duplicada', async () => {
    buscarPorRNC.mockResolvedValue({ rnc: '130111222', razonSocial: 'PRIMERA SRL', nombreComercial: undefined, estado: 'ACTIVO', categoria: undefined })
    const first = await request(app.getHttpServer())
      .post('/api/v1/contactos').set(auth(tenantA)).send({ tipo: 'CLIENTE', rnc: '130111222' }).expect(201)

    const second = await request(app.getHttpServer())
      .post('/api/v1/contactos').set(auth(tenantA)).send({ tipo: 'CLIENTE', rnc: '130111222', telefono: '8095551234' }).expect(201)

    expect(second.body.id).toBe(first.body.id) // misma fila
    expect(second.body.telefono).toBe('8095551234')

    const count = await prisma.contacto.count({ where: { tenantId: tenantA.tenant.id, rnc: '130111222' } })
    expect(count).toBe(1)
  })
})
