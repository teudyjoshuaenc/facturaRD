import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import * as ecf from '@facturard/ecf-engine'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, uploadCert, generateP12, nextRnc, TestTenant } from './helpers/factory'
import { ReceptorService } from '../src/modules/receptor/receptor.service'

// e2e Sprint 7 — Compras (registro manual, bridge del receptor, aprobación comercial).
describe('Compras (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenantA: TestTenant
  let tenantB: TestTenant

  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })
  const compraBody = (over: Record<string, unknown> = {}) => ({
    tipo: 'E41', rncProveedor: '130111222', razonSocialProveedor: 'PROVEEDOR SRL',
    ncf: 'E410000000001', subtotal: 1000, itbis: 180, ...over,
  })

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
    tenantA = await createTenant()
    tenantB = await createTenant()
    await uploadCert(app, tenantA.tenant.id, generateP12('COMPRA-TENANT-A'))
  })

  afterAll(async () => { await app.close() })

  it('CRUD manual + cross-tenant 404', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/compras').set(auth(tenantA)).send(compraBody()).expect(201)
    expect(created.body.origen).toBe('MANUAL')
    expect(Number(created.body.total)).toBe(1180) // subtotal + itbis
    const id = created.body.id

    await request(app.getHttpServer()).get(`/api/v1/compras/${id}`).set(auth(tenantA)).expect(200)
    const list = await request(app.getHttpServer()).get('/api/v1/compras?tipo=E41').set(auth(tenantA)).expect(200)
    expect(list.body.data.some((c: { id: string }) => c.id === id)).toBe(true)

    const upd = await request(app.getHttpServer())
      .patch(`/api/v1/compras/${id}`).set(auth(tenantA)).send({ subtotal: 2000 }).expect(200)
    expect(Number(upd.body.total)).toBe(2180) // recomputa 2000 + 180

    // cross-tenant
    await request(app.getHttpServer()).get(`/api/v1/compras/${id}`).set(auth(tenantB)).expect(404)
    await request(app.getHttpServer()).patch(`/api/v1/compras/${id}`).set(auth(tenantB)).send({ subtotal: 1 }).expect(404)
    await request(app.getHttpServer()).delete(`/api/v1/compras/${id}`).set(auth(tenantB)).expect(404)

    await request(app.getHttpServer()).delete(`/api/v1/compras/${id}`).set(auth(tenantA)).expect(200)
  })

  it('registro manual con contactoId copia RNC/razón del proveedor', async () => {
    const proveedor = await prisma.contacto.create({
      data: { tenantId: tenantA.tenant.id, tipo: 'PROVEEDOR', rnc: nextRnc(), razonSocial: 'PROV CONTACTO SRL' },
    })
    const res = await request(app.getHttpServer())
      .post('/api/v1/compras').set(auth(tenantA))
      .send({ tipo: 'GASTO_MENOR', contactoId: proveedor.id, subtotal: 500 }).expect(201)
    expect(res.body.rncProveedor).toBe(proveedor.rnc)
    expect(res.body.razonSocialProveedor).toBe('PROV CONTACTO SRL')
  })

  it('bridge receptor: un e-CF entrante crea una CompraRecibida (RECEPCION_DGII/RECIBIDO_ECF/PENDIENTE)', async () => {
    // La verificación de firma se mockea (no hay cadena de CA en el test).
    const spyFirma = jest.spyOn(ecf, 'verificarFirmaEcf').mockReturnValue({ valida: true } as ReturnType<typeof ecf.verificarFirmaEcf>)

    const proveedorRnc = nextRnc()
    const eNCF = 'E320000012345'
    const xml =
      `<?xml version="1.0"?><ECF><Encabezado>` +
      `<Emisor><RNCEmisor>${proveedorRnc}</RNCEmisor><RazonSocialEmisor>PROVEEDOR ENTRANTE SRL</RazonSocialEmisor><FechaEmision>15-06-2026</FechaEmision></Emisor>` +
      `<IdDoc><eNCF>${eNCF}</eNCF><TipoeCF>32</TipoeCF></IdDoc>` +
      `<Comprador><RNCComprador>${tenantA.tenant.rnc}</RNCComprador></Comprador>` +
      `<Totales><TotalITBIS>180.00</TotalITBIS><MontoTotal>1180.00</MontoTotal></Totales>` +
      `</Encabezado></ECF>`

    const receptor = app.get(ReceptorService)
    const result = await receptor.recibirEcf(xml, proveedorRnc)
    // Contrato receptor intacto: sigue devolviendo el ARECF.
    expect(result.xml).toContain('ARECF')
    expect(result.eNCF).toBe(eNCF)

    const compra = await prisma.compraRecibida.findFirstOrThrow({
      where: { tenantId: tenantA.tenant.id, ncf: eNCF, rncProveedor: proveedorRnc },
    })
    expect(compra.origen).toBe('RECEPCION_DGII')
    expect(compra.tipo).toBe('RECIBIDO_ECF')
    expect(compra.estadoAprobacion).toBe('PENDIENTE')
    expect(Number(compra.total)).toBe(1180)
    expect(Number(compra.itbis)).toBe(180)
    expect(compra.razonSocialProveedor).toBe('PROVEEDOR ENTRANTE SRL')

    // Idempotente: re-recibir el mismo e-CF no duplica la compra.
    await receptor.recibirEcf(xml, proveedorRnc)
    const count = await prisma.compraRecibida.count({
      where: { tenantId: tenantA.tenant.id, ncf: eNCF, rncProveedor: proveedorRnc },
    })
    expect(count).toBe(1)

    spyFirma.mockRestore()
  })

  it('aprobación comercial: transiciona estado e invoca el motor DGII una vez', async () => {
    const autenticarSpy = jest.spyOn(ecf, 'autenticar').mockResolvedValue('fake-token')
    const enviarSpy = jest
      .spyOn(ecf, 'enviarAprobacionComercial')
      .mockResolvedValue({ codigo: '01', estado: 'Aprobada', mensaje: [] })

    const compra = await prisma.compraRecibida.create({
      data: {
        tenantId: tenantA.tenant.id, tipo: 'RECIBIDO_ECF', origen: 'RECEPCION_DGII', estadoAprobacion: 'PENDIENTE',
        ncf: 'E310000055555', rncProveedor: '131222333', razonSocialProveedor: 'PROV APROB SRL',
        subtotal: 1000, itbis: 180, itbisRetenido: 0, total: 1180, fechaComprobante: new Date('2026-06-20T12:00:00-04:00'),
      },
    })

    const res = await request(app.getHttpServer())
      .post(`/api/v1/compras/${compra.id}/aprobacion-comercial`).set(auth(tenantA))
      .send({ decision: 'APROBADO' }).expect(201)

    expect(res.body.estadoAprobacion).toBe('APROBADO')
    expect(autenticarSpy).toHaveBeenCalledTimes(1)
    expect(enviarSpy).toHaveBeenCalledTimes(1)

    autenticarSpy.mockRestore()
    enviarSpy.mockRestore()
  })

  it('aprobación comercial sobre compra manual (no RECIBIDO_ECF) → 409', async () => {
    const manual = await request(app.getHttpServer())
      .post('/api/v1/compras').set(auth(tenantA)).send(compraBody({ ncf: 'E410000000009' })).expect(201)
    await request(app.getHttpServer())
      .post(`/api/v1/compras/${manual.body.id}/aprobacion-comercial`).set(auth(tenantA))
      .send({ decision: 'APROBADO' }).expect(409)
  })
})
