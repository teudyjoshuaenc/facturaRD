-- AlterEnum
ALTER TYPE "ComprobanteEstado" ADD VALUE 'INTERNO';

-- AlterTable
ALTER TABLE "comprobantes" ADD COLUMN     "esFiscal" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "folioInterno" TEXT,
ADD COLUMN     "eliminado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "documento_folios" (
    "tenantId" TEXT NOT NULL,
    "ultimoFolio" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documento_folios_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE UNIQUE INDEX "comprobantes_tenantId_folioInterno_key" ON "comprobantes"("tenantId", "folioInterno");

-- CreateIndex
CREATE INDEX "comprobantes_tenantId_esFiscal_idx" ON "comprobantes"("tenantId", "esFiscal");
