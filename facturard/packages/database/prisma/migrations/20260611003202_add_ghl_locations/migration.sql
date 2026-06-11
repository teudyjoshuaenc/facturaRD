-- CreateTable
CREATE TABLE "ghl_locations" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ghl_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ghl_locations_locationId_key" ON "ghl_locations"("locationId");

-- AddForeignKey
ALTER TABLE "ghl_locations" ADD CONSTRAINT "ghl_locations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
