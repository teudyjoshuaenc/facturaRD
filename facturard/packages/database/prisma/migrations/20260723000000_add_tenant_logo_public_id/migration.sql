-- Upload REAL del logo del emisor vía Cloudinary.
-- Migración ADITIVA PURA: una columna nullable sobre `tenants`. Cero cambios en
-- columnas existentes. `logoUrl` se conserva intacto (las URLs externas ya
-- pegadas siguen funcionando); `logoPublicId` guarda el public_id fijo de
-- Cloudinary (`facturard/<tenantId>/logo`) sólo cuando el logo se subió como
-- archivo. Es NULL para logos por enlace externo o sin logo.

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "logoPublicId" TEXT;
