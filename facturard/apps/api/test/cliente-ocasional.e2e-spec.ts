import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, initSequences, uploadCert, generateP12, TestTenant } from './helpers/factory'
import { DgiiContribuyentesService } from '../src/modules/tenants/dgii-contribuyentes.service'

// e2e — "cliente ocasional" = CONSUMIDOR_FINAL: se factura SIN RNC, y sólo por
// Factura de Consumo (E32). Los tipos que exigen RNC del comprador (E31/E41/E45)
// tienen que rechazarlo ANTES de quemar un e-NCF.
describe('Cliente ocasional — sin RNC (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenant: TestTenant
  const buscarPorRNC = jest.fn()

  beforeAll(async () => {
    ctx = await createTestApp([{ provide: DgiiContribuyentesService, useValue: { buscarPorRNC } }])
    app = ctx.app
    tenant = await createTenant()
    // Emitir exige secuencias + certificado activo; si no, la barrera de emisión
    // devuelve 409 antes de llegar a lo que este spec prueba.
    await initSequences(tenant.tenant.id)
    await uploadCert(app, tenant.tenant.id, generateP12('OCASIONAL-TEST'))
  })

  afterAll(async () => { await app.close() })

  const auth = () => ({ Authorization: `Bearer ${tenant.token}` })
  const srv = () => app.getHttpServer()

  const items = [{ numeroLinea: 1, nombreItem: 'Servicio', cantidad: 1, precioUnitarioItem: 1000, indicadorFacturacion: 'I1', indicadorBienoServicio: 2 }]

  const secuenciaDe = (tipoECF: string) =>
    prisma.secuencia.findFirst({ where: { tenantId: tenant.tenant.id, tipoECF: tipoECF as never } })

  it('se crea con sólo el nombre — sin RNC (lo que hace el alta rápida)', async () => {
    const res = await request(srv()).post('/api/v1/contactos').set(auth())
      .send({ tipo: 'CONSUMIDOR_FINAL', razonSocial: 'JUAN DEL PUEBLO' })
      .expect(201)

    expect(res.body.tipo).toBe('CONSUMIDOR_FINAL')
    expect(res.body.rnc ?? null).toBeFalsy()
    expect(res.body.rncValidado).toBe(false)
    expect(buscarPorRNC).not.toHaveBeenCalled() // sin RNC no se consulta la DGII
  })

  it('un CLIENTE normal SÍ valida el RNC contra la DGII (no se relajó nada)', async () => {
    buscarPorRNC.mockResolvedValue({ rnc: '131880681', razonSocial: 'EMPRESA FORMAL SRL' })
    const res = await request(srv()).post('/api/v1/contactos').set(auth())
      .send({ tipo: 'CLIENTE', rnc: '131880681' })
      .expect(201)

    expect(res.body.rncValidado).toBe(true)
    expect(res.body.razonSocial).toBe('EMPRESA FORMAL SRL')
  })

  it('se factura por E32 bajo el umbral', async () => {
    const c = await request(srv()).post('/api/v1/contactos').set(auth())
      .send({ tipo: 'CONSUMIDOR_FINAL', razonSocial: 'OCASIONAL E32' }).expect(201)

    await request(srv()).post('/api/v1/comprobantes').set(auth()).send({
      tipoECF: 'E32', emitir: false, fechaEmision: '01-07-2026',
      contactoId: c.body.id, razonSocialComprador: 'OCASIONAL E32', items,
    }).expect(201)
  })

  it('E31 sin RNC → 400 y NO consume e-NCF', async () => {
    const c = await request(srv()).post('/api/v1/contactos').set(auth())
      .send({ tipo: 'CONSUMIDOR_FINAL', razonSocial: 'OCASIONAL EN E31' }).expect(201)

    const antes = await secuenciaDe('E31')

    const res = await request(srv()).post('/api/v1/comprobantes').set(auth()).send({
      tipoECF: 'E31', emitir: true, fechaEmision: '01-07-2026', fechaVencimiento: '31-12-2028',
      contactoId: c.body.id, razonSocialComprador: 'OCASIONAL EN E31', items,
    }).expect(400)

    expect(String(res.body.message)).toContain('E31')
    const despues = await secuenciaDe('E31')
    expect(despues?.ultimaSecuencia).toBe(antes?.ultimaSecuencia)
  })

  it('el borrador E31 sin RNC se guarda, pero al EMITIRLO da 400 sin quemar e-NCF', async () => {
    const c = await request(srv()).post('/api/v1/contactos').set(auth())
      .send({ tipo: 'CONSUMIDOR_FINAL', razonSocial: 'BORRADOR OCASIONAL' }).expect(201)

    const draft = await request(srv()).post('/api/v1/comprobantes').set(auth()).send({
      tipoECF: 'E31', emitir: false, fechaEmision: '01-07-2026', fechaVencimiento: '31-12-2028',
      contactoId: c.body.id, razonSocialComprador: 'BORRADOR OCASIONAL', items,
    }).expect(201)

    const antes = await secuenciaDe('E31')
    await request(srv()).post(`/api/v1/comprobantes/${draft.body.id}/emitir`).set(auth()).send({}).expect(400)
    const despues = await secuenciaDe('E31')
    expect(despues?.ultimaSecuencia).toBe(antes?.ultimaSecuencia)
  })

  it('E31 CON RNC sigue emitiendo (regresión del camino fiscal)', async () => {
    buscarPorRNC.mockResolvedValue({ rnc: '131880681', razonSocial: 'EMPRESA FORMAL SRL' })
    const c = await request(srv()).post('/api/v1/contactos').set(auth())
      .send({ tipo: 'CLIENTE', rnc: '131880681' }).expect(201)

    const res = await request(srv()).post('/api/v1/comprobantes').set(auth()).send({
      tipoECF: 'E31', emitir: true, fechaEmision: '01-07-2026', fechaVencimiento: '31-12-2028',
      contactoId: c.body.id, items,
    }).expect(201)

    expect(res.body.eNCF).toMatch(/^E31/)
  })
})
