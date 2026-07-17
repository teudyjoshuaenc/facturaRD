import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, initSequences, uploadCert, generateP12, TestTenant } from './helpers/factory'

// e2e Fase 2 — "Nota de venta" interna (esFiscal=false): documento NO fiscal.
// La cola BullMQ está mockeada (test-app.ts): la DGII nunca es contactada.
describe('Notas de venta internas (esFiscal=false) — e2e', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenantA: TestTenant // certificado (puede emitir fiscal)
  let tenantSinCert: TestTenant // sin certificado

  const notaBody = {
    tipoECF: 'E32',
    esFiscal: false,
    tipoPago: 1,
    fechaEmision: '16-07-2026',
    razonSocialComprador: 'CLIENTE MOSTRADOR',
    terminoPago: 'Contado',
    items: [
      { numeroLinea: 1, indicadorFacturacion: 'I1', nombreItem: 'Producto', indicadorBienoServicio: 1, cantidad: 1, precioUnitarioItem: 1000 },
    ],
  }

  const fiscalBody = {
    tipoECF: 'E31',
    fechaEmision: '16-07-2026',
    fechaVencimiento: '31-12-2028',
    tipoPago: 1,
    tipoIngresos: '01',
    rncComprador: '131880681',
    razonSocialComprador: 'CLIENTE TEST SRL',
    items: [
      { numeroLinea: 1, indicadorFacturacion: 'I1', nombreItem: 'Servicio', indicadorBienoServicio: 2, cantidad: 1, precioUnitarioItem: 1000 },
    ],
  }

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
    tenantA = await createTenant()
    tenantSinCert = await createTenant()
    await initSequences(tenantA.tenant.id)
    await uploadCert(app, tenantA.tenant.id, generateP12('TENANT-A'))
  })

  afterAll(async () => { await app.close() })

  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })

  it('crea una nota de venta: estado INTERNO, sin e-NCF, folio NV-, NO encola', async () => {
    ctx.queueAdd.mockClear()
    const res = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send(notaBody).expect(201)

    expect(res.body.estado).toBe('INTERNO')
    expect(res.body.esFiscal).toBe(false)
    expect(res.body.eNCF).toBeNull()
    expect(res.body.folioInterno).toMatch(/^NV-\d{6}$/)
    expect(Number(res.body.montoTotal)).toBe(1180) // 1000 + 18% ITBIS
    // NO firma, NO DGII, NO encola:
    expect(ctx.queueAdd).not.toHaveBeenCalled()
  })

  it('nota de venta SOLO con ítems (sin NINGÚN campo fiscal) → 201, tipoECF se default-ea', async () => {
    ctx.queueAdd.mockClear()
    const res = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantSinCert))
      .send({
        esFiscal: false,
        fechaEmision: '16-07-2026',
        // sin tipoECF, sin tipoPago, sin tipoIngresos, sin fechaVencimiento, sin terminoPago, sin rnc
        items: [{ numeroLinea: 1, indicadorFacturacion: 'I1', nombreItem: 'Producto', indicadorBienoServicio: 1, cantidad: 1, precioUnitarioItem: 1000 }],
      })
      .expect(201)
    expect(res.body.estado).toBe('INTERNO')
    expect(res.body.esFiscal).toBe(false)
    expect(res.body.tipoECF).toBe('E32') // default informativo
    expect(res.body.folioInterno).toMatch(/^NV-\d{6}$/)
    expect(ctx.queueAdd).not.toHaveBeenCalled()
  })

  it('nota de venta con fechaVencimiento/terminoPago → se guardan (opcionales)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantSinCert))
      .send({
        esFiscal: false,
        tipoPago: 2,
        fechaEmision: '16-07-2026',
        fechaVencimiento: '30-07-2026',
        terminoPago: 'Neto 15',
        items: [{ numeroLinea: 1, indicadorFacturacion: 'I1', nombreItem: 'Producto', indicadorBienoServicio: 1, cantidad: 1, precioUnitarioItem: 1000 }],
      })
      .expect(201)
    expect(res.body.estado).toBe('INTERNO')
    expect((res.body.datos as { fechaVencimiento?: string; terminoPago?: string }).fechaVencimiento).toBe('30-07-2026')
    expect((res.body.datos as { terminoPago?: string }).terminoPago).toBe('Neto 15')
  })

  it('regresión fiscal: un e-CF fiscal SIN tipoECF → 400 (tipoECF sigue obligatorio para fiscal)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA))
      .send({
        emitir: false, // fiscal (esFiscal por default true)
        fechaEmision: '16-07-2026',
        items: [{ numeroLinea: 1, indicadorFacturacion: 'I1', nombreItem: 'X', indicadorBienoServicio: 2, cantidad: 1, precioUnitarioItem: 1000 }],
      })
      .expect(400)
  })

  it('la numeración interna es atómica y correlativa (NV-000001, NV-000002...)', async () => {
    const t = await createTenant()
    const a = await request(app.getHttpServer()).post('/api/v1/comprobantes').set(auth(t)).send(notaBody).expect(201)
    const b = await request(app.getHttpServer()).post('/api/v1/comprobantes').set(auth(t)).send(notaBody).expect(201)
    expect(a.body.folioInterno).toBe('NV-000001')
    expect(b.body.folioInterno).toBe('NV-000002')
  })

  it('un tenant SIN certificado puede crear una nota de venta (no exige cert)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantSinCert)).send(notaBody).expect(201)
    expect(res.body.estado).toBe('INTERNO')
    expect(res.body.folioInterno).toMatch(/^NV-\d{6}$/)
  })

  it('la nota de venta es EDITABLE (PATCH) y recalcula totales; sigue no fiscal', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send(notaBody).expect(201)

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/comprobantes/${created.body.id}`).set(auth(tenantA))
      .send({
        items: [
          { numeroLinea: 1, indicadorFacturacion: 'I1', nombreItem: 'A', indicadorBienoServicio: 1, cantidad: 2, precioUnitarioItem: 1000 },
        ],
      })
      .expect(200)

    expect(Number(res.body.montoTotal)).toBe(2360) // 2000 + 18%
    expect(res.body.estado).toBe('INTERNO')
    expect(res.body.esFiscal).toBe(false)
    expect(res.body.folioInterno).toBe(created.body.folioInterno) // folio no cambia
  })

  it('la nota de venta es ELIMINABLE (soft delete): DELETE → luego 404 y fuera de la lista', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send(notaBody).expect(201)

    await request(app.getHttpServer())
      .delete(`/api/v1/comprobantes/${created.body.id}`).set(auth(tenantA)).expect(200)

    // ya no es accesible
    await request(app.getHttpServer())
      .get(`/api/v1/comprobantes/${created.body.id}`).set(auth(tenantA)).expect(404)

    // no aparece en la lista de notas
    const lista = await request(app.getHttpServer())
      .get('/api/v1/comprobantes?clase=nota').set(auth(tenantA)).expect(200)
    expect(lista.body.data.some((c: { id: string }) => c.id === created.body.id)).toBe(false)

    // pero el registro sigue en la DB marcado como eliminado (soft delete)
    const row = await prisma.comprobante.findUnique({ where: { id: created.body.id } })
    expect(row?.eliminado).toBe(true)
  })

  it('el filtro ?clase=nota devuelve solo notas de venta (esFiscal=false)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/comprobantes?clase=nota').set(auth(tenantA)).expect(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    expect(res.body.data.every((c: { esFiscal: boolean }) => c.esFiscal === false)).toBe(true)
  })

  it('un e-CF fiscal EMITIDO no es editable (PATCH → 409) ni eliminable (DELETE → 409)', async () => {
    // Crear + emitir un fiscal → estado PENDIENTE (ya consumió e-NCF)
    const created = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send({ ...fiscalBody, emitir: false }).expect(201)
    await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${created.body.id}/emitir`).set(auth(tenantA)).expect(201)

    await request(app.getHttpServer())
      .patch(`/api/v1/comprobantes/${created.body.id}`).set(auth(tenantA)).send({ items: fiscalBody.items }).expect(409)
    await request(app.getHttpServer())
      .delete(`/api/v1/comprobantes/${created.body.id}`).set(auth(tenantA)).expect(409)
  })

  it('regresión DMAIA: la emisión fiscal sigue igual (e-NCF asignado, encola una vez)', async () => {
    ctx.queueAdd.mockClear()
    const res = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send({ ...fiscalBody, emitir: true }).expect(201)

    expect(res.body.esFiscal).toBe(true)
    expect(res.body.eNCF).toMatch(/^E31\d{10}$/)
    expect(res.body.estado).toBe('PENDIENTE')
    expect(ctx.queueAdd).toHaveBeenCalledTimes(1)
  })

  it('puente "Facturar formalmente": crear un e-CF fiscal con los datos de una nota es una emisión NUEVA (no muta la nota)', async () => {
    const nota = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send(notaBody).expect(201)

    // El front prellena el form fiscal (cloneId) y el usuario emite: emisión real.
    ctx.queueAdd.mockClear()
    const fiscal = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send({ ...fiscalBody, emitir: true }).expect(201)
    expect(fiscal.body.esFiscal).toBe(true)
    expect(fiscal.body.eNCF).toMatch(/^E31\d{10}$/)
    expect(ctx.queueAdd).toHaveBeenCalledTimes(1)

    // La nota original queda intacta (no se "convirtió")
    const notaAfter = await request(app.getHttpServer())
      .get(`/api/v1/comprobantes/${nota.body.id}`).set(auth(tenantA)).expect(200)
    expect(notaAfter.body.estado).toBe('INTERNO')
    expect(notaAfter.body.esFiscal).toBe(false)
    expect(notaAfter.body.eNCF).toBeNull()
  })

  it('doble defensa en el 607: un documento esFiscal=false NUNCA entra al reporte', async () => {
    const t = await createTenant()
    const createdAt = new Date('2026-08-10T12:00:00-04:00')
    // fiscal ACEPTADO en el período → SÍ va al 607
    await prisma.comprobante.create({
      data: {
        tenantId: t.tenant.id, eNCF: 'E310000009001', tipoECF: 'E31', estado: 'ACEPTADO', esFiscal: true,
        montoTotal: 1180, rnc: '131880681', razonSocial: 'CLIENTE SRL', createdAt,
        datos: { tipoECF: 'E31', fechaEmision: '10-08-2026', tipoIngresos: '01', tipoPago: 1, rncComprador: '131880681', razonSocialComprador: 'CLIENTE SRL', items: [{ numeroLinea: 1, nombreItem: 'X', cantidad: 1, precioUnitarioItem: 1000, indicadorFacturacion: 'I1', indicadorBienoServicio: 2 }] },
      },
    })
    // esFiscal=false, forzado a ACEPTADO (caso imposible-pero-defensivo) → NO debe entrar al 607
    await prisma.comprobante.create({
      data: {
        tenantId: t.tenant.id, eNCF: null, folioInterno: 'NV-000099', tipoECF: 'E31', estado: 'ACEPTADO', esFiscal: false,
        montoTotal: 5000, rnc: '', razonSocial: 'INTERNO', createdAt,
        datos: { tipoECF: 'E31', fechaEmision: '10-08-2026', tipoIngresos: '01', tipoPago: 1, items: [{ numeroLinea: 1, nombreItem: 'X', cantidad: 1, precioUnitarioItem: 5000, indicadorFacturacion: 'I1', indicadorBienoServicio: 2 }] },
      },
    })

    const res = await request(app.getHttpServer())
      .get('/api/v1/reportes/607?desde=2026-08-01&hasta=2026-08-31').set(auth(t)).expect(200)
    expect(res.body.totales.registros).toBe(1) // solo el fiscal
    // montoFacturado = base gravada (sin ITBIS); el 5000 del interno NO suma
    expect(res.body.totales.montoFacturado).toBe(1000)
  })
})
