-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('PLATFORM', 'PIPELINE', 'RISER', 'VALVE', 'MANIFOLD', 'CONNECTOR', 'PUMP', 'EQUIPMENT');

-- CreateEnum
CREATE TYPE "AssetHealth" AS ENUM ('UNKNOWN', 'HEALTHY', 'ATTENTION', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AssetCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AssetOperationalStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "location" TEXT NOT NULL,
    "offshoreField" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "installationDate" TIMESTAMP(3),
    "health" "AssetHealth" NOT NULL DEFAULT 'UNKNOWN',
    "criticality" "AssetCriticality" NOT NULL DEFAULT 'MEDIUM',
    "status" "AssetOperationalStatus" NOT NULL DEFAULT 'ACTIVE',
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_assetCode_key" ON "Asset"("assetCode");

-- CreateIndex
CREATE INDEX "Asset_parentId_idx" ON "Asset"("parentId");

-- CreateIndex
CREATE INDEX "Asset_type_idx" ON "Asset"("type");

-- CreateIndex
CREATE INDEX "Asset_status_isArchived_idx" ON "Asset"("status", "isArchived");

-- CreateIndex
CREATE INDEX "Asset_name_idx" ON "Asset"("name");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
