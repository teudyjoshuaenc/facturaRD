import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, initSequences, TestTenant } from './helpers/factory'

// La descripción de la línea (DescripcionItem del e-CF, AlfNum1000Type) se
// capturaba en el formulario y se perdía: no existía en el DTO. Aquí se cubre
// el viaje completo: request → datos persistidos → snapshot de producto.
describe('Comprobantes — descripción de línea (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenant: TestTenant

  const base = {
    tipoECF: 'E31',
    emitir: false,
    fechaEmision: '01-07-2026',
    fechaVencimiento: '31-12-2028',
    rncComprador: '131880681',
    razonSocialComprador: 'CLIENTE TEST SRL',
  }

  const DESC = 'Servicios Mensualidad\n1. DMAIA CRM 360\n2. PUBLICACIÓN REDES SOCIALES'

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
    tenant = await createTenant()
    await initSequences(tenant.tenant.id)
  })

  afterAll(async () => {
    await app.close()
  })

  const auth = () => ({ Authorization: `Bearer ${tenant.token}` })

  it('guarda la descripción enviada en la línea', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/comprobantes')
      .set(auth())
      .send({
        ...base,
        items: [
          {
            numeroLinea: 1,
            indicadorFacturacion: 'I1',
            nombreItem: 'Dmaia 360',
            descripcion: DESC,
            indicadorBienoServicio: 2,
            cantidad: 1,
            precioUnitarioItem: 30549.15,
          },
        ],
      })
      .expect(201)

    const c = await prisma.comprobante.findUniqueOrThrow({ where: { id: res.body.id } })
    expect((c.datos as any).items[0].descripcion).toBe(DESC)
  })

  it('hereda la descripción del catálogo cuando la línea no la trae (snapshot)', async () => {
    const prod = await request(app.getHttpServer())
      .post('/api/v1/productos')
      .set(auth())
      .send({
        tipo: 'SERVICIO',
        nombre: 'Mensualidad',
        descripcion: 'Incluye CRM, web y SEO',
        precioUnitario: 1000,
        tratamientoITBIS: 'I1',
      })
      .expect(201)

    const res = await request(app.getHttpServer())
      .post('/api/v1/comprobantes')
      .set(auth())
      .send({ ...base, items: [{ numeroLinea: 1, productoId: prod.body.id, cantidad: 1 }] })
      .expect(201)

    const c = await prisma.comprobante.findUniqueOrThrow({ where: { id: res.body.id } })
    expect((c.datos as any).items[0].descripcion).toBe('Incluye CRM, web y SEO')
  })

  it('la descripción de la línea gana sobre la del catálogo', async () => {
    const prod = await request(app.getHttpServer())
      .post('/api/v1/productos')
      .set(auth())
      .send({
        tipo: 'SERVICIO',
        nombre: 'Mensualidad 2',
        descripcion: 'Texto del catálogo',
        precioUnitario: 1000,
        tratamientoITBIS: 'I1',
      })
      .expect(201)

    const res = await request(app.getHttpServer())
      .post('/api/v1/comprobantes')
      .set(auth())
      .send({
        ...base,
        items: [{ numeroLinea: 1, productoId: prod.body.id, cantidad: 1, descripcion: DESC }],
      })
      .expect(201)

    const c = await prisma.comprobante.findUniqueOrThrow({ where: { id: res.body.id } })
    expect((c.datos as any).items[0].descripcion).toBe(DESC)
  })

  it('rechaza con 400 una descripción de más de 1000 caracteres (tope del XSD)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/comprobantes')
      .set(auth())
      .send({
        ...base,
        items: [
          {
            numeroLinea: 1,
            indicadorFacturacion: 'I1',
            nombreItem: 'Dmaia 360',
            descripcion: 'x'.repeat(1001),
            indicadorBienoServicio: 2,
            cantidad: 1,
            precioUnitarioItem: 1000,
          },
        ],
      })
      .expect(400)
  })

  it('la edición del borrador conserva la descripción', async () => {
    const creado = await request(app.getHttpServer())
      .post('/api/v1/comprobantes')
      .set(auth())
      .send({
        ...base,
        items: [
          { numeroLinea: 1, indicadorFacturacion: 'I1', nombreItem: 'Dmaia 360', indicadorBienoServicio: 2, cantidad: 1, precioUnitarioItem: 1000 },
        ],
      })
      .expect(201)

    await request(app.getHttpServer())
      .patch(`/api/v1/comprobantes/${creado.body.id}`)
      .set(auth())
      .send({
        items: [
          { numeroLinea: 1, indicadorFacturacion: 'I1', nombreItem: 'Dmaia 360', descripcion: DESC, indicadorBienoServicio: 2, cantidad: 1, precioUnitarioItem: 1000 },
        ],
      })
      .expect(200)

    const c = await prisma.comprobante.findUniqueOrThrow({ where: { id: creado.body.id } })
    expect((c.datos as any).items[0].descripcion).toBe(DESC)
  })
})
