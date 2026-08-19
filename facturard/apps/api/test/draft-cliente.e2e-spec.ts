import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, TestTenant } from './helpers/factory'
import { DgiiContribuyentesService } from '../src/modules/tenants/dgii-contribuyentes.service'

// e2e — el CLIENTE tiene que sobrevivir en un borrador.
// Bug de producción: el formulario sólo mandaba rnc + razón social, así que un
// cliente SIN RNC (consumidor final) no se podía reencontrar al reabrir el
// borrador y había que elegirlo otra vez.
describe('Borrador — persistencia del cliente (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenant: TestTenant
  const buscarPorRNC = jest.fn()

  beforeAll(async () => {
    // La validación de RNC contra la DGII se mockea: aquí lo que se prueba es la
    // persistencia del cliente en el borrador, no el padrón.
    ctx = await createTestApp([{ provide: DgiiContribuyentesService, useValue: { buscarPorRNC } }])
    app = ctx.app
    tenant = await createTenant()
  })

  afterAll(async () => { await app.close() })

  const auth = () => ({ Authorization: `Bearer ${tenant.token}` })
  const srv = () => app.getHttpServer()

  const crearContacto = (body: Record<string, unknown>) => {
    buscarPorRNC.mockResolvedValue({ rnc: String(body['rnc'] ?? ''), razonSocial: String(body['razonSocial'] ?? '') })
    return request(srv()).post('/api/v1/contactos').set(auth()).send(body)
  }

  const borrador = (over: Record<string, unknown> = {}) =>
    request(srv()).post('/api/v1/comprobantes').set(auth()).send({
      tipoECF: 'E31', emitir: false, fechaEmision: '01-07-2026', fechaVencimiento: '31-12-2028',
      items: [{ numeroLinea: 1, nombreItem: 'Servicio', cantidad: 1, precioUnitarioItem: 1000, indicadorFacturacion: 'I1', indicadorBienoServicio: 2 }],
      ...over,
    })

  it('guarda el contactoId en el borrador (columna y datos)', async () => {
    const c = await crearContacto({ tipo: 'CLIENTE', razonSocial: 'CLIENTE CON RNC', rnc: '131880681' }).expect(201)

    const draft = await borrador({ contactoId: c.body.id }).expect(201)
    expect(draft.body.estado).toBe('DRAFT')
    expect(draft.body.contactoId).toBe(c.body.id)

    const leido = await request(srv()).get(`/api/v1/comprobantes/${draft.body.id}`).set(auth()).expect(200)
    expect(leido.body.contactoId).toBe(c.body.id)
    expect(leido.body.datos.contactoId).toBe(c.body.id)
  })

  it('un cliente SIN RNC sobrevive al reabrir — el caso que se perdía', async () => {
    const c = await crearContacto({ tipo: 'CONSUMIDOR_FINAL', razonSocial: 'CONSUMIDOR FINAL' }).expect(201)
    expect(c.body.rnc ?? null).toBeFalsy() // sin RNC: el match por RNC era imposible

    const draft = await borrador({ contactoId: c.body.id }).expect(201)
    const leido = await request(srv()).get(`/api/v1/comprobantes/${draft.body.id}`).set(auth()).expect(200)

    // Lo que hace el formulario al reabrir: reencontrar el contacto por id.
    expect(leido.body.datos.contactoId).toBe(c.body.id)
  })

  it('el PATCH del borrador CONSERVA el cliente si no se toca', async () => {
    const c = await crearContacto({ tipo: 'CLIENTE', razonSocial: 'NO ME BORRES', rnc: '130862346' }).expect(201)
    const draft = await borrador({ contactoId: c.body.id }).expect(201)

    await request(srv()).patch(`/api/v1/comprobantes/${draft.body.id}`).set(auth())
      .send({ items: [{ numeroLinea: 1, nombreItem: 'Otro', cantidad: 2, precioUnitarioItem: 500, indicadorFacturacion: 'I1', indicadorBienoServicio: 2 }] })
      .expect(200)

    const leido = await request(srv()).get(`/api/v1/comprobantes/${draft.body.id}`).set(auth()).expect(200)
    expect(leido.body.contactoId).toBe(c.body.id)
    expect(leido.body.datos.contactoId).toBe(c.body.id)
  })

  it('el PATCH puede CAMBIAR el cliente del borrador', async () => {
    const a = await crearContacto({ tipo: 'CLIENTE', razonSocial: 'CLIENTE A', rnc: '131880681' }).expect(201)
    const b = await crearContacto({ tipo: 'CLIENTE', razonSocial: 'CLIENTE B', rnc: '130862346' }).expect(201)
    const draft = await borrador({ contactoId: a.body.id }).expect(201)

    await request(srv()).patch(`/api/v1/comprobantes/${draft.body.id}`).set(auth())
      .send({ contactoId: b.body.id }).expect(200)

    const leido = await request(srv()).get(`/api/v1/comprobantes/${draft.body.id}`).set(auth()).expect(200)
    expect(leido.body.contactoId).toBe(b.body.id)
    // La identidad tiene que cambiar ENTERA: antes quedaba el contacto nuevo con
    // el nombre y el RNC del anterior (lo que imprime el PDF).
    expect(leido.body.razonSocial).toBe('CLIENTE B')
    expect(leido.body.rnc).toBe('130862346')
    expect(leido.body.datos.razonSocialComprador).toBe('CLIENTE B')
  })

  it('regresión: un borrador viejo (sólo RNC, sin contactoId) sigue siendo válido', async () => {
    const draft = await borrador({ rncComprador: '131880681', razonSocialComprador: 'SOLO RNC SRL' }).expect(201)
    const leido = await request(srv()).get(`/api/v1/comprobantes/${draft.body.id}`).set(auth()).expect(200)
    expect(leido.body.contactoId ?? null).toBeNull()
    expect(leido.body.rnc).toBe('131880681') // el front lo reencuentra por RNC
  })
})
