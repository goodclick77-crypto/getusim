-- CreateTable
CREATE TABLE "faq" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL DEFAULT '일반',
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faq_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "faq_order_idx" ON "faq"("order");

