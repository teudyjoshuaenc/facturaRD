-- AlterTable
ALTER TABLE "contactos" ADD COLUMN     "municipio" TEXT,
ADD COLUMN     "provincia" TEXT;

-- CreateIndex
CREATE INDEX "contactos_tenantId_provincia_idx" ON "contactos"("tenantId", "provincia");
