import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, initSequences, uploadCert, generateP12, TestTenant } from './helpers/factory'

// FIX error DGII [145] — la FechaVencimientoSecuencia del e-CF sale de la
// secuencia del tenant (no de un default). La cola está mockeada, así que
// verificamos el valor persistido en `datos.fechaVencimiento`, que es EXACTAMENTE
// lo que el generador coloca en <FechaVencimientoSecuencia>.
describe('FechaVencimientoSecuencia — origen y validación (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let t: TestTenant

  const auth = () => ({ Authorization: `Bearer ${t.token}` })
  const bodyE31 = (over: Record<string, unknown> = {}) => ({
    tipoECF: 'E31',
    fechaEmision: '01-07-2026',
    rncComprador: '131880681',
    razonSocialComprador: 'CLIENTE TEST SRL',
    items: [{ numeroLinea: 1, indicadorFacturacion: 'I1', nombreItem: 'Servicio', indicadorBienoServicio: 2, cantidad: 1, precioUnitarioItem: 1000 }],
    ...over,
  })

  const datosDe = async (id: string): Promise<{ fechaVencimiento?: string }> => {
    const c = await prisma.comprobante.findUniqueOrThrow({ where: { id } })
    return (c.datos ?? {}) as { fechaVencimiento?: string }
  }

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
  })

  afterAll(async () => { await app.close() })

  beforeEach(async () => {
    t = await createTenant()
    await initSequences(t.tenant.id) // fija fechaVencimiento 31-12-2028 en todas
    await uploadCert(app, t.tenant.id, generateP12('FECHA-VENC'))
  })

  it('(a) toma la fecha de la secuencia → datos.fechaVencimiento = fecha del rango', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth()).send(bodyE31()).expect(201)
    expect(res.body.estado).toBe('PENDIENTE')
    expect((await datosDe(res.body.id)).fechaVencimiento).toBe('31-12-2028')
  })

  it('(a2) el override explícito del payload prevalece sobre la secuencia', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth()).send(bodyE31({ fechaVencimiento: '15-06-2027' })).expect(201)
    expect((await datosDe(res.body.id)).fechaVencimiento).toBe('15-06-2027')
  })

  it('(b) sin fecha (ni payload ni secuencia) para un tipo que la exige → 400 claro, sin gastar e-NCF', async () => {
    // Borro la fecha de la secuencia E31 (simula onboarding sin fecha).
    await prisma.secuencia.update({
      where: { tenantId_tipoECF: { tenantId: t.tenant.id, tipoECF: 'E31' } },
      data: { fechaVencimiento: null },
    })
    const antes = await prisma.secuencia.findUniqueOrThrow({
      where: { tenantId_tipoECF: { tenantId: t.tenant.id, tipoECF: 'E31' } },
    })

    const res = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth()).send(bodyE31()).expect(400)
    expect(res.body.message).toMatch(/fecha de vencimiento de la secuencia/i)

    // No se consumió la secuencia: el error ocurre ANTES de asignar el e-NCF.
    const despues = await prisma.secuencia.findUniqueOrThrow({
      where: { tenantId_tipoECF: { tenantId: t.tenant.id, tipoECF: 'E31' } },
    })
    expect(despues.ultimaSecuencia).toBe(antes.ultimaSecuencia)
  })

  it('(c) E32 (no lleva el campo) emite sin fecha aun con la secuencia sin fecha', async () => {
    await prisma.secuencia.update({
      where: { tenantId_tipoECF: { tenantId: t.tenant.id, tipoECF: 'E32' } },
      data: { fechaVencimiento: null },
    })
    const res = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth())
      .send(bodyE31({ tipoECF: 'E32' })).expect(201)
    expect(res.body.estado).toBe('PENDIENTE')
    expect((await datosDe(res.body.id)).fechaVencimiento).toBeUndefined()
  })
})
