-- CreateEnum
CREATE TYPE "RentalPayMethod" AS ENUM ('POINT', 'CARD');

-- CreateEnum
CREATE TYPE "PayStatus" AS ENUM ('NONE', 'APPROVED', 'CAPTURED', 'CANCELED', 'CANCEL_FAILED');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "billing_key" TEXT,
ADD COLUMN     "billing_provider" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "card_label" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "number_rental" ADD COLUMN     "pay_method" "RentalPayMethod" NOT NULL DEFAULT 'POINT',
ADD COLUMN     "pay_amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pay_tx_id" TEXT,
ADD COLUMN     "pay_status" "PayStatus" NOT NULL DEFAULT 'NONE';

-- CreateIndex
CREATE INDEX "number_rental_pay_status_idx" ON "number_rental"("pay_status");
