import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, initSequences, uploadCert, generateP12, nextRnc, TestTenant } from './helpers/factory'

// e2e Sprint 4 — Cotizaciones (folio atómico, snapshot, conversión reutilizando la emisión).
describe('Cotizaciones (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenantA: TestTenant
  let tenantB: TestTenant

  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })
  const cotBody = (over: Record<string, unknown> = {}) => ({
    items: [
      { nombre: 'Servicio', cantidad: 1, precioUnitario: 1000, tratamientoITBIS: 'I1' },
    ],
    ...over,
  })

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
    tenantA = await createTenant()
    tenantB = await createTenant()
    await initSequences(tenantA.tenant.id)
    await uploadCert(app, tenantA.tenant.id, generateP12('COT-TENANT-A'))
  })

  afterAll(async () => { await app.close() })

  it('CRUD + folio + transición de estado', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/cotizaciones').set(auth(tenantA)).send(cotBody()).expect(201)
    expect(created.body.folio).toMatch(/^COT-\d{6}$/)
    expect(created.body.estado).toBe('BORRADOR')
    expect(Number(created.body.total)).toBe(1180)
    const id = created.body.id

    await request(app.getHttpServer()).get(`/api/v1/cotizaciones/${id}`).set(auth(tenantA)).expect(200)

    // PATCH recalcula totales
    const upd = await request(app.getHttpServer())
      .patch(`/api/v1/cotizaciones/${id}`).set(auth(tenantA))
      .send({ items: [
        { nombre: 'A', cantidad: 1, precioUnitario: 1000, tratamientoITBIS: 'I1' },
        { nombre: 'B', cantidad: 1, precioUnitario: 500, tratamientoITBIS: 'EXENTO' },
      ] }).expect(200)
    expect(Number(upd.body.total)).toBe(1680) // 1000 + 180 + 500

    // BORRADOR → ENVIADA → APROBADA
    await request(app.getHttpServer()).patch(`/api/v1/cotizaciones/${id}/estado`).set(auth(tenantA)).send({ estado: 'ENVIADA' }).expect(200)
    const aprob = await request(app.getHttpServer()).patch(`/api/v1/cotizaciones/${id}/estado`).set(auth(tenantA)).send({ estado: 'APROBADA' }).expect(200)
    expect(aprob.body.estado).toBe('APROBADA')
  })

  it('folios únicos y monótonos bajo concurrencia (N creates en paralelo)', async () => {
    const N = 15
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        request(app.getHttpServer()).post('/api/v1/cotizaciones').set(auth(tenantA)).send(cotBody()),
      ),
    )
    results.forEach((r) => expect(r.status).toBe(201))
    const folios = results.map((r) => r.body.folio as string)
    expect(new Set(folios).size).toBe(N) // ningún folio repetido
  })

  it('totales de cotización == totales de emisión para ítems idénticos', async () => {
    const items = [
      { nombre: 'A', cantidad: 2, precioUnitario: 1000, tratamientoITBIS: 'I1' },
      { nombre: 'B', cantidad: 3, precioUnitario: 250, tratamientoITBIS: 'EXENTO' },
    ]
    const cot = await request(app.getHttpServer())
      .post('/api/v1/cotizaciones').set(auth(tenantA)).send({ items }).expect(201)

    const comp = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send({
        tipoECF: 'E31', emitir: false, fechaEmision: '01-07-2026', fechaVencimiento: '31-12-2028',
        rncComprador: '131880681', razonSocialComprador: 'X SRL',
        items: items.map((it, i) => ({
          numeroLinea: i + 1, nombreItem: it.nombre, cantidad: it.cantidad,
          precioUnitarioItem: it.precioUnitario, indicadorBienoServicio: 2,
          indicadorFacturacion: it.tratamientoITBIS === 'EXENTO' ? 'E' : it.tratamientoITBIS,
        })),
      }).expect(201)

    expect(Number(cot.body.total)).toBe(Number(comp.body.montoTotal))
  })

  it('convertir con emitir=false → comprobante DRAFT, quote CONVERTIDA, enlace bidireccional, DGII no llamada', async () => {
    const cot = await request(app.getHttpServer())
      .post('/api/v1/cotizaciones').set(auth(tenantA)).send(cotBody()).expect(201)

    ctx.queueAdd.mockClear()
    const res = await request(app.getHttpServer())
      .post(`/api/v1/cotizaciones/${cot.body.id}/convertir`).set(auth(tenantA)).send({ emitir: false }).expect(201)

    expect(res.body.comprobante.estado).toBe('DRAFT')
    expect(res.body.comprobante.eNCF).toBeNull()
    expect(res.body.cotizacion.estado).toBe('CONVERTIDA')
    // enlace bidireccional
    expect(res.body.cotizacion.comprobanteId).toBe(res.body.comprobante.id)
    expect(res.body.comprobante.cotizacionId).toBe(cot.body.id)
    expect(ctx.queueAdd).not.toHaveBeenCalled()

    // convertir → emitir el draft resultante → e-NCF asignado, encola una vez
    ctx.queueAdd.mockClear()
    const emitido = await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${res.body.comprobante.id}/emitir`).set(auth(tenantA)).expect(201)
    expect(emitido.body.eNCF).toMatch(/^E3\d\d{10}$/)
    expect(ctx.queueAdd).toHaveBeenCalledTimes(1)

    // re-convertir una cotización CONVERTIDA → 409
    await request(app.getHttpServer())
      .post(`/api/v1/cotizaciones/${cot.body.id}/convertir`).set(auth(tenantA)).send({ emitir: false }).expect(409)
  })

  it('tipo por defecto: contacto con RNC validado → E31; sin contacto → E32', async () => {
    const contacto = await prisma.contacto.create({
      data: { tenantId: tenantA.tenant.id, tipo: 'CLIENTE', rnc: nextRnc(), razonSocial: 'CLIENTE VALIDADO SRL', rncValidado: true },
    })
    const cotConContacto = await request(app.getHttpServer())
      .post('/api/v1/cotizaciones').set(auth(tenantA)).send(cotBody({ contactoId: contacto.id })).expect(201)
    const r1 = await request(app.getHttpServer())
      .post(`/api/v1/cotizaciones/${cotConContacto.body.id}/convertir`).set(auth(tenantA)).send({ emitir: false }).expect(201)
    expect(r1.body.comprobante.tipoECF).toBe('E31')
    expect(r1.body.comprobante.rnc).toBe(contacto.rnc) // identidad copiada del contacto

    const cotSinContacto = await request(app.getHttpServer())
      .post('/api/v1/cotizaciones').set(auth(tenantA)).send(cotBody()).expect(201)
    const r2 = await request(app.getHttpServer())
      .post(`/api/v1/cotizaciones/${cotSinContacto.body.id}/convertir`).set(auth(tenantA)).send({ emitir: false }).expect(201)
    expect(r2.body.comprobante.tipoECF).toBe('E32')
  })

  it('snapshot: editar el producto tras crear la cotización no muta sus líneas', async () => {
    const prod = await request(app.getHttpServer())
      .post('/api/v1/productos').set(auth(tenantA))
      .send({ tipo: 'SERVICIO', nombre: 'Orig', precioUnitario: 3000, tratamientoITBIS: 'I1', codigo: 'COT-SNAP' }).expect(201)

    const cot = await request(app.getHttpServer())
      .post('/api/v1/cotizaciones').set(auth(tenantA))
      .send({ items: [{ productoId: prod.body.id, cantidad: 1 }] }).expect(201)
    expect(cot.body.items[0].nombre).toBe('Orig')
    expect(Number(cot.body.items[0].precioUnitario)).toBe(3000)
    expect(Number(cot.body.total)).toBe(3540)

    await request(app.getHttpServer())
      .patch(`/api/v1/productos/${prod.body.id}`).set(auth(tenantA)).send({ nombre: 'CAMBIADO', precioUnitario: 1 }).expect(200)

    const refetch = await request(app.getHttpServer()).get(`/api/v1/cotizaciones/${cot.body.id}`).set(auth(tenantA)).expect(200)
    expect(refetch.body.items[0].nombre).toBe('Orig')
    expect(Number(refetch.body.items[0].precioUnitario)).toBe(3000)
  })

  it('aislamiento multi-tenant: B no ve, edita ni convierte la cotización de A (404)', async () => {
    const cot = await request(app.getHttpServer())
      .post('/api/v1/cotizaciones').set(auth(tenantA)).send(cotBody()).expect(201)
    const id = cot.body.id
    await request(app.getHttpServer()).get(`/api/v1/cotizaciones/${id}`).set(auth(tenantB)).expect(404)
    await request(app.getHttpServer()).patch(`/api/v1/cotizaciones/${id}`).set(auth(tenantB)).send({ notas: 'x' }).expect(404)
    await request(app.getHttpServer()).post(`/api/v1/cotizaciones/${id}/convertir`).set(auth(tenantB)).send({ emitir: false }).expect(404)
  })
})
