-- CreateEnum
CREATE TYPE "CajaEstado" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateTable
CREATE TABLE "caja_diaria" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" "CajaEstado" NOT NULL DEFAULT 'ABIERTA',
    "montoApertura" DECIMAL(18,2) NOT NULL,
    "notasApertura" TEXT,
    "abiertaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montoEsperado" DECIMAL(18,2),
    "montoContado" DECIMAL(18,2),
    "diferencia" DECIMAL(18,2),
    "notasCierre" TEXT,
    "cerradaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caja_diaria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "caja_diaria_tenantId_estado_idx" ON "caja_diaria"("tenantId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "caja_diaria_tenantId_fecha_key" ON "caja_diaria"("tenantId", "fecha");

-- AddForeignKey
ALTER TABLE "caja_diaria" ADD CONSTRAINT "caja_diaria_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
