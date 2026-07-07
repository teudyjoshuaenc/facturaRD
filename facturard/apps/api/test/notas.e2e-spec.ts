import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma, ComprobanteEstado } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, initSequences, uploadCert, generateP12, nextRnc, TestTenant } from './helpers/factory'

// e2e Sprint 5 — Notas de crédito/débito (E33/E34) sobre un comprobante ACEPTADO.
describe('Notas de crédito/débito (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenantA: TestTenant
  let tenantB: TestTenant
  let contactoRnc: string
  let contactoId: string
  let fuenteSeq = 0

  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })

  // DD-MM-YYYY de hace N días calendario (para la regla de 30 días).
  function haceNDias(n: number): string {
    const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000)
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
  }

  // Crea un comprobante fuente en el estado dado, con snapshot de comprador e items.
  async function crearFuente(estado: ComprobanteEstado, over: { eNCF?: string; contactoId?: string; fechaEmision?: string } = {}) {
    const datos = {
      tipoECF: 'E31',
      fechaEmision: over.fechaEmision ?? '01-06-2026',
      fechaVencimiento: '31-12-2028',
      rncComprador: contactoRnc,
      razonSocialComprador: 'CLIENTE NOTA SRL',
      items: [
        { numeroLinea: 1, nombreItem: 'Servicio', cantidad: 1, precioUnitarioItem: 1000, indicadorFacturacion: 'I1', indicadorBienoServicio: 2 },
      ],
    }
    return prisma.comprobante.create({
      data: {
        tenantId: tenantA.tenant.id,
        eNCF: over.eNCF ?? `E31${String(++fuenteSeq).padStart(10, '0')}`,
        tipoECF: 'E31',
        estado,
        montoTotal: 1180,
        rnc: contactoRnc,
        razonSocial: 'CLIENTE NOTA SRL',
        ...(over.contactoId !== undefined && { contactoId: over.contactoId }),
        datos,
      },
    })
  }

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
    tenantA = await createTenant()
    tenantB = await createTenant()
    await initSequences(tenantA.tenant.id)
    await uploadCert(app, tenantA.tenant.id, generateP12('NOTA-TENANT-A'))
    contactoRnc = nextRnc()
    const contacto = await prisma.contacto.create({
      data: { tenantId: tenantA.tenant.id, tipo: 'CLIENTE', rnc: contactoRnc, razonSocial: 'CLIENTE NOTA SRL', rncValidado: true },
    })
    contactoId = contacto.id
  })

  afterAll(async () => { await app.close() })

  it('nota sobre fuente no ACEPTADO → 409', async () => {
    const draft = await crearFuente('DRAFT')
    await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${draft.id}/nota`).set(auth(tenantA))
      .send({ tipo: 'E34', codigoModificacion: 2 }).expect(409)
  })

  it('codigoModificacion fuera de rango → 400', async () => {
    const src = await crearFuente('ACEPTADO')
    await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${src.id}/nota`).set(auth(tenantA))
      .send({ tipo: 'E34', codigoModificacion: 9 }).expect(400)
  })

  it('E34 hereda referencia + comprador y pasa por el pipeline una vez', async () => {
    const src = await crearFuente('ACEPTADO', { contactoId })
    ctx.queueAdd.mockClear()

    const res = await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${src.id}/nota`).set(auth(tenantA))
      .send({ tipo: 'E34', codigoModificacion: 2, razonModificacion: 'Ajuste de monto' }).expect(201)

    expect(res.body.tipoECF).toBe('E34')
    expect(res.body.estado).toBe('PENDIENTE') // emitir default true
    expect(res.body.eNCF).toMatch(/^E34\d{10}$/)
    expect(res.body.comprobanteReferenciaId).toBe(src.id)
    expect(res.body.contactoId).toBe(contactoId) // contacto heredado
    // comprador heredado del fuente
    expect(res.body.rnc).toBe(contactoRnc)
    expect(res.body.razonSocial).toBe('CLIENTE NOTA SRL')
    expect(ctx.queueAdd).toHaveBeenCalledTimes(1)

    // referencia fiscal en datos (entra a los generadores E33/E34)
    const nota = await prisma.comprobante.findUniqueOrThrow({ where: { id: res.body.id } })
    const datos = nota.datos as { ncfModificado: string; fechaNCFModificado: string }
    expect(datos.ncfModificado).toBe(src.eNCF)
    expect(datos.fechaNCFModificado).toBe('01-06-2026')
  })

  it('nota con emitir=false → borrador DRAFT sin encolar', async () => {
    const src = await crearFuente('ACEPTADO')
    ctx.queueAdd.mockClear()
    const res = await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${src.id}/nota`).set(auth(tenantA))
      .send({ tipo: 'E33', codigoModificacion: 2, emitir: false }).expect(201)
    expect(res.body.estado).toBe('DRAFT')
    expect(res.body.eNCF).toBeNull()
    expect(res.body.comprobanteReferenciaId).toBe(src.id)
    expect(ctx.queueAdd).not.toHaveBeenCalled()
  })

  it('aislamiento multi-tenant: B no puede crear nota sobre la factura de A (404)', async () => {
    const src = await crearFuente('ACEPTADO')
    await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${src.id}/nota`).set(auth(tenantB))
      .send({ tipo: 'E34', codigoModificacion: 2 }).expect(404)
  })

  // ── FIX 1: IndicadorNotaCredito por regla de 30 días (solo E34) ──────────────
  const indicadorDe = async (id: string): Promise<number | undefined> => {
    const c = await prisma.comprobante.findUniqueOrThrow({ where: { id } })
    return (c.datos as { indicadorNotaCredito?: number }).indicadorNotaCredito
  }

  it('E34 sobre fuente de hace 10 días → IndicadorNotaCredito 0, sin aviso ITBIS', async () => {
    const src = await crearFuente('ACEPTADO', { fechaEmision: haceNDias(10) })
    const res = await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${src.id}/nota`).set(auth(tenantA))
      .send({ tipo: 'E34', codigoModificacion: 2 }).expect(201)
    expect(await indicadorDe(res.body.id)).toBe(0)
    expect(res.body.avisoITBIS).toBeUndefined()
  })

  it('E34 sobre fuente de hace 45 días → IndicadorNotaCredito 1 + aviso de no-rebaja de ITBIS', async () => {
    const src = await crearFuente('ACEPTADO', { fechaEmision: haceNDias(45) })
    const res = await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${src.id}/nota`).set(auth(tenantA))
      .send({ tipo: 'E34', codigoModificacion: 2 }).expect(201)
    expect(await indicadorDe(res.body.id)).toBe(1)
    expect(typeof res.body.avisoITBIS).toBe('string')
    expect(res.body.avisoITBIS).toMatch(/ITBIS/i)
  })

  it('borde: 30 días → 0 ; 31 días → 1', async () => {
    const s30 = await crearFuente('ACEPTADO', { fechaEmision: haceNDias(30) })
    const r30 = await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${s30.id}/nota`).set(auth(tenantA)).send({ tipo: 'E34', codigoModificacion: 2 }).expect(201)
    expect(await indicadorDe(r30.body.id)).toBe(0)

    const s31 = await crearFuente('ACEPTADO', { fechaEmision: haceNDias(31) })
    const r31 = await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${s31.id}/nota`).set(auth(tenantA)).send({ tipo: 'E34', codigoModificacion: 2 }).expect(201)
    expect(await indicadorDe(r31.body.id)).toBe(1)
  })

  it('el caller envía un valor incorrecto → el servidor recalcula por fecha (gana la fecha)', async () => {
    const src = await crearFuente('ACEPTADO', { fechaEmision: haceNDias(10) }) // ≤30 → debe ser 0
    const res = await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${src.id}/nota`).set(auth(tenantA))
      .send({ tipo: 'E34', codigoModificacion: 2, indicadorNotaCredito: 1 }) // caller miente
      .expect(201)
    expect(await indicadorDe(res.body.id)).toBe(0) // la fecha manda
  })

  it('E33 no lleva IndicadorNotaCredito (no aplica el campo)', async () => {
    const src = await crearFuente('ACEPTADO', { fechaEmision: haceNDias(45) })
    const res = await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${src.id}/nota`).set(auth(tenantA))
      .send({ tipo: 'E33', codigoModificacion: 2 }).expect(201)
    expect(await indicadorDe(res.body.id)).toBeUndefined()
    expect(res.body.avisoITBIS).toBeUndefined()
  })

  it('regresión: una E34 normal pasa el pipeline una sola vez', async () => {
    const src = await crearFuente('ACEPTADO', { fechaEmision: haceNDias(5) })
    ctx.queueAdd.mockClear()
    await request(app.getHttpServer())
      .post(`/api/v1/comprobantes/${src.id}/nota`).set(auth(tenantA))
      .send({ tipo: 'E34', codigoModificacion: 2 }).expect(201)
    expect(ctx.queueAdd).toHaveBeenCalledTimes(1)
  })
})
