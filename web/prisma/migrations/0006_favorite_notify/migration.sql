-- CreateTable
CREATE TABLE "favorite" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notify_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "on_deposit" BOOLEAN NOT NULL DEFAULT true,
    "on_charge_request" BOOLEAN NOT NULL DEFAULT true,
    "on_order" BOOLEAN NOT NULL DEFAULT false,
    "on_inquiry" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notify_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "favorite_user_id_idx" ON "favorite"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_user_id_kind_value_key" ON "favorite"("user_id", "kind", "value");

-- AddForeignKey
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
