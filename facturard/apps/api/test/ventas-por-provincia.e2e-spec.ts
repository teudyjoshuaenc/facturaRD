import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma, TipoECF } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, TestTenant } from './helpers/factory'

// Mapa de ventas por provincia (dashboard): provincia/municipio en Contacto
// (antes se descartaban en el frontend, ver EditarClienteModal/useContactos)
// + agregación en comprobantes.service.ts por RNC.
describe('Ventas por provincia (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenant: TestTenant

  const auth = (t: TestTenant) => ({ Authorization: `Bearer ${t.token}` })
  const srv = () => app.getHttpServer()

  let encfSeq = 0
  let folioSeq = 0
  async function mkComprobante(t: TestTenant, rnc: string, montoTotal: number) {
    return prisma.comprobante.create({
      data: {
        tenantId: t.tenant.id,
        eNCF: `E31${String(++encfSeq).padStart(10, '0')}`,
        tipoECF: TipoECF.E31,
        estado: 'ACEPTADO',
        esFiscal: true,
        montoTotal,
        rnc,
        razonSocial: 'CLIENTE SRL',
      },
    })
  }

  async function mkNotaVenta(t: TestTenant, rnc: string, montoTotal: number) {
    return prisma.comprobante.create({
      data: {
        tenantId: t.tenant.id,
        folioInterno: `NV-${String(++folioSeq).padStart(6, '0')}`,
        tipoECF: TipoECF.E32,
        estado: 'INTERNO',
        esFiscal: false,
        montoTotal,
        rnc,
        razonSocial: 'CLIENTE SRL',
      },
    })
  }

  // Nota de venta que quedó en Borrador por el bug conocido del form (manda
  // emitir:false junto con esFiscal:false) — sin folioInterno, estado DRAFT.
  async function mkNotaVentaBorrador(t: TestTenant, rnc: string, montoTotal: number) {
    return prisma.comprobante.create({
      data: {
        tenantId: t.tenant.id,
        tipoECF: TipoECF.E32,
        estado: 'DRAFT',
        esFiscal: false,
        montoTotal,
        rnc,
        razonSocial: 'CLIENTE SRL',
      },
    })
  }

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
    tenant = await createTenant()
  })

  afterAll(async () => { await app.close() })

  it('POST/PATCH /contactos persiste provincia y municipio', async () => {
    const created = await request(srv())
      .post('/api/v1/contactos')
      .set(auth(tenant))
      .send({ tipo: 'CLIENTE', razonSocial: 'Cliente Santiago', rnc: '101000001', provincia: 'Santiago', municipio: 'Tamboril' })
      .expect(201)
    expect(created.body.provincia).toBe('Santiago')
    expect(created.body.municipio).toBe('Tamboril')

    const updated = await request(srv())
      .patch(`/api/v1/contactos/${created.body.id}`)
      .set(auth(tenant))
      .send({ provincia: 'Puerto Plata', municipio: 'Puerto Plata' })
      .expect(200)
    expect(updated.body.provincia).toBe('Puerto Plata')
  })

  it('GET /comprobantes/ventas-por-provincia agrega por provincia del comprador vía RNC', async () => {
    await request(srv()).post('/api/v1/contactos').set(auth(tenant))
      .send({ tipo: 'CLIENTE', razonSocial: 'Cliente DN', rnc: '101000002', provincia: 'Distrito Nacional' }).expect(201)
    await request(srv()).post('/api/v1/contactos').set(auth(tenant))
      .send({ tipo: 'CLIENTE', razonSocial: 'Cliente Verde', rnc: '101000003', provincia: 'La Vega' }).expect(201)
    // Sin contacto (RNC no registrado) → cae en sinAsignar
    await mkComprobante(tenant, '999000009', 500)

    await mkComprobante(tenant, '101000002', 1000)
    await mkComprobante(tenant, '101000002', 500)
    await mkComprobante(tenant, '101000003', 300)

    const res = await request(srv()).get('/api/v1/comprobantes/ventas-por-provincia').set(auth(tenant)).expect(200)

    const dn = res.body.provincias.find((p: { provincia: string }) => p.provincia === 'Distrito Nacional')
    const vega = res.body.provincias.find((p: { provincia: string }) => p.provincia === 'La Vega')
    expect(dn).toEqual({ provincia: 'Distrito Nacional', facturas: 2, monto: 1500 })
    expect(vega).toEqual({ provincia: 'La Vega', facturas: 1, monto: 300 })
    expect(res.body.sinAsignar.facturas).toBeGreaterThanOrEqual(1)
    expect(res.body.sinAsignar.monto).toBeGreaterThanOrEqual(500)
  })

  it('clase=nota cuenta solo notas de venta; clase=todas suma ambas; default sigue siendo solo fiscal', async () => {
    await request(srv()).post('/api/v1/contactos').set(auth(tenant))
      .send({ tipo: 'CLIENTE', razonSocial: 'Cliente Azua', rnc: '101000004', provincia: 'Azua' }).expect(201)

    await mkComprobante(tenant, '101000004', 2000) // fiscal
    await mkNotaVenta(tenant, '101000004', 700) // nota de venta

    const soloFiscal = await request(srv()).get('/api/v1/comprobantes/ventas-por-provincia').set(auth(tenant)).expect(200)
    const azuaFiscal = soloFiscal.body.provincias.find((p: { provincia: string }) => p.provincia === 'Azua')
    expect(azuaFiscal).toEqual({ provincia: 'Azua', facturas: 1, monto: 2000 })

    const soloNota = await request(srv())
      .get('/api/v1/comprobantes/ventas-por-provincia').query({ clase: 'nota' }).set(auth(tenant)).expect(200)
    const azuaNota = soloNota.body.provincias.find((p: { provincia: string }) => p.provincia === 'Azua')
    expect(azuaNota).toEqual({ provincia: 'Azua', facturas: 1, monto: 700 })

    const todas = await request(srv())
      .get('/api/v1/comprobantes/ventas-por-provincia').query({ clase: 'todas' }).set(auth(tenant)).expect(200)
    const azuaTodas = todas.body.provincias.find((p: { provincia: string }) => p.provincia === 'Azua')
    expect(azuaTodas).toEqual({ provincia: 'Azua', facturas: 2, monto: 2700 })
  })

  it('clase=todas cuenta notas de venta en Borrador (bug conocido); clase=nota las sigue excluyendo', async () => {
    await request(srv()).post('/api/v1/contactos').set(auth(tenant))
      .send({ tipo: 'CLIENTE', razonSocial: 'Cliente Duarte', rnc: '101000005', provincia: 'Duarte' }).expect(201)

    await mkNotaVentaBorrador(tenant, '101000005', 400)

    const soloNota = await request(srv())
      .get('/api/v1/comprobantes/ventas-por-provincia').query({ clase: 'nota' }).set(auth(tenant)).expect(200)
    expect(soloNota.body.provincias.find((p: { provincia: string }) => p.provincia === 'Duarte')).toBeUndefined()

    const todas = await request(srv())
      .get('/api/v1/comprobantes/ventas-por-provincia').query({ clase: 'todas' }).set(auth(tenant)).expect(200)
    const duarte = todas.body.provincias.find((p: { provincia: string }) => p.provincia === 'Duarte')
    expect(duarte).toEqual({ provincia: 'Duarte', facturas: 1, monto: 400 })
  })

  it('otro tenant no ve las facturas/contactos de este (aislamiento)', async () => {
    const otro = await createTenant()
    const res = await request(srv()).get('/api/v1/comprobantes/ventas-por-provincia').set(auth(otro)).expect(200)
    expect(res.body.provincias).toEqual([])
    expect(res.body.sinAsignar).toEqual({ facturas: 0, monto: 0 })
  })
})
