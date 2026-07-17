import { Injectable } from '@nestjs/common'
import { Prisma, prisma } from '@facturard/database'

@Injectable()
export class DocumentoFolioService {
  /**
   * Devuelve el siguiente folio interno de Nota de venta por tenant
   * (NV-000001...), de forma atómica. Mismo patrón que CotizacionFolioService:
   *   1. INSERT ... ON CONFLICT DO NOTHING crea la fila del contador sin carrera.
   *   2. UPDATE ... "ultimoFolio" += 1 RETURNING serializa por el lock de fila.
   * Es un número INTERNO: NO es un e-NCF y NUNCA se envía a la DGII ni consume
   * secuencia fiscal.
   */
  async siguienteFolio(tenantId: string): Promise<string> {
    await prisma.$executeRaw`
      INSERT INTO "documento_folios" ("tenantId", "ultimoFolio", "updatedAt")
      VALUES (${tenantId}, 0, NOW())
      ON CONFLICT ("tenantId") DO NOTHING`

    const rows = await prisma.$queryRaw<Array<{ ultimoFolio: number }>>(Prisma.sql`
      UPDATE "documento_folios"
      SET "ultimoFolio" = "ultimoFolio" + 1, "updatedAt" = NOW()
      WHERE "tenantId" = ${tenantId}
      RETURNING "ultimoFolio"`)

    const n = rows[0]?.ultimoFolio ?? 0
    return `NV-${String(n).padStart(6, '0')}`
  }
}
