-- Ambiente DGII por tenant (aditivo). Columnas nullable: los tenants existentes
-- quedan en null y siguen usando DGII_ENV del servidor, sin cambio de conducta.
CREATE TYPE "AmbienteDgii" AS ENUM ('TESTECF', 'CERTECF', 'ECF');

ALTER TABLE "tenants" ADD COLUMN "ambienteDgii" "AmbienteDgii";

ALTER TABLE "comprobantes" ADD COLUMN "ambienteDgii" "AmbienteDgii";
