-- Envío EN LOTE: un solo correo con los PDFs de varios comprobantes adjuntos.
-- Migración ADITIVA PURA: una columna nullable + su índice sobre una tabla que
-- ya es post-emisión y NO fiscal. Cero ALTER sobre `comprobantes`.
--
-- `loteId` agrupa las N filas que nacieron del MISMO correo. No se usa
-- `ghlMessageId` para agrupar porque es nullable (GHL puede no devolverlo) y
-- porque no existe en las filas FALLIDO, que son justo las que hay que poder
-- leer juntas.

-- AlterTable
ALTER TABLE "envios_comprobante" ADD COLUMN "loteId" TEXT;

-- CreateIndex
CREATE INDEX "envios_comprobante_tenantId_loteId_idx" ON "envios_comprobante"("tenantId", "loteId");
