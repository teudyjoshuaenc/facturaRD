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

  // Crea un comprobante fuente en el estado dado, con snapshot de comprador e items.
  async function crearFuente(estado: ComprobanteEstado, over: { eNCF?: string; contactoId?: string } = {}) {
    const datos = {
      tipoECF: 'E31',
      fechaEmision: '01-06-2026',
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
})
