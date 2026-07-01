import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { existsSync, statSync, rmSync } from 'fs'
import { join } from 'path'
import { generarRepresentacionImpresa } from '@facturard/ecf-engine'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, TestTenant } from './helpers/factory'

// e2e Sprint 6 — branding del tenant en el PDF.
describe('Branding (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenant: TestTenant
  const outDir = process.env['TMPDIR'] ?? '/tmp'

  const auth = () => ({ Authorization: `Bearer ${tenant.token}` })

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
    tenant = await createTenant()
  })

  afterAll(async () => { await app.close() })

  it('PATCH /tenants/branding con colores válidos → 200 y persiste', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/tenants/branding').set(auth())
      .send({ logoUrl: 'https://example.com/logo.png', colorPrimario: '#1A73E8', colorSecundario: '#E8E8E8' })
      .expect(200)

    const t = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenant.tenant.id}`).set(auth()).expect(200)
    expect(t.body.colorPrimario).toBe('#1A73E8')
    expect(t.body.colorSecundario).toBe('#E8E8E8')
    expect(t.body.logoUrl).toBe('https://example.com/logo.png')
  })

  it('color hex inválido → 400', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/tenants/branding').set(auth())
      .send({ colorPrimario: 'red' })
      .expect(400)
  })

  it('logo inalcanzable → el PDF se genera igual (sin logo, sin excepción)', async () => {
    const outputPath = join(outDir, `branding-test-${Date.now()}.pdf`)
    await expect(
      generarRepresentacionImpresa(
        {
          rncEmisor: '132883225',
          nombreEmisor: 'DMAIA SRL',
          eNCF: 'E310000000001',
          tipoECF: 'E31',
          fechaEmision: '01-07-2026',
          items: [{ descripcion: 'Servicio', cantidad: 1, precioUnitario: 1000, itbis: 180, valor: 1000 }],
          montoTotal: 1180,
          itbisTotal: 180,
          montoGravadoTotal: 1000,
          // color aplicado + logo inalcanzable (debe omitirse sin lanzar)
          colorPrimario: '#FF0000',
          colorSecundario: '#00FF00',
          logoUrl: 'http://127.0.0.1:9/no-existe.png',
        },
        outputPath,
      ),
    ).resolves.toBeUndefined()

    expect(existsSync(outputPath)).toBe(true)
    expect(statSync(outputPath).size).toBeGreaterThan(0)
    rmSync(outputPath, { force: true })
  })

  it('sin branding: el PDF usa defaults y se genera igual', async () => {
    const outputPath = join(outDir, `branding-default-${Date.now()}.pdf`)
    await generarRepresentacionImpresa(
      {
        rncEmisor: '132883225',
        nombreEmisor: 'DMAIA SRL',
        eNCF: 'E310000000002',
        tipoECF: 'E31',
        fechaEmision: '01-07-2026',
        items: [{ descripcion: 'Servicio', cantidad: 1, precioUnitario: 1000, itbis: 180, valor: 1000 }],
        montoTotal: 1180,
        itbisTotal: 180,
        montoGravadoTotal: 1000,
      },
      outputPath,
    )
    expect(existsSync(outputPath)).toBe(true)
    rmSync(outputPath, { force: true })
  })
})
