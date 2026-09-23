-- CreateTable
CREATE TABLE "deposit_log" (
    "id" SERIAL NOT NULL,
    "raw_text" TEXT NOT NULL,
    "tx_key" TEXT NOT NULL,
    "depositor_name" TEXT NOT NULL DEFAULT '',
    "amount" INTEGER NOT NULL DEFAULT 0,
    "occurred_at" TIMESTAMP(3),
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "matched_order_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deposit_log_tx_key_key" ON "deposit_log"("tx_key");

-- CreateIndex
CREATE INDEX "deposit_log_matched_created_at_idx" ON "deposit_log"("matched", "created_at");

-- CreateIndex
CREATE INDEX "deposit_log_amount_idx" ON "deposit_log"("amount");
