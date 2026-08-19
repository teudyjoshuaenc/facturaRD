-- Borrador de catálogo (aditivo). Cero ALTER sobre columnas fiscales.
ALTER TABLE "productos" ADD COLUMN "borrador" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "productos_tenantId_borrador_idx" ON "productos"("tenantId", "borrador");
