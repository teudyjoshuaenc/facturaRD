import type { Tenant } from '@facturard/database'
import type { EcfPdfInput, DgiiAmbiente } from '@facturard/ecf-engine'
import type { CreateComprobanteDto, CreateItemDto } from './dto/create-comprobante.dto'

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

function calcularMontoItem(item: CreateItemDto): number {
  const bruto = r2(item.cantidad * (item.precioUnitarioItem ?? 0))
  return r2(bruto - r2(bruto * ((item.descuentoPorcentaje ?? 0) / 100)))
}

/**
 * CodigoSeguridad DGII = primeros 6 caracteres del SignatureValue del XML firmado
 * (sin whitespace; la firma RSA base64 no lo tiene). Es OBLIGATORIO en la URL del
 * consultatimbre: sin él, la DGII responde "No fue encontrada la factura".
 */
export function extraerCodigoSeguridad(xmlFirmado: string): string | undefined {
  return xmlFirmado.match(/<SignatureValue[^>]*>([A-Za-z0-9+/=]+)/)?.[1]?.slice(0, 6)
}

/**
 * Fecha/hora de firma tal cual del XML (<FechaHoraFirma>, formato DD-MM-YYYY HH:MM:SS).
 * También OBLIGATORIA en la URL del consultatimbre.
 */
export function extraerFechaHoraFirma(xmlFirmado: string): string | undefined {
  return xmlFirmado.match(/<FechaHoraFirma>([^<]+)<\/FechaHoraFirma>/)?.[1]
}

/**
 * Construye el input del PDF (incl. datos del QR/consultatimbre) desde el DTO
 * persistido, el tenant y el XML firmado. Fuente única usada tanto por el worker
 * de emisión como por la regeneración al vuelo en la descarga, para que el QR
 * lleve SIEMPRE el set completo que exige la DGII: rncemisor, rnccomprador,
 * encf (MAYÚS), fechaemision, montototal, fechafirma y codigoseguridad.
 */
export function buildEcfPdfInput(
  datos: CreateComprobanteDto,
  tenant: Tenant,
  eNCF: string,
  ambiente: DgiiAmbiente,
  xmlFirmado?: string,
): EcfPdfInput {
  const items = datos.items.map((item) => ({
    descripcion: item.nombreItem ?? '',
    cantidad: item.cantidad,
    precioUnitario: item.precioUnitarioItem ?? 0,
    valor: calcularMontoItem(item),
  }))

  const montoTotal = items.reduce((s, i) => s + i.valor, 0)
  const itbisTotal = datos.items.reduce((s, item) => {
    const monto = calcularMontoItem(item)
    if (item.indicadorFacturacion === 'I1') return s + r2(monto * 0.18)
    if (item.indicadorFacturacion === 'I2') return s + r2(monto * 0.16)
    return s
  }, 0)

  const codigoSeguridad = xmlFirmado ? extraerCodigoSeguridad(xmlFirmado) : undefined
  const fechaHoraFirma = xmlFirmado ? extraerFechaHoraFirma(xmlFirmado) : undefined

  return {
    rncEmisor: tenant.rnc,
    nombreEmisor: tenant.razonSocial,
    eNCF,
    ambiente,
    tipoECF: datos.tipoECF,
    fechaEmision: datos.fechaEmision,
    nombreComprador: datos.razonSocialComprador ?? '',
    items,
    montoTotal: r2(montoTotal + itbisTotal),
    itbisTotal,
    montoGravadoTotal: montoTotal,
    ...(codigoSeguridad !== undefined ? { codigoSeguridad } : {}),
    ...(fechaHoraFirma !== undefined ? { fechaHoraFirma } : {}),
    ...(tenant.nombreComercial !== null ? { nombreComercial: tenant.nombreComercial } : {}),
    ...(datos.fechaVencimiento !== undefined ? { fechaVencimiento: datos.fechaVencimiento } : {}),
    ...(datos.rncComprador !== undefined ? { rncComprador: datos.rncComprador } : {}),
    ...(datos.ncfModificado !== undefined ? { eNCFReferencia: datos.ncfModificado } : {}),
    // Branding del tenant (Sprint 6). Si son null, el PDF usa los defaults.
    ...(tenant.logoUrl !== null ? { logoUrl: tenant.logoUrl } : {}),
    ...(tenant.colorPrimario !== null ? { colorPrimario: tenant.colorPrimario } : {}),
    ...(tenant.colorSecundario !== null ? { colorSecundario: tenant.colorSecundario } : {}),
  }
}
