-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "planActivo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "secuencias" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipoECF" "TipoECF" NOT NULL,
    "prefijo" TEXT NOT NULL,
    "ultimaSecuencia" INTEGER NOT NULL DEFAULT 0,
    "fechaVencimiento" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "secuencias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "secuencias_tenantId_activo_idx" ON "secuencias"("tenantId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "secuencias_tenantId_tipoECF_key" ON "secuencias"("tenantId", "tipoECF");

-- AddForeignKey
ALTER TABLE "secuencias" ADD CONSTRAINT "secuencias_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
