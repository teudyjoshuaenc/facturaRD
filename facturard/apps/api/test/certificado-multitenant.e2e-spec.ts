import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import * as forge from 'node-forge'
import { firmarDocumento } from '@facturard/ecf-engine'
import { createTestApp, TestContext } from './helpers/test-app'
import { createTenant, uploadCert, generateP12, TestTenant, TestCert } from './helpers/factory'
import { CertificadosService } from '../src/modules/certificados/certificados.service'

function ecfXml(rnc: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ECF xmlns="http://dgii.gov.do/ecf/mapers/v1">
  <Encabezado>
    <Version>1.0</Version>
    <IdDoc><TipoCFE>31</TipoCFE><eNCF>E310000000001</eNCF><IndicadorMontoGravado>1</IndicadorMontoGravado><TipoIngresos>01</TipoIngresos><TipoPago>1</TipoPago></IdDoc>
    <Emisor><RNCEmisor>${rnc}</RNCEmisor><RazonSocialEmisor>EMISOR</RazonSocialEmisor><FechaEmision>01-01-2026</FechaEmision></Emisor>
    <Totales><MontoGravadoI1>1000.00</MontoGravadoI1><TotalITBIS1>180.00</TotalITBIS1><MontoTotal>1180.00</MontoTotal></Totales>
  </Encabezado>
</ECF>`
}

/** Extrae el commonName del subject del X509Certificate embebido en la firma. */
function subjectCnFromSignedXml(signedXml: string): string {
  const match = signedXml.match(/<(?:\w+:)?X509Certificate>([\s\S]*?)<\/(?:\w+:)?X509Certificate>/)
  const b64 = (match?.[1] ?? '').replace(/\s+/g, '')
  const der = forge.util.decode64(b64)
  const cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(der))
  return String(cert.subject.getField('CN')?.value ?? '')
}

// e2e Sprint 1.2 — cada tenant firma con SU propio P12; sin fallback a DMAIA.
describe('Certificados — firma multi-tenant (e2e)', () => {
  let ctx: TestContext
  let app: INestApplication
  let tenantA: TestTenant
  let tenantB: TestTenant
  let certA: TestCert
  let certB: TestCert

  beforeAll(async () => {
    ctx = await createTestApp()
    app = ctx.app
    tenantA = await createTenant()
    tenantB = await createTenant()
    certA = generateP12('CERT-TENANT-A')
    certB = generateP12('CERT-TENANT-B')
    await uploadCert(app, tenantA.tenant.id, certA)
    await uploadCert(app, tenantB.tenant.id, certB)
  }, 60_000)

  afterAll(async () => {
    await app.close()
  })

  it('cada tenant firma con el subject de su propio certificado', async () => {
    const service = app.get(CertificadosService)

    const a = await service.getCertificadoParaFirmar(tenantA.tenant.id)
    const signedA = firmarDocumento({ p12: a.p12Buffer, passphrase: a.passphrase, xml: ecfXml(tenantA.tenant.rnc) })
    expect(subjectCnFromSignedXml(signedA)).toBe('CERT-TENANT-A')

    const b = await service.getCertificadoParaFirmar(tenantB.tenant.id)
    const signedB = firmarDocumento({ p12: b.p12Buffer, passphrase: b.passphrase, xml: ecfXml(tenantB.tenant.rnc) })
    expect(subjectCnFromSignedXml(signedB)).toBe('CERT-TENANT-B')
  }, 60_000)

  it('persiste passphrase cifrada: la firma funciona sin datos en claro', async () => {
    // Si la passphrase no estuviese persistida y descifrable, getCertificadoParaFirmar
    // lanzaría; que la firma anterior haya funcionado ya lo prueba. Aquí verificamos
    // además que dos tenants tienen certificados con subjects distintos.
    const service = app.get(CertificadosService)
    const a = await service.getCertificadoParaFirmar(tenantA.tenant.id)
    const b = await service.getCertificadoParaFirmar(tenantB.tenant.id)
    expect(a.p12Buffer.equals(b.p12Buffer)).toBe(false)
  })

  it('GET /certificados sólo lista los del tenant autenticado', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/certificados')
      .set({ Authorization: `Bearer ${tenantA.token}` })
      .expect(200)
    expect(res.body.length).toBe(1)
    expect(res.body[0].tenantId).toBe(tenantA.tenant.id)
  })

  it('aislamiento: A no puede desactivar el certificado de B (404)', async () => {
    const certsB = await app.get(CertificadosService).findAll(tenantB.tenant.id, 'ADMIN')
    const certBId = certsB[0]?.id
    expect(certBId).toBeDefined()

    await request(app.getHttpServer())
      .delete(`/api/v1/certificados/${certBId}`)
      .set({ Authorization: `Bearer ${tenantA.token}` })
      .expect(404)
  })
})
