import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { prisma, Prisma, TipoECF } from '@facturard/database'
import type { Secuencia } from '@facturard/database'

// eNCF prefix mapping — tipoECF → 2-char code
const TIPO_PREFIJO: Record<TipoECF, string> = {
  E31: '31', E32: '32', E33: '33', E34: '34',
  E41: '41', E43: '43', E44: '44',
  E45: '45', E46: '46', E47: '47',
}

export function formatENCF(tipoECF: TipoECF, secuencia: number): string {
  return `E${TIPO_PREFIJO[tipoECF]}${String(secuencia).padStart(10, '0')}`
}

export interface InicializarSecuenciaDto {
  tipoECF: TipoECF
  ultimaSecuencia?: number
  fechaVencimiento?: Date
}

@Injectable()
export class SecuenciasService {
  // Devuelve el siguiente e-NCF y la fecha de vencimiento del rango (para que el
  // generador la coloque en <FechaVencimientoSecuencia>).
  async siguienteENCF(
    tenantId: string,
    tipoECF: TipoECF,
  ): Promise<{ eNCF: string; fechaVencimiento: Date | null }> {
    return prisma.$transaction(async (tx) => {
      const seq = await tx.secuencia.findUnique({
        where: { tenantId_tipoECF: { tenantId, tipoECF } },
      })

      if (!seq) {
        throw new NotFoundException(
          `No hay secuencia configurada para ${tipoECF}. Contacte al administrador.`,
        )
      }

      if (!seq.activo) {
        throw new BadRequestException(`La secuencia para ${tipoECF} está desactivada.`)
      }

      if (seq.fechaVencimiento && seq.fechaVencimiento < new Date()) {
        throw new HttpException(
          `La secuencia para ${tipoECF} venció el ${seq.fechaVencimiento.toISOString().slice(0, 10)}. Renueve su plan.`,
          HttpStatus.PAYMENT_REQUIRED,
        )
      }

      const updated = await tx.secuencia.update({
        where: { tenantId_tipoECF: { tenantId, tipoECF } },
        data: { ultimaSecuencia: { increment: 1 } },
      })

      return { eNCF: formatENCF(tipoECF, updated.ultimaSecuencia), fechaVencimiento: updated.fechaVencimiento }
    })
  }

  /** Fecha de vencimiento del rango para un tipo (sin consumir secuencia). */
  async getFechaVencimiento(tenantId: string, tipoECF: TipoECF): Promise<Date | null> {
    const seq = await prisma.secuencia.findUnique({ where: { tenantId_tipoECF: { tenantId, tipoECF } } })
    return seq?.fechaVencimiento ?? null
  }

  /**
   * Sincroniza las secuencias de un cliente que migra desde otro emisor, para
   * que FacturaRD continúe numerando desde last+1 y no reincida en la secuencia
   * (fix error DGII [1209] "secuencia ya utilizada").
   *
   * Guard: nunca se retrocede una secuencia (nuevo valor >= almacenado) → 409.
   * Atómico dentro de una $transaction (mismo patrón que siguienteENCF).
   */
  async sincronizar(
    tenantId: string,
    entries: { tipoECF: TipoECF; ultimaSecuencia: number; fechaVencimiento?: Date }[],
  ): Promise<Secuencia[]> {
    return prisma.$transaction(async (tx) => {
      const results: Secuencia[] = []
      for (const { tipoECF, ultimaSecuencia, fechaVencimiento } of entries) {
        const seq = await tx.secuencia.findUnique({
          where: { tenantId_tipoECF: { tenantId, tipoECF } },
        })

        if (seq && ultimaSecuencia < seq.ultimaSecuencia) {
          throw new ConflictException(
            `No se puede retroceder la secuencia ${tipoECF}: valor almacenado ${seq.ultimaSecuencia}, solicitado ${ultimaSecuencia}`,
          )
        }

        const upserted = await tx.secuencia.upsert({
          where: { tenantId_tipoECF: { tenantId, tipoECF } },
          create: {
            tenantId,
            tipoECF,
            prefijo: `E${TIPO_PREFIJO[tipoECF]}`,
            ultimaSecuencia,
            activo: true,
            ...(fechaVencimiento !== undefined && { fechaVencimiento }),
          },
          // La fecha solo se actualiza si viene; no se borra una existente.
          update: {
            ultimaSecuencia,
            ...(fechaVencimiento !== undefined && { fechaVencimiento }),
          },
        })
        results.push(upserted)
      }
      return results
    })
  }

  /**
   * Avanza el contador a `ultimaSecuencia` SÓLO si hoy está por debajo; nunca
   * retrocede. Un único UPDATE condicional → atómico frente a una emisión
   * concurrente (si ésta ya pasó el valor, no se toca). Devuelve el valor final.
   */
  async avanzarHasta(tenantId: string, tipoECF: TipoECF, ultimaSecuencia: number): Promise<number> {
    await prisma.secuencia.updateMany({
      where: { tenantId, tipoECF, ultimaSecuencia: { lt: ultimaSecuencia } },
      data: { ultimaSecuencia },
    })
    const seq = await prisma.secuencia.findUniqueOrThrow({
      where: { tenantId_tipoECF: { tenantId, tipoECF } },
    })
    return seq.ultimaSecuencia
  }

  async inicializarSecuencias(
    tenantId: string,
    tipos: InicializarSecuenciaDto[],
  ): Promise<Secuencia[]> {
    const results: Secuencia[] = []
    for (const { tipoECF, ultimaSecuencia = 0, fechaVencimiento } of tipos) {
      const seq = await prisma.secuencia.upsert({
        where: { tenantId_tipoECF: { tenantId, tipoECF } },
        create: {
          tenantId,
          tipoECF,
          prefijo: `E${TIPO_PREFIJO[tipoECF]}`,
          ultimaSecuencia,
          fechaVencimiento: fechaVencimiento ?? null,
          activo: true,
        },
        update: {
          ultimaSecuencia,
          fechaVencimiento: fechaVencimiento ?? null,
          activo: true,
        },
      })
      results.push(seq)
    }
    return results
  }

  async inicializarTodosLosTipos(tenantId: string): Promise<Secuencia[]> {
    const tipos = Object.keys(TIPO_PREFIJO) as TipoECF[]
    return this.inicializarSecuencias(
      tenantId,
      tipos.map((tipoECF) => ({ tipoECF, ultimaSecuencia: 0 })),
    )
  }

  /**
   * Inicializa todas las secuencias base dentro de una transacción existente
   * (para onboarding atómico). El tenant es nuevo → no hay conflictos.
   */
  async inicializarTodosLosTiposTx(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
    const tipos = Object.keys(TIPO_PREFIJO) as TipoECF[]
    await tx.secuencia.createMany({
      data: tipos.map((tipoECF) => ({
        tenantId,
        tipoECF,
        prefijo: `E${TIPO_PREFIJO[tipoECF]}`,
        ultimaSecuencia: 0,
        activo: true,
      })),
    })
  }

  async getSecuencias(tenantId: string): Promise<Secuencia[]> {
    return prisma.secuencia.findMany({
      where: { tenantId },
      orderBy: { tipoECF: 'asc' },
    })
  }

  async getSecuencia(tenantId: string, tipoECF: TipoECF): Promise<Secuencia> {
    const seq = await prisma.secuencia.findUnique({
      where: { tenantId_tipoECF: { tenantId, tipoECF } },
    })
    if (!seq) throw new NotFoundException(`Secuencia ${tipoECF} no encontrada para este tenant`)
    return seq
  }

  async getEstadisticas(tenantId: string): Promise<{
    totalTipos: number
    tiposActivos: number
    totalEmitidos: number
    proximosVencer: Secuencia[]
  }> {
    const secuencias = await prisma.secuencia.findMany({ where: { tenantId } })
    const hoy = new Date()
    const en30dias = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000)

    return {
      totalTipos: secuencias.length,
      tiposActivos: secuencias.filter((s) => s.activo).length,
      totalEmitidos: secuencias.reduce((sum, s) => sum + s.ultimaSecuencia, 0),
      proximosVencer: secuencias.filter(
        (s) => s.fechaVencimiento && s.fechaVencimiento <= en30dias,
      ),
    }
  }
}
