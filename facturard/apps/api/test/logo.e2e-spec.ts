import { INestApplication, BadRequestException, ServiceUnavailableException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import request from 'supertest'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, TestTenant } from './helpers/factory'
import {
  CloudinaryService,
  LOGO_MIME_PERMITIDOS,
  LOGO_MAX_BYTES,
} from '../src/common/services/cloudinary.service'

// Upload REAL del logo (Cloudinary). El servicio de Cloudinary se MOCKEA en el
// flujo HTTP (no se toca la red), pero:
//  - las URLs f_png (PDF) / f_auto (UI) y la validación de tipo/tamaño se prueban
//    contra la implementación REAL (son puras, sin red);
//  - hay un bloque LIVE opcional (CLOUDINARY_LIVE_TEST=1) que sube un SVG real y
//    verifica que la derivada f_png llega como image/png (rasterización SVG→PNG).

// ── Estado compartido del mock de Cloudinary ────────────────────────────────
const uploadCalls: Array<{ tenantId: string; mimetype: string; size: number }> = []
let failMode: 'auth' | 'down' | null = null

const cloudinaryMock = {
  pdfUrl: (publicId: string, version?: number): string =>
    `https://res.cloudinary.com/test/image/upload/c_limit,h_160,q_auto,w_360/f_png/${
      version !== undefined ? `v${version}/` : ''
    }${publicId}`,
  previewUrl: (publicId: string): string =>
    `https://res.cloudinary.com/test/image/upload/c_limit,h_160,q_auto,w_360/f_auto/${publicId}`,
  subirLogo: async (tenantId: string, file: Buffer, mimetype: string) => {
    uploadCalls.push({ tenantId, mimetype, size: file.byteLength })
    if (!(LOGO_MIME_PERMITIDOS as readonly string[]).includes(mimetype)) {
      throw new BadRequestException(`Tipo de archivo no permitido (${mimetype}).`)
    }
    if (file.byteLength > LOGO_MAX_BYTES) {
      throw new BadRequestException('El logo supera el máximo de 2 MB.')
    }
    if (failMode === 'auth') {
      throw new ServiceUnavailableException('las credenciales de Cloudinary son inválidas.')
    }
    if (failMode === 'down') {
      throw new ServiceUnavailableException('servicio de imágenes no disponible.')
    }
    // public_id FIJO derivado del tenantId → mismo path al reemplazar (cero huérfanos).
    const publicId = `facturard/${tenantId}/logo`
    const version = 100 + uploadCalls.length
    return { secureUrl: cloudinaryMock.pdfUrl(publicId, version), publicId }
  },
}

const png1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMEAYAh1D0AAAAASUVORK5CYII=',
  'base64',
)
const svgLogo = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="#1A73E8"/></svg>',
)

describe('Logo upload (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenant: TestTenant

  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })

  beforeAll(async () => {
    ctx = await createTestApp([{ provide: CloudinaryService, useValue: cloudinaryMock }])
    app = ctx.app
    tenant = await createTenant()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    uploadCalls.length = 0
    failMode = null
  })

  // ── Parte A — implementación REAL (pura, sin red) ─────────────────────────
  describe('CloudinaryService (puro, sin red)', () => {
    const real = new CloudinaryService({ getOrThrow: () => 'dummy' } as unknown as ConfigService)

    it('pdfUrl usa f_png y el path del tenant', () => {
      const url = real.pdfUrl('facturard/abc/logo', 7)
      expect(url).toContain('/f_png/')
      expect(url).toContain('facturard/abc/logo')
      expect(url).toContain('v7')
    })

    it('previewUrl usa f_auto (para la UI)', () => {
      expect(real.previewUrl('facturard/abc/logo')).toContain('/f_auto/')
    })

    it('rechaza tipo no permitido antes de tocar la red', async () => {
      await expect(real.subirLogo('t1', Buffer.from('x'), 'application/pdf')).rejects.toBeInstanceOf(
        BadRequestException,
      )
    })

    it('rechaza archivos > 2 MB antes de tocar la red', async () => {
      const big = Buffer.alloc(LOGO_MAX_BYTES + 1)
      await expect(real.subirLogo('t1', big, 'image/png')).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  // ── Parte B — flujo HTTP (Cloudinary mockeado) ────────────────────────────
  it('POST /tenants/logo con PNG → 200, guarda f_png + publicId + preview f_auto', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tenants/logo')
      .set(auth(tenant))
      .attach('file', png1x1, { filename: 'logo.png', contentType: 'image/png' })
      .expect(201)

    expect(res.body.logoUrl).toContain('/f_png/')
    expect(res.body.logoUrl).toContain(`facturard/${tenant.tenant.id}/logo`)
    expect(res.body.logoPublicId).toBe(`facturard/${tenant.tenant.id}/logo`)
    expect(res.body.logoPreviewUrl).toContain('/f_auto/')

    // Persistió
    const t = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${tenant.tenant.id}`)
      .set(auth(tenant))
      .expect(200)
    expect(t.body.logoPublicId).toBe(`facturard/${tenant.tenant.id}/logo`)
    expect(t.body.logoUrl).toContain('/f_png/')
  })

  it('SVG subido se sirve como PNG al PDF (logoUrl con f_png)', async () => {
    const t = await createTenant()
    const res = await request(app.getHttpServer())
      .post('/api/v1/tenants/logo')
      .set(auth(t))
      .attach('file', svgLogo, { filename: 'logo.svg', contentType: 'image/svg+xml' })
      .expect(201)

    expect(uploadCalls.at(-1)?.mimetype).toBe('image/svg+xml')
    // La derivada guardada para el PDF es f_png aunque el original sea SVG.
    expect(res.body.logoUrl).toContain('/f_png/')
  })

  it('tipo no permitido (PDF) → 400 accionable', async () => {
    const t = await createTenant()
    const res = await request(app.getHttpServer())
      .post('/api/v1/tenants/logo')
      .set(auth(t))
      .attach('file', Buffer.from('%PDF-1.4'), { filename: 'x.pdf', contentType: 'application/pdf' })
      .expect(400)
    expect(String(res.body.message)).toMatch(/no permitido/i)
  })

  it('archivo > 2 MB → 400 con mensaje de tamaño (rechazado en el pipe)', async () => {
    const t = await createTenant()
    const big = Buffer.alloc(LOGO_MAX_BYTES + 10)
    const res = await request(app.getHttpServer())
      .post('/api/v1/tenants/logo')
      .set(auth(t))
      .attach('file', big, { filename: 'big.png', contentType: 'image/png' })
      .expect(400)
    expect(String(res.body.message)).toMatch(/2 MB/i)
  })

  it('sin archivo → 400 accionable', async () => {
    const t = await createTenant()
    const res = await request(app.getHttpServer())
      .post('/api/v1/tenants/logo')
      .set(auth(t))
      .expect(400)
    expect(String(res.body.message)).toMatch(/archivo/i)
  })

  it('requiere JWT → 401 sin token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/tenants/logo')
      .attach('file', png1x1, { filename: 'logo.png', contentType: 'image/png' })
      .expect(401)
  })

  it('aislamiento multi-tenant: el path se deriva del tenant del JWT, no del cliente', async () => {
    const a = await createTenant()
    const b = await createTenant()

    const ra = await request(app.getHttpServer())
      .post('/api/v1/tenants/logo')
      .set(auth(a))
      .attach('file', png1x1, { filename: 'a.png', contentType: 'image/png' })
      .expect(201)
    const rb = await request(app.getHttpServer())
      .post('/api/v1/tenants/logo')
      .set(auth(b))
      .attach('file', png1x1, { filename: 'b.png', contentType: 'image/png' })
      .expect(201)

    expect(ra.body.logoPublicId).toBe(`facturard/${a.tenant.id}/logo`)
    expect(rb.body.logoPublicId).toBe(`facturard/${b.tenant.id}/logo`)
    expect(ra.body.logoPublicId).not.toBe(rb.body.logoPublicId)

    // El logo de A no fue pisado por el de B.
    const ta = await request(app.getHttpServer())
      .get(`/api/v1/tenants/${a.tenant.id}`)
      .set(auth(a))
      .expect(200)
    expect(ta.body.logoUrl).toContain(`facturard/${a.tenant.id}/logo`)
  })

  it('reemplazar usa el MISMO public_id (cero huérfanos por construcción)', async () => {
    const t = await createTenant()
    const r1 = await request(app.getHttpServer())
      .post('/api/v1/tenants/logo')
      .set(auth(t))
      .attach('file', png1x1, { filename: '1.png', contentType: 'image/png' })
      .expect(201)
    const r2 = await request(app.getHttpServer())
      .post('/api/v1/tenants/logo')
      .set(auth(t))
      .attach('file', svgLogo, { filename: '2.svg', contentType: 'image/svg+xml' })
      .expect(201)

    expect(r1.body.logoPublicId).toBe(`facturard/${t.tenant.id}/logo`)
    expect(r2.body.logoPublicId).toBe(r1.body.logoPublicId)
  })

  it('coexiste con el enlace manual y limpia logoPublicId al cambiar a URL externa', async () => {
    const t = await createTenant()

    // 1) Enlace externo manual
    await request(app.getHttpServer())
      .patch('/api/v1/tenants/empresa')
      .set(auth(t))
      .send({ logoUrl: 'https://externo.do/logo.png' })
      .expect(200)
    let g = await request(app.getHttpServer()).get(`/api/v1/tenants/${t.tenant.id}`).set(auth(t)).expect(200)
    expect(g.body.logoUrl).toBe('https://externo.do/logo.png')
    expect(g.body.logoPublicId).toBeNull()
    expect(g.body.logoPreviewUrl).toBeNull()

    // 2) Subir archivo → gestionado por Cloudinary
    await request(app.getHttpServer())
      .post('/api/v1/tenants/logo')
      .set(auth(t))
      .attach('file', png1x1, { filename: 'logo.png', contentType: 'image/png' })
      .expect(201)
    g = await request(app.getHttpServer()).get(`/api/v1/tenants/${t.tenant.id}`).set(auth(t)).expect(200)
    expect(g.body.logoPublicId).toBe(`facturard/${t.tenant.id}/logo`)
    expect(g.body.logoPreviewUrl).toContain('/f_auto/')

    // 3) Volver a enlace externo → limpia el logo gestionado
    await request(app.getHttpServer())
      .patch('/api/v1/tenants/empresa')
      .set(auth(t))
      .send({ logoUrl: 'https://externo.do/otro.png' })
      .expect(200)
    g = await request(app.getHttpServer()).get(`/api/v1/tenants/${t.tenant.id}`).set(auth(t)).expect(200)
    expect(g.body.logoUrl).toBe('https://externo.do/otro.png')
    expect(g.body.logoPublicId).toBeNull()
    expect(g.body.logoPreviewUrl).toBeNull()
  })

  it('Cloudinary caído → 503 y el logo previo NO cambia', async () => {
    const t = await createTenant()
    // Primero un logo válido
    const ok = await request(app.getHttpServer())
      .post('/api/v1/tenants/logo')
      .set(auth(t))
      .attach('file', png1x1, { filename: 'logo.png', contentType: 'image/png' })
      .expect(201)
    const logoAntes = ok.body.logoUrl

    // Ahora Cloudinary falla
    failMode = 'down'
    await request(app.getHttpServer())
      .post('/api/v1/tenants/logo')
      .set(auth(t))
      .attach('file', png1x1, { filename: 'logo2.png', contentType: 'image/png' })
      .expect(503)

    const g = await request(app.getHttpServer()).get(`/api/v1/tenants/${t.tenant.id}`).set(auth(t)).expect(200)
    expect(g.body.logoUrl).toBe(logoAntes)
  })
})

// ── Bloque LIVE opcional — prueba real SVG → PNG contra Cloudinary ──────────
// Corre sólo con CLOUDINARY_LIVE_TEST=1 y credenciales reales en el entorno.
const liveDescribe = process.env['CLOUDINARY_LIVE_TEST'] === '1' ? describe : describe.skip
liveDescribe('Cloudinary LIVE — SVG se rasteriza a PNG', () => {
  it('sube un SVG y la derivada f_png responde con content-type image/png', async () => {
    const { ConfigService: RealConfig } = await import('@nestjs/config')
    const cfg = new RealConfig()
    const svc = new CloudinaryService(cfg)
    const { secureUrl } = await svc.subirLogo(`livetest-${Date.now()}`, svgLogo, 'image/svg+xml')
    expect(secureUrl).toContain('/f_png/')
    const res = await fetch(secureUrl)
    expect(res.ok).toBe(true)
    expect(res.headers.get('content-type')).toMatch(/image\/png/)
  }, 30000)
})
