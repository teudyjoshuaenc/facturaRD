-- AlterEnum
ALTER TYPE "ComprobanteEstado" ADD VALUE 'DRAFT';

-- AlterTable
ALTER TABLE "comprobantes" ADD COLUMN     "comprobanteReferenciaId" TEXT,
ADD COLUMN     "contactoId" TEXT,
ADD COLUMN     "cotizacionId" TEXT,
ALTER COLUMN "eNCF" DROP NOT NULL;
