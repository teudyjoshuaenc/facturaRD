import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, TestTenant } from './helpers/factory'

// e2e Sprint 9 — panel de cumplimiento (solo lectura).
describe('Cumplimiento (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication

  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })
  const DIA = 24 * 60 * 60 * 1000

  // Inserta un certificado con validoHasta controlado (los campos cripto son dummy;
  // cumplimiento sólo lee vigencia/activo).
  async function seedCert(tenantId: string, validoHasta: Date) {
    await prisma.certificado.create({
      data: {
        tenantId, titular: 'TEST', rnc: '000000000', serial: '01', emitidoPor: 'TEST-CA',
        validoDesde: new Date(Date.now() - 365 * DIA), validoHasta,
        p12Encrypted: 'x', p12Iv: 'x', p12Tag: 'x', passphraseCifrada: 'x', activo: true,
      },
    })
  }

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
  })

  afterAll(async () => { await app.close() })

  it('certificado por vencer (10 días) → WARN, no bloquea emisión', async () => {
    const t = await createTenant()
    await seedCert(t.tenant.id, new Date(Date.now() + 10 * DIA))
    const res = await request(app.getHttpServer()).get('/api/v1/cumplimiento').set(auth(t)).expect(200)
    expect(res.body.certificado.vigente).toBe(true)
    expect(res.body.certificado.vencido).toBe(false)
    expect(res.body.certificado.diasRestantes).toBeLessThanOrEqual(10)
    expect(res.body.bloqueaEmision).toBe(false)
    expect(res.body.indicadorGeneral).toBe('WARN')
  })

  it('certificado vencido → CRITICAL + bloquea emisión', async () => {
    const t = await createTenant()
    await seedCert(t.tenant.id, new Date(Date.now() - 5 * DIA))
    const res = await request(app.getHttpServer()).get('/api/v1/cumplimiento').set(auth(t)).expect(200)
    expect(res.body.certificado.vencido).toBe(true)
    expect(res.body.bloqueaEmision).toBe(true)
    expect(res.body.indicadorGeneral).toBe('CRITICAL')
  })

  it('comprobantes RECHAZADO recientes se reflejan en el conteo (con aislamiento)', async () => {
    const t = await createTenant()
    const otro = await createTenant()
    await seedCert(t.tenant.id, new Date(Date.now() + 400 * DIA))

    const rech = await prisma.comprobante.create({
      data: {
        tenantId: t.tenant.id, eNCF: 'E310000000777', tipoECF: 'E31', estado: 'RECHAZADO',
        montoTotal: 1180, rnc: '131880681', razonSocial: 'X SRL',
      },
    })

    const res = await request(app.getHttpServer()).get('/api/v1/cumplimiento').set(auth(t)).expect(200)
    expect(res.body.comprobantesConProblema.count).toBeGreaterThanOrEqual(1)
    expect(res.body.comprobantesConProblema.ids).toContain(rech.id)
    expect(res.body.indicadorGeneral).toBe('WARN') // cert ok pero hay rechazos

    // aislamiento: el otro tenant no ve ese rechazo
    const resOtro = await request(app.getHttpServer()).get('/api/v1/cumplimiento').set(auth(otro)).expect(200)
    expect(resOtro.body.comprobantesConProblema.ids).not.toContain(rech.id)
  })

  it('sin certificado → bloquea emisión y CRITICAL', async () => {
    const t = await createTenant()
    const res = await request(app.getHttpServer()).get('/api/v1/cumplimiento').set(auth(t)).expect(200)
    expect(res.body.certificado.existe).toBe(false)
    expect(res.body.bloqueaEmision).toBe(true)
    expect(res.body.indicadorGeneral).toBe('CRITICAL')
  })
})
