import { Injectable } from '@nestjs/common'
import { prisma } from '@facturard/database'
import type { PresupuestoConfig, Prisma } from '@facturard/database'
import { FinanzasService } from '../finanzas/finanzas.service'
import type { UpsertPresupuestoConfigDto } from './dto/upsert-presupuesto-config.dto'

interface IngresoLinea {
  nombre: string
  montoMensual: number
  crecimientoPct: number
}

interface CostoFijoLinea {
  nombre: string
  categoria?: string
  montoMensual: number
}

export interface PresupuestoConfigOut {
  sector: string | null
  moneda: string
  mesFiscalInicio: number
  colchonMeses: number
  metaMargenPct: number
  varPct: number
  cxcInicial: number
  cxpInicial: number
  ingresos: IngresoLinea[]
  costosFijos: CostoFijoLinea[]
  // false = el tenant nunca guardó nada — la UI dispara el wizard de onboarding.
  configurado: boolean
}

interface FilaProyeccion {
  indice: number
  mes: string
  entra: number
  fijo: number
  variable: number
  neto: number
  saldo: number
}

export interface ProyeccionResult {
  filas: FilaProyeccion[]
  resumen: {
    totalEntradas: number
    totalSalidas: number
    totalNeto: number
    margenPct: number
    puntoEquilibrio: number
    saldoFinal: number
    colchonMonto: number
  }
  alertas: {
    quiebre: { indice: number; mes: string; saldo: number } | null
    riesgoColchon: { indice: number; mes: string; saldo: number } | null
  }
}

export interface ComparacionResult {
  real: { ingresos: number; egresos: number }
  presupuestado: { ingresos: number; egresos: number }
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const r2 = (n: number): number => Math.round(n * 100) / 100

const DEFAULTS: Omit<PresupuestoConfigOut, 'configurado'> = {
  sector: null,
  moneda: 'DOP',
  mesFiscalInicio: 0,
  colchonMeses: 3,
  metaMargenPct: 20,
  varPct: 0,
  cxcInicial: 0,
  cxpInicial: 0,
  ingresos: [],
  costosFijos: [],
}

// Presupuesto/proyección de caja — NO fiscal, NO participa del ciclo DGII.
// Depende de FinanzasModule solo para leer totales reales en `comparacion()`
// (composición unidireccional: Presupuesto conoce a Finanzas, nunca al revés).
@Injectable()
export class PresupuestoService {
  constructor(private readonly finanzas: FinanzasService) {}

  async getConfig(tenantId: string): Promise<PresupuestoConfigOut> {
    const row = await prisma.presupuestoConfig.findUnique({ where: { tenantId } })
    if (!row) return { ...DEFAULTS, configurado: false }
    return this.toOut(row)
  }

  async upsertConfig(tenantId: string, dto: UpsertPresupuestoConfigDto): Promise<PresupuestoConfigOut> {
    const data = {
      sector: dto.sector ?? null,
      moneda: dto.moneda ?? DEFAULTS.moneda,
      mesFiscalInicio: dto.mesFiscalInicio ?? DEFAULTS.mesFiscalInicio,
      colchonMeses: dto.colchonMeses ?? DEFAULTS.colchonMeses,
      metaMargenPct: dto.metaMargenPct ?? DEFAULTS.metaMargenPct,
      varPct: dto.varPct ?? DEFAULTS.varPct,
      cxcInicial: dto.cxcInicial ?? DEFAULTS.cxcInicial,
      cxpInicial: dto.cxpInicial ?? DEFAULTS.cxpInicial,
      ingresos: dto.ingresos.map((x) => ({ nombre: x.nombre, montoMensual: x.montoMensual, crecimientoPct: x.crecimientoPct ?? 0 })) as unknown as Prisma.InputJsonValue,
      costosFijos: dto.costosFijos.map((x) => ({ nombre: x.nombre, categoria: x.categoria ?? null, montoMensual: x.montoMensual })) as unknown as Prisma.InputJsonValue,
    }
    const row = await prisma.presupuestoConfig.upsert({
      where: { tenantId },
      update: data,
      create: { tenantId, ...data },
    })
    return this.toOut(row)
  }

  /**
   * Motor de proyección — puro, se recalcula en cada request desde la config +
   * CapitalInicial.monto. No se persiste ninguna fila. Mismo algoritmo que
   * calc() del prototipo dmaia-finanzas-prototipo/index.html: crecimiento
   * compuesto mes a mes sobre cada fuente de ingreso, costo variable como %
   * fijo de lo que entra ese mes, saldo acumulado arrastrado.
   */
  async proyeccion(tenantId: string): Promise<ProyeccionResult> {
    const config = await this.getConfig(tenantId)
    const capitalRow = await prisma.capitalInicial.findUnique({ where: { tenantId } })
    const saldoInicial = capitalRow ? Number(capitalRow.monto) : 0

    const fijoMensual = r2(config.costosFijos.reduce((a, x) => a + x.montoMensual, 0))

    let saldo = saldoInicial
    const filas: FilaProyeccion[] = []
    for (let i = 0; i < 12; i++) {
      const entra = r2(config.ingresos.reduce((a, x) => a + x.montoMensual * Math.pow(1 + x.crecimientoPct / 100, i), 0))
      const variable = r2((entra * config.varPct) / 100)
      const neto = r2(entra - fijoMensual - variable)
      saldo = r2(saldo + neto)
      filas.push({ indice: i, mes: MESES[(config.mesFiscalInicio + i) % 12]!, entra, fijo: fijoMensual, variable, neto, saldo })
    }

    const totalEntradas = r2(filas.reduce((a, f) => a + f.entra, 0))
    const totalSalidas = r2(filas.reduce((a, f) => a + f.fijo + f.variable, 0))
    const totalNeto = r2(totalEntradas - totalSalidas)
    const gastoPromedio = totalSalidas / 12
    const colchonMonto = r2(gastoPromedio * config.colchonMeses)
    const margenPct = totalEntradas > 0 ? r2(((totalEntradas - totalSalidas) / totalEntradas) * 100) : 0
    const denom = 1 - config.varPct / 100
    const puntoEquilibrio = denom > 0 ? r2(fijoMensual / denom) : 0

    const quiebreFila = filas.find((f) => f.saldo < 0)
    const riesgoFila = filas.find((f) => f.saldo < colchonMonto)

    return {
      filas,
      resumen: {
        totalEntradas,
        totalSalidas,
        totalNeto,
        margenPct,
        puntoEquilibrio,
        saldoFinal: filas[11]!.saldo,
        colchonMonto,
      },
      alertas: {
        quiebre: quiebreFila ? { indice: quiebreFila.indice, mes: quiebreFila.mes, saldo: quiebreFila.saldo } : null,
        riesgoColchon: riesgoFila ? { indice: riesgoFila.indice, mes: riesgoFila.mes, saldo: riesgoFila.saldo } : null,
      },
    }
  }

  /**
   * Real (leído de FinanzasService, vista devengado) vs. presupuestado del
   * mes pedido. La fila 0 de la proyección se trata como "el mes actual" —
   * misma asunción implícita que ya hacía el prototipo (la proyección no lee
   * el calendario real, arranca desde "ahora" en el índice 0).
   */
  async comparacion(tenantId: string, mes: string): Promise<ComparacionResult> {
    const [yStr, mStr] = mes.split('-')
    const y = Number(yStr)
    const m = Number(mStr) // 1-12
    const desde = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10)
    const hasta = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)

    const resumenReal = (await this.finanzas.resumen(tenantId, { desde, hasta })) as {
      devengado: { ingresos: number; egresos: number }
    }
    const proy = await this.proyeccion(tenantId)
    const filaActual = proy.filas[0]!

    return {
      real: { ingresos: resumenReal.devengado.ingresos, egresos: resumenReal.devengado.egresos },
      presupuestado: { ingresos: filaActual.entra, egresos: r2(filaActual.fijo + filaActual.variable) },
    }
  }

  private toOut(row: PresupuestoConfig): PresupuestoConfigOut {
    return {
      sector: row.sector,
      moneda: row.moneda,
      mesFiscalInicio: row.mesFiscalInicio,
      colchonMeses: row.colchonMeses,
      metaMargenPct: Number(row.metaMargenPct),
      varPct: Number(row.varPct),
      cxcInicial: Number(row.cxcInicial),
      cxpInicial: Number(row.cxpInicial),
      ingresos: (row.ingresos as unknown as IngresoLinea[]) ?? [],
      costosFijos: (row.costosFijos as unknown as CostoFijoLinea[]) ?? [],
      configurado: true,
    }
  }
}
