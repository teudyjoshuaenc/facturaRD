import { Injectable } from '@nestjs/common'
import { Prisma, prisma } from '@facturard/database'

@Injectable()
export class CotizacionFolioService {
  /**
   * Devuelve el siguiente folio interno por tenant (COT-000001...), de forma
   * atómica. Mismo patrón de incremento que las secuencias e-NCF:
   *   1. INSERT ... ON CONFLICT DO NOTHING crea la fila del contador sin
   *      condición de carrera (varios creates en paralelo no colisionan).
   *   2. UPDATE ... "ultimoFolio" = "ultimoFolio" + 1 RETURNING serializa por el
   *      lock de fila de Postgres, así cada llamada concurrente obtiene un valor
   *      distinto y monótono.
   * Los folios son internos: NO son e-NCF y nunca se envían a la DGII.
   */
  async siguienteFolio(tenantId: string): Promise<string> {
    await prisma.$executeRaw`
      INSERT INTO "cotizacion_folios" ("tenantId", "ultimoFolio", "updatedAt")
      VALUES (${tenantId}, 0, NOW())
      ON CONFLICT ("tenantId") DO NOTHING`

    const rows = await prisma.$queryRaw<Array<{ ultimoFolio: number }>>(Prisma.sql`
      UPDATE "cotizacion_folios"
      SET "ultimoFolio" = "ultimoFolio" + 1, "updatedAt" = NOW()
      WHERE "tenantId" = ${tenantId}
      RETURNING "ultimoFolio"`)

    const n = rows[0]?.ultimoFolio ?? 0
    return `COT-${String(n).padStart(6, '0')}`
  }
}
