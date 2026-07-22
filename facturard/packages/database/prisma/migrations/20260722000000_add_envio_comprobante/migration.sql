-- Envío de comprobantes al cliente vía GoHighLevel (post-emisión, NO fiscal).
-- Migración ADITIVA PURA: sólo crea enums y una tabla nueva. Cero ALTER sobre
-- columnas fiscales; `comprobantes` no se toca.

-- CreateEnum
CREATE TYPE "CanalEnvio" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "EstadoEnvio" AS ENUM ('ENVIADO', 'FALLIDO');

-- CreateTable
CREATE TABLE "envios_comprobante" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "comprobanteId" TEXT NOT NULL,
    "canal" "CanalEnvio" NOT NULL,
    "estado" "EstadoEnvio" NOT NULL,
    "destino" TEXT,
    "ghlMessageId" TEXT,
    "ghlConversationId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "envios_comprobante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "envios_comprobante_tenantId_comprobanteId_idx" ON "envios_comprobante"("tenantId", "comprobanteId");

-- CreateIndex
CREATE INDEX "envios_comprobante_comprobanteId_createdAt_idx" ON "envios_comprobante"("comprobanteId", "createdAt");

-- AddForeignKey
ALTER TABLE "envios_comprobante" ADD CONSTRAINT "envios_comprobante_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios_comprobante" ADD CONSTRAINT "envios_comprobante_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "comprobantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
