import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, TestTenant } from './helpers/factory'
import { DgiiContribuyentesService } from '../src/modules/tenants/dgii-contribuyentes.service'

// e2e — "Clientes recientes" del selector de emisión.
// Reciente = a quien MÁS RECIENTEMENTE le facturaste, no el contacto recién
// creado (que es lo que ya daba GET /contactos con orderBy createdAt desc).
describe('Contactos — recientes (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenant: TestTenant
  let otro: TestTenant
  const buscarPorRNC = jest.fn()

  beforeAll(async () => {
    ctx = await createTestApp([{ provide: DgiiContribuyentesService, useValue: { buscarPorRNC } }])
    app = ctx.app
    tenant = await createTenant()
    otro = await createTenant()
  })

  afterAll(async () => { await app.close() })

  const auth = (t: TestTenant = tenant) => ({ Authorization: `Bearer ${t.token}` })
  const srv = () => app.getHttpServer()

  const crearContacto = (body: Record<string, unknown>, t: TestTenant = tenant) => {
    buscarPorRNC.mockResolvedValue({ rnc: String(body['rnc'] ?? ''), razonSocial: String(body['razonSocial'] ?? '') })
    return request(srv()).post('/api/v1/contactos').set(auth(t)).send(body)
  }

  const borrador = (over: Record<string, unknown> = {}, t: TestTenant = tenant) =>
    request(srv()).post('/api/v1/comprobantes').set(auth(t)).send({
      tipoECF: 'E31', emitir: false, fechaEmision: '01-07-2026', fechaVencimiento: '31-12-2028',
      items: [{ numeroLinea: 1, nombreItem: 'Servicio', cantidad: 1, precioUnitarioItem: 1000, indicadorFacturacion: 'I1', indicadorBienoServicio: 2 }],
      ...over,
    })

  const recientes = (qs = '', t: TestTenant = tenant) =>
    request(srv()).get(`/api/v1/contactos/recientes${qs}`).set(auth(t))

  // Las fechas se fijan a mano: dentro de un mismo test los createdAt caen en el
  // mismo milisegundo y el orden quedaría al azar.
  const fecharComprobante = (id: string, iso: string) =>
    prisma.comprobante.update({ where: { id }, data: { createdAt: new Date(iso) } })

  it('devuelve [] cuando el tenant no ha facturado a nadie', async () => {
    await crearContacto({ tipo: 'CLIENTE', razonSocial: 'SIN FACTURAS', rnc: '131880681' }).expect(201)
    const res = await recientes().expect(200)
    expect(res.body).toEqual([])
  })

  it('ordena por ÚLTIMO comprobante, no por creación del contacto', async () => {
    const t = await createTenant()
    const viejo = await crearContacto({ tipo: 'CLIENTE', razonSocial: 'PRIMERO CREADO', rnc: '101010101' }, t).expect(201)
    const nuevo = await crearContacto({ tipo: 'CLIENTE', razonSocial: 'ULTIMO CREADO', rnc: '202020202' }, t).expect(201)

    // El creado PRIMERO es el que factura de ÚLTIMO: si el endpoint ordenara
    // por createdAt del contacto, saldría al revés.
    const a = await borrador({ contactoId: nuevo.body.id }, t).expect(201)
    const b = await borrador({ contactoId: viejo.body.id }, t).expect(201)
    await fecharComprobante(a.body.id, '2026-01-01T10:00:00.000Z')
    await fecharComprobante(b.body.id, '2026-06-01T10:00:00.000Z')

    const res = await recientes('', t).expect(200)
    expect(res.body.map((c: any) => c.razonSocial)).toEqual(['PRIMERO CREADO', 'ULTIMO CREADO'])
    expect(new Date(res.body[0].ultimaFacturaAt).toISOString()).toBe('2026-06-01T10:00:00.000Z')
  })

  it('un contacto con varias facturas aparece UNA vez, con la fecha más reciente', async () => {
    const t = await createTenant()
    const c = await crearContacto({ tipo: 'CLIENTE', razonSocial: 'REPETIDO', rnc: '303030303' }, t).expect(201)

    const a = await borrador({ contactoId: c.body.id }, t).expect(201)
    const b = await borrador({ contactoId: c.body.id }, t).expect(201)
    await fecharComprobante(a.body.id, '2026-02-01T10:00:00.000Z')
    await fecharComprobante(b.body.id, '2026-05-01T10:00:00.000Z')

    const res = await recientes('', t).expect(200)
    expect(res.body).toHaveLength(1)
    expect(new Date(res.body[0].ultimaFacturaAt).toISOString()).toBe('2026-05-01T10:00:00.000Z')
  })

  it('reconstruye por RNC los comprobantes VIEJOS sin contactoId', async () => {
    const t = await createTenant()
    const c = await crearContacto({ tipo: 'CLIENTE', razonSocial: 'SOLO POR RNC', rnc: '404040404' }, t).expect(201)

    // Borrador SIN contactoId, como los de antes del fix de draft-cliente.
    const d = await borrador({ rncComprador: '404040404', razonSocialComprador: 'SOLO POR RNC' }, t).expect(201)
    await prisma.comprobante.update({ where: { id: d.body.id }, data: { contactoId: null, createdAt: new Date('2026-03-01T10:00:00.000Z') } })

    const res = await recientes('', t).expect(200)
    expect(res.body.map((x: any) => x.id)).toEqual([c.body.id])
  })

  it('un comprobante sin RNC no arrastra a un contacto sin RNC', async () => {
    const t = await createTenant()
    await crearContacto({ tipo: 'CONSUMIDOR_FINAL', razonSocial: 'CONSUMIDOR SIN RNC' }, t).expect(201)

    const d = await borrador({ tipoECF: 'E32', razonSocialComprador: 'OTRO CONSUMIDOR' }, t).expect(201)
    await prisma.comprobante.update({ where: { id: d.body.id }, data: { contactoId: null, rnc: '' } })

    const res = await recientes('', t).expect(200)
    expect(res.body).toEqual([])
  })

  it('excluye contactos dados de baja (el selector no factura a inactivos)', async () => {
    const t = await createTenant()
    const c = await crearContacto({ tipo: 'CLIENTE', razonSocial: 'DADO DE BAJA', rnc: '505050505' }, t).expect(201)
    await borrador({ contactoId: c.body.id }, t).expect(201)
    expect((await recientes('', t).expect(200)).body).toHaveLength(1)

    await request(srv()).delete(`/api/v1/contactos/${c.body.id}`).set(auth(t)).expect(200)
    expect((await recientes('', t).expect(200)).body).toEqual([])
  })

  it('excluye las notas de venta eliminadas (soft delete)', async () => {
    const t = await createTenant()
    const c = await crearContacto({ tipo: 'CLIENTE', razonSocial: 'NOTA BORRADA', rnc: '606060606' }, t).expect(201)
    const nota = await borrador({ contactoId: c.body.id, esFiscal: false }, t).expect(201)
    expect((await recientes('', t).expect(200)).body).toHaveLength(1) // la nota SÍ cuenta mientras exista

    await request(srv()).delete(`/api/v1/comprobantes/${nota.body.id}`).set(auth(t)).expect(200)
    expect((await recientes('', t).expect(200)).body).toEqual([])
  })

  it('respeta el limit y lo topa en 10', async () => {
    const t = await createTenant()
    for (let i = 0; i < 7; i++) {
      const rnc = `70000000${i}`
      const c = await crearContacto({ tipo: 'CLIENTE', razonSocial: `CLIENTE ${i}`, rnc }, t).expect(201)
      const d = await borrador({ contactoId: c.body.id }, t).expect(201)
      await fecharComprobante(d.body.id, `2026-04-0${i + 1}T10:00:00.000Z`)
    }

    expect((await recientes('', t).expect(200)).body).toHaveLength(5) // default
    expect((await recientes('?limit=3', t).expect(200)).body).toHaveLength(3)
    expect((await recientes('?limit=99', t).expect(200)).body).toHaveLength(7) // topado en 10, hay 7
  })

  it('está aislado por tenant', async () => {
    const c = await crearContacto({ tipo: 'CLIENTE', razonSocial: 'DEL TENANT A', rnc: '808080808' }).expect(201)
    await borrador({ contactoId: c.body.id }).expect(201)

    const res = await recientes('', otro).expect(200)
    expect(res.body).toEqual([])
  })
})
