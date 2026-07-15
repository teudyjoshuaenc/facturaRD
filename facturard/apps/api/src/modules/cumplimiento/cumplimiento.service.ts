import { Injectable } from '@nestjs/common'
import { prisma } from '@facturard/database'
import { computeEmisionStatus, type MotivoNoEmite } from '../../common/emision-status'

const DIA_MS = 24 * 60 * 60 * 1000
const RECHAZADOS_DIAS = 30

export interface Cumplimiento {
  certificado: { existe: boolean; vigente: boolean; vencido: boolean; diasRestantes: number | null }
  bloqueaEmision: boolean
  puedeEmitir: boolean
  motivoNoEmite: MotivoNoEmite
  secuencias: Array<{ tipoECF: string; ultimaSecuencia: number; disponibles: number | null; porAgotarse: boolean; venceEn: Date | null }>
  comprobantesConProblema: { count: number; ids: string[] }
  reportesPendientes: { periodo: string; pendientes: string[] }
  indicadorGeneral: 'OK' | 'WARN' | 'CRITICAL'
}

@Injectable()
export class CumplimientoService {
  async obtener(tenantId: string): Promise<Cumplimiento> {
    const desde = new Date(Date.now() - RECHAZADOS_DIAS * DIA_MS)
    const [cert, secuencias, rechazados] = await Promise.all([
      prisma.certificado.findFirst({ where: { tenantId, activo: true } }),
      prisma.secuencia.findMany({ where: { tenantId }, orderBy: { tipoECF: 'asc' } }),
      prisma.comprobante.findMany({
        where: { tenantId, estado: 'RECHAZADO', createdAt: { gte: desde } },
        select: { id: true },
        take: 100,
      }),
    ])

    const now = Date.now()

    // ── Certificado ──────────────────────────────────────────────────────────
    let certificado: Cumplimiento['certificado']
    if (cert) {
      const vencido = cert.validoHasta.getTime() < now
      certificado = {
        existe: true,
        vigente: !vencido,
        vencido,
        diasRestantes: Math.ceil((cert.validoHasta.getTime() - now) / DIA_MS),
      }
    } else {
      certificado = { existe: false, vigente: false, vencido: false, diasRestantes: null }
    }
    // Sin certificado activo o vencido → no se puede emitir.
    const bloqueaEmision = !cert || certificado.vencido
    // Estado explícito "listo para emitir" (certificado vigente + secuencias).
    const { puedeEmitir, motivoNoEmite } = computeEmisionStatus(
      cert?.validoHasta ?? null,
      secuencias.length > 0,
    )

    // ── Secuencias ───────────────────────────────────────────────────────────
    // No hay tope de rango almacenado, así que `disponibles` es null; `porAgotarse`
    // se basa en la proximidad de fechaVencimiento (30 días).
    const secs = secuencias.map((s) => {
      const venceEn = s.fechaVencimiento
      const porAgotarse = venceEn !== null && venceEn.getTime() < now + 30 * DIA_MS
      return {
        tipoECF: s.tipoECF,
        ultimaSecuencia: s.ultimaSecuencia,
        disponibles: null,
        porAgotarse,
        venceEn: venceEn ?? null,
      }
    })

    // ── Comprobantes con problema ──────────────────────────────────────────────
    const comprobantesConProblema = { count: rechazados.length, ids: rechazados.map((r) => r.id) }

    // ── Reportes pendientes (heurística por período, sin tracking) ─────────────
    const d = new Date()
    const periodo = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
    const reportesPendientes = { periodo, pendientes: ['606', '607'] }

    // ── Indicador general ──────────────────────────────────────────────────────
    let indicadorGeneral: Cumplimiento['indicadorGeneral'] = 'OK'
    if (bloqueaEmision) {
      indicadorGeneral = 'CRITICAL'
    } else if (
      comprobantesConProblema.count > 0 ||
      secs.some((s) => s.porAgotarse) ||
      (certificado.diasRestantes !== null && certificado.diasRestantes <= 30)
    ) {
      indicadorGeneral = 'WARN'
    }

    return { certificado, bloqueaEmision, puedeEmitir, motivoNoEmite, secuencias: secs, comprobantesConProblema, reportesPendientes, indicadorGeneral }
  }
}
