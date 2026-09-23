-- CreateTable
CREATE TABLE "notice" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "author_name" TEXT NOT NULL DEFAULT '관리자',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notice_pinned_created_at_idx" ON "notice"("pinned", "created_at");

