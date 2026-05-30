/*
  Warnings:

  - You are about to drop the column `p12Cifrado` on the `certificados` table. All the data in the column will be lost.
  - Added the required column `p12Encrypted` to the `certificados` table without a default value. This is not possible if the table is not empty.
  - Added the required column `p12Iv` to the `certificados` table without a default value. This is not possible if the table is not empty.
  - Added the required column `p12Tag` to the `certificados` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `certificados` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "certificados" DROP COLUMN "p12Cifrado",
ADD COLUMN     "p12Encrypted" TEXT NOT NULL,
ADD COLUMN     "p12Iv" TEXT NOT NULL,
ADD COLUMN     "p12Tag" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "certificados_tenantId_activo_idx" ON "certificados"("tenantId", "activo");
