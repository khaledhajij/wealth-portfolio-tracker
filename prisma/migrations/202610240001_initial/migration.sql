-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('STOCK', 'CRYPTO', 'CASH');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "symbol" VARCHAR(32) NOT NULL,
    "unitPrice" DECIMAL(28,8) NOT NULL,
    "priceAsOf" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionMovement" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "signedQuantity" DECIMAL(28,10) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestKey" VARCHAR(128) NOT NULL,
    "note" VARCHAR(500),

    CONSTRAINT "PositionMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_portfolioId_idx" ON "Membership"("portfolioId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_portfolioId_key" ON "Membership"("userId", "portfolioId");

-- CreateIndex
CREATE UNIQUE INDEX "Position_id_portfolioId_key" ON "Position"("id", "portfolioId");

-- CreateIndex
CREATE UNIQUE INDEX "Position_portfolioId_assetType_symbol_key" ON "Position"("portfolioId", "assetType", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "PositionMovement_requestKey_key" ON "PositionMovement"("requestKey");

-- CreateIndex
CREATE INDEX "PositionMovement_portfolioId_positionId_occurredAt_idx" ON "PositionMovement"("portfolioId", "positionId", "occurredAt");

-- CreateIndex
CREATE INDEX "PositionMovement_createdBy_idx" ON "PositionMovement"("createdBy");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "PositionMovement" ADD CONSTRAINT "PositionMovement_positionId_portfolioId_fkey" FOREIGN KEY ("positionId", "portfolioId") REFERENCES "Position"("id", "portfolioId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "PositionMovement" ADD CONSTRAINT "PositionMovement_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
