import { INestApplication, NotFoundException } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, initSequences, uploadCert, generateP12, nextRnc, TestTenant } from './helpers/factory'
import { DgiiContribuyentesService } from '../src/modules/tenants/dgii-contribuyentes.service'

// e2e — Usuarios NO certificados: onboarding sin P12, cotizar/guardar borradores
// sin certificado, bloqueo de emisión sin cert, cédula, y desbloqueo tras subir P12.
// La cola BullMQ está mockeada (ver test-app.ts): la DGII nunca es contactada.
describe('Sin certificado — cotizar/borradores/emisión bloqueada (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  const buscarPorRNC = jest.fn()

  beforeAll(async () => {
    ctx = await createTestApp([{ provide: DgiiContribuyentesService, useValue: { buscarPorRNC } }])
    app = ctx.app
  })
  afterAll(async () => { await app.close() })
  beforeEach(() => {
    buscarPorRNC.mockReset()
    buscarPorRNC.mockResolvedValue({
      rnc: 'x', razonSocial: 'NEGOCIO SIN CERT SRL', nombreComercial: undefined, estado: 'ACTIVO', categoria: undefined,
    })
  })

  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })

  const draftBody = (emitir: boolean) => ({
    tipoECF: 'E31',
    emitir,
    fechaEmision: '01-07-2026',
    fechaVencimiento: '31-12-2028',
    rncComprador: '131880681',
    razonSocialComprador: 'CLIENTE TEST SRL',
    items: [
      { numeroLinea: 1, indicadorFacturacion: 'I1', nombreItem: 'Servicio', indicadorBienoServicio: 2, cantidad: 1, precioUnitarioItem: 1000 },
    ],
  })

  // ── Onboarding SIN P12 ──────────────────────────────────────────────────────
  it('onboarding SIN P12 → crea tenant sin certificado, secuencias base y devuelve JWT', async () => {
    const rnc = nextRnc()
    const locationId = `loc-${rnc}`
    const res = await request(app.getHttpServer())
      .post('/api/v1/ghl/onboarding')
      .field('locationId', locationId)
      .field('rnc', rnc)
      .expect(201)

    expect(typeof res.body.token).toBe('string')
    expect(res.body.tenant.rnc).toBe(rnc)

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { rnc } })
    const [secs, cert] = await Promise.all([
      prisma.secuencia.count({ where: { tenantId: tenant.id } }),
      prisma.certificado.findFirst({ where: { tenantId: tenant.id, activo: true } }),
    ])
    expect(secs).toBe(10) // todas las secuencias base
    expect(cert).toBeNull() // sin certificado
  })

  it('registro con CÉDULA (11 díg.) → funciona igual que con RNC', async () => {
    const cedula = '00112345678'
    const locationId = `loc-ced-${nextRnc()}`
    const res = await request(app.getHttpServer())
      .post('/api/v1/ghl/onboarding')
      .field('locationId', locationId)
      .field('rnc', cedula)
      .field('tipoIdentificacion', 'CEDULA')
      .expect(201)
    expect(res.body.tenant.rnc).toBe(cedula)
    expect(await prisma.tenant.findUnique({ where: { rnc: cedula } })).not.toBeNull()
  })

  it('CÉDULA fuera del padrón DGII + nombre manual → se acepta con el nombre dado', async () => {
    buscarPorRNC.mockRejectedValueOnce(new NotFoundException('RNC no registrado en la DGII'))
    const cedula = '00298765432'
    const locationId = `loc-ced2-${nextRnc()}`
    const res = await request(app.getHttpServer())
      .post('/api/v1/ghl/onboarding')
      .field('locationId', locationId)
      .field('rnc', cedula)
      .field('tipoIdentificacion', 'CEDULA')
      .field('razonSocial', 'Juan Pérez')
      .expect(201)
    expect(res.body.tenant.razonSocial).toBe('Juan Pérez')
  })

  // ── Tenant sin certificado: borradores y cotizaciones SÍ; emitir NO ──────────
  describe('tenant sin certificado', () => {
    let sinCert: TestTenant

    beforeAll(async () => {
      sinCert = await createTenant()
      await initSequences(sinCert.tenant.id) // secuencias sí, certificado no
    })

    it('GET /tenants → puedeEmitir=false, motivoNoEmite=sinCertificado', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/tenants').set(auth(sinCert)).expect(200)
      expect(res.body[0].puedeEmitir).toBe(false)
      expect(res.body[0].motivoNoEmite).toBe('sinCertificado')
    })

    it('GET /cumplimiento → puedeEmitir=false, motivoNoEmite=sinCertificado', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/cumplimiento').set(auth(sinCert)).expect(200)
      expect(res.body.puedeEmitir).toBe(false)
      expect(res.body.motivoNoEmite).toBe('sinCertificado')
    })

    it('POST /comprobantes emitir=false → 201 DRAFT (sin e-NCF, sin encolar)', async () => {
      ctx.queueAdd.mockClear()
      const res = await request(app.getHttpServer())
        .post('/api/v1/comprobantes').set(auth(sinCert)).send(draftBody(false)).expect(201)
      expect(res.body.estado).toBe('DRAFT')
      expect(res.body.eNCF).toBeNull()
      expect(ctx.queueAdd).not.toHaveBeenCalled()
    })

    it('POST /comprobantes emitir=true → 409 con mensaje claro y accionable', async () => {
      ctx.queueAdd.mockClear()
      const res = await request(app.getHttpServer())
        .post('/api/v1/comprobantes').set(auth(sinCert)).send(draftBody(true)).expect(409)
      expect(res.body.message).toMatch(/certificado digital/i)
      expect(ctx.queueAdd).not.toHaveBeenCalled()
    })

    it('POST /comprobantes/:id/emitir sobre un borrador → 409 claro (no gasta e-NCF)', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/comprobantes').set(auth(sinCert)).send(draftBody(false)).expect(201)
      ctx.queueAdd.mockClear()
      const res = await request(app.getHttpServer())
        .post(`/api/v1/comprobantes/${created.body.id}/emitir`).set(auth(sinCert)).expect(409)
      expect(res.body.message).toMatch(/certificado digital/i)
      expect(ctx.queueAdd).not.toHaveBeenCalled()

      // El borrador sigue intacto (DRAFT, sin e-NCF).
      const still = await prisma.comprobante.findUniqueOrThrow({ where: { id: created.body.id } })
      expect(still.estado).toBe('DRAFT')
      expect(still.eNCF).toBeNull()
    })

    it('crear una cotización → funciona sin certificado', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/cotizaciones').set(auth(sinCert))
        .send({ items: [{ nombre: 'Servicio', cantidad: 1, precioUnitario: 1000, tratamientoITBIS: 'I1' }] })
        .expect(201)
      expect(res.body.folio).toMatch(/^COT-\d{6}$/)
      expect(Number(res.body.total)).toBe(1180)
    })

    it('sube P12 (Configuración) → puedeEmitir pasa a true y emitir=true funciona', async () => {
      // Antes: bloqueado.
      const antes = await request(app.getHttpServer()).get('/api/v1/tenants').set(auth(sinCert)).expect(200)
      expect(antes.body[0].puedeEmitir).toBe(false)

      // Sube el certificado por el flujo real de /certificados/upload.
      await request(app.getHttpServer())
        .post('/api/v1/certificados/upload').set(auth(sinCert))
        .attach('file', generateP12('SIN-CERT-AHORA-CERT').p12Buffer, { filename: 'cert.p12', contentType: 'application/x-pkcs12' })
        .field('passphrase', 'test-pass-1234')
        .expect(201)

      // Ahora: puede emitir.
      const despues = await request(app.getHttpServer()).get('/api/v1/tenants').set(auth(sinCert)).expect(200)
      expect(despues.body[0].puedeEmitir).toBe(true)
      expect(despues.body[0].motivoNoEmite).toBeNull()

      // Y emitir=true ya no se rechaza (encola el job).
      ctx.queueAdd.mockClear()
      const res = await request(app.getHttpServer())
        .post('/api/v1/comprobantes').set(auth(sinCert)).send(draftBody(true)).expect(201)
      expect(res.body.estado).toBe('PENDIENTE')
      expect(res.body.eNCF).toMatch(/^E31\d{10}$/)
      expect(ctx.queueAdd).toHaveBeenCalledTimes(1)
    })
  })

  // ── Regresión: tenant CERTIFICADO sigue emitiendo igual ──────────────────────
  it('regresión: tenant certificado emite normal (puedeEmitir=true, encola)', async () => {
    const certificado = await createTenant()
    await initSequences(certificado.tenant.id)
    await uploadCert(app, certificado.tenant.id, generateP12('DMAIA-LIKE'))

    const status = await request(app.getHttpServer()).get('/api/v1/tenants').set(auth(certificado)).expect(200)
    expect(status.body[0].puedeEmitir).toBe(true)

    ctx.queueAdd.mockClear()
    const res = await request(app.getHttpServer())
      .post('/api/v1/comprobantes').set(auth(certificado)).send(draftBody(true)).expect(201)
    expect(res.body.estado).toBe('PENDIENTE')
    expect(ctx.queueAdd).toHaveBeenCalledTimes(1)
  })
})
