import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, initSequences, uploadCert, generateP12, TestTenant } from './helpers/factory'

// e2e Sprint 1.1 — borradores (DRAFT) y emisión bajo demanda.
// La cola BullMQ está mockeada (ver test-app.ts): la DGII nunca es contactada.
describe('Comprobantes — draft + emisión (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenantA: TestTenant
  let tenantB: TestTenant

  const draftBody = {
    tipoECF: 'E31',
    emitir: false,
    fechaEmision: '01-07-2026',
    fechaVencimiento: '31-12-2028',
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
    tenantB = await createTenant()
    await initSequences(tenantA.tenant.id)
    await initSequences(tenantB.tenant.id)
    await uploadCert(app, tenantA.tenant.id, generateP12('TENANT-A'))
  })

  afterAll(async () => {
    await app.close()
  })

  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })

  it('crea un borrador (emitir=false): estado DRAFT, sin e-NCF, sin encolar', async () => {
    ctx.queueAdd.mockClear()
    const res = await request(app.getHttpServer())
      .post('/api/v1/comprobantes')
      .set(auth(tenantA))
      .send(draftBody)
      .expect(201)

    expect(res.body.estado).toBe('DRAFT')
    expect(res.body.eNCF).toBeNull()
    expect(Number(res.body.montoTotal)).toBe(1180) // 1000 + 18% ITBIS
    expect(ctx.queueAdd).not.toHaveBeenCalled()
  })

  // ── BUG 2: el frontend envía terminoPago + descuento/itbisRetenido/isrRetenido ──
  // por línea. Antes el DTO no los declaraba y forbidNonWhitelisted respondía 400.
  it('crea un borrador con terminoPago + descuento/retenciones por línea → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/comprobantes')
      .set(auth(tenantA))
      .send({
        tipoECF: 'E31',
        tipoPago: 1,
        emitir: false,
        fechaEmision: '16-07-2026',
        rncComprador: '131880681',
        razonSocialComprador: 'CLIENTE TEST SRL',
        terminoPago: 'Neto 30 días',
        items: [
          { numeroLinea: 1, indicadorFacturacion: 'I1', nombreItem: 'Servicio', indicadorBienoServicio: 2, cantidad: 1, precioUnitarioItem: 1000, descuento: 100, itbisRetenido: 27 },
        ],
      })
      .expect(201)

    expect(res.body.estado).toBe('DRAFT')
    // base 900 (1000-100) + ITBIS 162 - ITBIS retenido 27 = 1035
    expect(Number(res.body.montoTotal)).toBe(1035)
    // terminoPago se persiste en datos (round-trip del form).
    expect((res.body.datos as { terminoPago?: string }).terminoPago).toBe('Neto 30 días')
  })

  it('regresión: un borrador SIN campos extra mantiene el montoTotal (DMAIA intacto)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send(draftBody).expect(201)
    expect(Number(res.body.montoTotal)).toBe(1180) // 1000 + 18% ITBIS, sin cambios
  })

  it('el filtro ?estado=DRAFT devuelve los borradores', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/comprobantes?estado=DRAFT')
      .set(auth(tenantA))
      .expect(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    expect(res.body.data.every((c: { estado: string }) => c.estado === 'DRAFT')).toBe(true)
  })

  it('PATCH recalcula totales con líneas mixtas I1 + EXENTO', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send(draftBody).expect(201)

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/comprobantes/${created.body.id}`)
      .set(auth(tenantA))
      .send({
        items: [
          { numeroLinea: 1, indicadorFacturacion: 'I1', nombreItem: 'A', indicadorBienoServicio: 2, cantidad: 1, precioUnitarioItem: 1000 },
          { numeroLinea: 2, indicadorFacturacion: 'E', nombreItem: 'B', indicadorBienoServicio: 1, cantidad: 1, precioUnitarioItem: 500 },
        ],
      })
      .expect(200)

    // 1000 gravado + 180 ITBIS + 500 exento = 1680
    expect(Number(res.body.montoTotal)).toBe(1680)
    expect(res.body.estado).toBe('DRAFT')
  })

  // ── Regresión prod: E310000000012 de DMAIA quedó en ERROR porque un NombreItem
  //    de 96 caracteres no valida contra el XSD (AlfNum80Type, máx 80) — la falla
  //    apareció en el worker DESPUÉS de quemar el e-NCF. Ahora se rechaza al crear,
  //    antes de consumir la secuencia. ──
  describe('NombreItem: límite de 80 caracteres (DGII AlfNum80Type)', () => {
    const nombre81 = 'X'.repeat(81)
    const nombre80 = 'Y'.repeat(80)

    const cuerpo = (nombreItem: string, emitir: boolean) => ({
      tipoECF: 'E31', emitir, fechaEmision: '01-07-2026', fechaVencimiento: '31-12-2028',
      rncComprador: '131880681', razonSocialComprador: 'CLIENTE TEST SRL',
      items: [{ numeroLinea: 1, indicadorFacturacion: 'I1', nombreItem, indicadorBienoServicio: 2, cantidad: 1, precioUnitarioItem: 1000 }],
    })

    it('rechaza un nombre de 81 caracteres al EMITIR, con 400 y SIN quemar e-NCF', async () => {
      ctx.queueAdd.mockClear()
      const res = await request(app.getHttpServer())
        .post('/api/v1/comprobantes').set(auth(tenantA)).send(cuerpo(nombre81, true)).expect(400)

      expect(JSON.stringify(res.body)).toContain('80')
      // El guard corre ANTES de siguienteENCF: no se consumió secuencia ni se encoló.
      expect(ctx.queueAdd).not.toHaveBeenCalled()
    })

    it('rechaza también al guardar como borrador (no crea una trampa inemitible)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/comprobantes').set(auth(tenantA)).send(cuerpo(nombre81, false)).expect(400)
    })

    it('acepta exactamente 80 caracteres', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/comprobantes').set(auth(tenantA)).send(cuerpo(nombre80, false)).expect(201)
      expect(res.body.estado).toBe('DRAFT')
    })

    it('reproduce el caso real: 96 caracteres → 400 (no ERROR silencioso en el worker)', async () => {
      ctx.queueAdd.mockClear()
      const real = ' Dmaia 360 Instalación Incluye: 1) CRM, 2) Pagina Web, 3) Posicionamiento SEO, 4) Redes Sociales'
      expect(real.length).toBeGreaterThan(80)
      await request(app.getHttpServer())
        .post('/api/v1/comprobantes').set(auth(tenantA)).send(cuerpo(real, true)).expect(400)
      expect(ctx.queueAdd).not.toHaveBeenCalled()
    })

    it('un borrador con nombre largo se atrapa al EMITIR, sin quemar e-NCF', async () => {
      // Simula un draft guardado ANTES de esta validación: se inyecta en DB con
      // un nombre >80 saltándose el endpoint de creación, y luego se emite.
      const draft = await request(app.getHttpServer())
        .post('/api/v1/comprobantes').set(auth(tenantA)).send(cuerpo(nombre80, false)).expect(201)
      await prisma.comprobante.update({
        where: { id: draft.body.id },
        data: { datos: { ...cuerpo(nombre81, false) } },
      })

      ctx.queueAdd.mockClear()
      await request(app.getHttpServer())
        .post(`/api/v1/comprobantes/${draft.body.id}/emitir`).set(auth(tenantA)).expect(400)
      expect(ctx.queueAdd).not.toHaveBeenCalled()

      // El e-NCF NO se asignó: sigue siendo un borrador emitible tras corregir.
      const enDb = await prisma.comprobante.findUniqueOrThrow({ where: { id: draft.body.id } })
      expect(enDb.eNCF).toBeNull()
      expect(enDb.estado).toBe('DRAFT')
    })

    it('también atrapa el nombre que viene del SNAPSHOT de producto (>80), no solo el ad-hoc', async () => {
      // El catálogo NO limita el largo del nombre → el snapshot puede exceder 80.
      // Este nombre pasa el DTO (el ítem no trae nombreItem) y lo atrapa el servicio.
      const prod = await request(app.getHttpServer())
        .post('/api/v1/productos').set(auth(tenantA))
        .send({ tipo: 'SERVICIO', nombre: 'Z'.repeat(90), precioUnitario: 1000, tratamientoITBIS: 'I1' }).expect(201)

      ctx.queueAdd.mockClear()
      const res = await request(app.getHttpServer())
        .post('/api/v1/comprobantes').set(auth(tenantA))
        .send({
          tipoECF: 'E31', emitir: true, fechaEmision: '01-07-2026', fechaVencimiento: '31-12-2028',
          rncComprador: '131880681', razonSocialComprador: 'CLIENTE TEST SRL',
          items: [{ numeroLinea: 1, productoId: prod.body.id, cantidad: 1 }],
        })
        .expect(400)

      expect(JSON.stringify(res.body)).toContain('80')
      expect(ctx.queueAdd).not.toHaveBeenCalled()
    })
  })

  it('emite un borrador: asigna e-NCF, encola una vez', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send(draftBody).expect(201)

    ctx.queueAdd.mockClear()
    const res = await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${created.body.id}/emitir`)
      .set(auth(tenantA))
      .expect(201)

    expect(res.body.eNCF).toMatch(/^E31\d{10}$/)
    expect(res.body.estado).toBe('PENDIENTE')
    expect(ctx.queueAdd).toHaveBeenCalledTimes(1)
  })

  it('PATCH sobre un comprobante ya emitido → 409', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send(draftBody).expect(201)
    await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${created.body.id}/emitir`).set(auth(tenantA)).expect(201)

    await request(app.getHttpServer())
      .patch(`/api/v1/comprobantes/${created.body.id}`)
      .set(auth(tenantA))
      .send({ items: draftBody.items })
      .expect(409)
  })

  it('emitir un comprobante ya emitido → 409 (idempotencia)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send(draftBody).expect(201)
    await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${created.body.id}/emitir`).set(auth(tenantA)).expect(201)

    await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${created.body.id}/emitir`).set(auth(tenantA)).expect(409)
  })

  it('aislamiento multi-tenant: B no ve ni edita ni emite el borrador de A (404)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send(draftBody).expect(201)

    await request(app.getHttpServer()).get(`/api/v1/comprobantes/${created.body.id}`).set(auth(tenantB)).expect(404)
    await request(app.getHttpServer()).patch(`/api/v1/comprobantes/${created.body.id}`).set(auth(tenantB)).send({ items: draftBody.items }).expect(404)
    await request(app.getHttpServer()).post(`/api/v1/comprobantes/${created.body.id}/emitir`).set(auth(tenantB)).expect(404)
  })

  // ── FIX 4: E32 consumo >= RD$250,000 exige identificación del comprador ──────
  const e32 = (over: Record<string, unknown> = {}) => ({
    tipoECF: 'E32', fechaEmision: '01-07-2026', tipoPago: 1,
    items: [{ numeroLinea: 1, indicadorFacturacion: 'I1', nombreItem: 'Bien', indicadorBienoServicio: 1, cantidad: 1, precioUnitarioItem: 300000 }],
    ...over,
  })

  it('E32 >= 250K sin identificación del comprador → 400', async () => {
    await request(app.getHttpServer()).post('/api/v1/comprobantes').set(auth(tenantA)).send(e32()).expect(400)
  })

  it('E32 >= 250K con cédula del comprador → 201', async () => {
    ctx.queueAdd.mockClear()
    const res = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA)).send(e32({ rncComprador: '00112345678', razonSocialComprador: 'CLIENTE FISICO' })).expect(201)
    expect(res.body.estado).toBe('PENDIENTE')
    expect(ctx.queueAdd).toHaveBeenCalledTimes(1)
  })

  it('E32 < 250K sin identificación → 201 (permitido)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(tenantA))
      .send(e32({ items: [{ numeroLinea: 1, indicadorFacturacion: 'I1', nombreItem: 'Bien', indicadorBienoServicio: 1, cantidad: 1, precioUnitarioItem: 5000 }] }))
      .expect(201)
    expect(res.body.estado).toBe('PENDIENTE')
  })
})
