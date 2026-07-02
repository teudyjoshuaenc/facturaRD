import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { prisma } from '@facturard/database'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, initSequences, uploadCert, generateP12, TestTenant } from './helpers/factory'
import { DgiiContribuyentesService } from '../src/modules/tenants/dgii-contribuyentes.service'

// Escenario extremo-a-extremo del roadmap: producto → contacto → cotización →
// draft → emitir → nota → reporte 607. Prueba que los módulos se engranan.
describe('Flujo completo (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let t: TestTenant
  const buscarPorRNC = jest.fn()

  const auth = () => ({ Authorization: `Bearer ${t.token}` })
  const ymd = (d: Date) => d.toISOString().slice(0, 10)
  const DESDE = ymd(new Date(Date.now() - 24 * 3600 * 1000))
  const HASTA = ymd(new Date(Date.now() + 24 * 3600 * 1000))

  beforeAll(async () => {
    ctx = await createTestApp([{ provide: DgiiContribuyentesService, useValue: { buscarPorRNC } }])
    app = ctx.app
    t = await createTenant()
    await initSequences(t.tenant.id)
    await uploadCert(app, t.tenant.id, generateP12('FLUJO-TENANT'))
    buscarPorRNC.mockResolvedValue({ rnc: '131880681', razonSocial: 'CLIENTE FLUJO SRL', nombreComercial: undefined, estado: 'ACTIVO', categoria: undefined })
  })

  afterAll(async () => { await app.close() })

  it('producto → contacto → cotización → draft → emitir → nota → 607', async () => {
    const http = app.getHttpServer()

    // 1. Producto (servicio, I1) + Contacto (CLIENTE con RNC validado)
    const producto = await request(http).post('/api/v1/productos').set(auth())
      .send({ tipo: 'SERVICIO', nombre: 'Consultoría', precioUnitario: 1000, tratamientoITBIS: 'I1' }).expect(201)
    const contacto = await request(http).post('/api/v1/contactos').set(auth())
      .send({ tipo: 'CLIENTE', rnc: '131880681' }).expect(201)
    expect(contacto.body.rncValidado).toBe(true)

    // 2. Cotización usando ese producto + contacto
    const cot = await request(http).post('/api/v1/cotizaciones').set(auth())
      .send({ contactoId: contacto.body.id, items: [{ productoId: producto.body.id, cantidad: 1 }] }).expect(201)
    expect(Number(cot.body.total)).toBe(1180)
    await request(http).patch(`/api/v1/cotizaciones/${cot.body.id}/estado`).set(auth()).send({ estado: 'ENVIADA' }).expect(200)
    await request(http).patch(`/api/v1/cotizaciones/${cot.body.id}/estado`).set(auth()).send({ estado: 'APROBADA' }).expect(200)

    // 3. Convertir con emitir=false → comprobante DRAFT, cotización CONVERTIDA, DGII no llamada
    ctx.queueAdd.mockClear()
    const conv = await request(http).post(`/api/v1/cotizaciones/${cot.body.id}/convertir`).set(auth()).send({ emitir: false }).expect(201)
    const compId = conv.body.comprobante.id
    expect(conv.body.comprobante.estado).toBe('DRAFT')
    expect(conv.body.comprobante.tipoECF).toBe('E31') // contacto con RNC validado
    expect(conv.body.cotizacion.estado).toBe('CONVERTIDA')
    expect(conv.body.cotizacion.comprobanteId).toBe(compId)
    expect(conv.body.comprobante.cotizacionId).toBe(cot.body.id)
    expect(ctx.queueAdd).not.toHaveBeenCalled()

    // 4. Emitir el draft → e-NCF asignado, pipeline invocado, estado supera DRAFT
    ctx.queueAdd.mockClear()
    const emit = await request(http).post(`/api/v1/comprobantes/${compId}/emitir`).set(auth()).expect(201)
    expect(emit.body.eNCF).toMatch(/^E31\d{10}$/)
    expect(emit.body.estado).toBe('PENDIENTE')
    expect(ctx.queueAdd).toHaveBeenCalledTimes(1)
    const facturaEncf = emit.body.eNCF

    // (simula aceptación DGII: el worker está mockeado)
    await prisma.comprobante.update({ where: { id: compId }, data: { estado: 'ACEPTADO' } })

    // 5. Nota de crédito E34 sobre la factura emitida
    const nota = await request(http).post(`/api/v1/comprobantes/${compId}/nota`).set(auth())
      .send({ tipo: 'E34', codigoModificacion: 2, razonModificacion: 'Corrección' }).expect(201)
    expect(nota.body.comprobanteReferenciaId).toBe(compId)
    const notaEncf = nota.body.eNCF
    await prisma.comprobante.update({ where: { id: nota.body.id }, data: { estado: 'ACEPTADO' } })

    // 6. 607 incluye factura y nota; 608 vacío; los montos reconcilian
    const r607 = await request(http).get(`/api/v1/reportes/607?desde=${DESDE}&hasta=${HASTA}`).set(auth()).expect(200)
    const encfs = r607.body.rows.map((r: { ncf: string }) => r.ncf)
    expect(encfs).toContain(facturaEncf)
    expect(encfs).toContain(notaEncf)

    const factRow = r607.body.rows.find((r: { ncf: string }) => r.ncf === facturaEncf)
    const notaRow = r607.body.rows.find((r: { ncf: string }) => r.ncf === notaEncf)
    // La nota de crédito acredita el mismo monto que la factura → reconcilian a 0.
    expect(factRow.montoFacturado - notaRow.montoFacturado).toBe(0)

    const r608 = await request(http).get(`/api/v1/reportes/608?desde=${DESDE}&hasta=${HASTA}`).set(auth()).expect(200)
    expect(r608.body.totales.registros).toBe(0) // codigoModificacion=2 no es anulación total

    // Enlaces cross-entity finales
    const cotDb = await prisma.cotizacion.findUniqueOrThrow({ where: { id: cot.body.id } })
    const compDb = await prisma.comprobante.findUniqueOrThrow({ where: { id: compId } })
    expect(cotDb.comprobanteId).toBe(compId)
    expect(compDb.cotizacionId).toBe(cot.body.id)
    expect(cotDb.tenantId).toBe(t.tenant.id)
  })
})
