-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'VIP', 'ADMIN');

-- CreateEnum
CREATE TYPE "PayMethod" AS ENUM ('BANK_TRANSFER', 'CARD', 'EASY_PAY', 'VBANK');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('PENDING', 'RECEIVED', 'FINISHED', 'CANCELED', 'EXPIRED');

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "login_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "legacy_hash" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "nickname" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "level" INTEGER NOT NULL DEFAULT 2,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "point" INTEGER NOT NULL DEFAULT 0,
    "recommended_by" TEXT NOT NULL DEFAULT '',
    "sms_agree" BOOLEAN NOT NULL DEFAULT false,
    "mail_agree" BOOLEAN NOT NULL DEFAULT false,
    "memo" TEXT,
    "extra" JSONB,
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" TEXT NOT NULL DEFAULT '',
    "left_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "rel_type" TEXT NOT NULL DEFAULT '',
    "rel_id" TEXT NOT NULL DEFAULT '',
    "expire_at" TIMESTAMP(3),
    "expired" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_order" (
    "id" SERIAL NOT NULL,
    "legacy_od_id" BIGINT,
    "user_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "charge_point" INTEGER NOT NULL,
    "point_term_days" INTEGER NOT NULL DEFAULT 0,
    "method" "PayMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "status" "ChargeStatus" NOT NULL DEFAULT 'PENDING',
    "deposit_name" TEXT NOT NULL DEFAULT '',
    "bank_account" TEXT NOT NULL DEFAULT '',
    "paid_price" INTEGER NOT NULL DEFAULT 0,
    "paid_at" TIMESTAMP(3),
    "charged" BOOLEAN NOT NULL DEFAULT false,
    "pg" TEXT NOT NULL DEFAULT '',
    "pg_tno" TEXT NOT NULL DEFAULT '',
    "legacy_data" JSONB,
    "ip" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charge_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "parent_id" INTEGER,
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'OPEN',
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "number_rental" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT '5sim',
    "fivesim_id" TEXT,
    "country" TEXT NOT NULL,
    "operator" TEXT NOT NULL DEFAULT 'any',
    "service" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL DEFAULT '',
    "sms_code" TEXT,
    "sms_text" TEXT,
    "price_point" INTEGER NOT NULL,
    "status" "RentalStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "number_rental_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_login_id_key" ON "user"("login_id");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_phone_idx" ON "user"("phone");

-- CreateIndex
CREATE INDEX "point_log_user_id_created_at_idx" ON "point_log"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "charge_order_legacy_od_id_key" ON "charge_order"("legacy_od_id");

-- CreateIndex
CREATE INDEX "charge_order_user_id_created_at_idx" ON "charge_order"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "charge_order_status_idx" ON "charge_order"("status");

-- CreateIndex
CREATE INDEX "inquiry_user_id_created_at_idx" ON "inquiry"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "number_rental_user_id_created_at_idx" ON "number_rental"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "number_rental_status_idx" ON "number_rental"("status");

-- AddForeignKey
ALTER TABLE "point_log" ADD CONSTRAINT "point_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_order" ADD CONSTRAINT "charge_order_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "number_rental" ADD CONSTRAINT "number_rental_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

