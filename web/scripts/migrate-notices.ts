// 레거시 g5_write_notice → Notice 이전. 실행: npm run migrate:notices
import "dotenv/config";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { parseDump, accessor, type Row } from "./sql-dump";

const prisma = new PrismaClient();
const DUMP =
  process.env.LEGACY_DUMP ||
  path.resolve(process.cwd(), "..", "20260619_clickpress_DB_Backup.sql");

const FALLBACK = new Date("2022-01-01T00:00:00Z");
function dt(s: string): Date {
  if (!s || s.startsWith("0000")) return FALLBACK;
  const d = new Date(s.replace(" ", "T"));
  return isNaN(d.getTime()) ? FALLBACK : d;
}
const int = (s: string) => {
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
};

async function main() {
  const dump = parseDump(DUMP, ["g5_write_notice"]);
  const w = accessor(dump.columns["g5_write_notice"]);
  const rows = dump.rows["g5_write_notice"]
    .filter((r: Row) => w(r, "wr_is_comment") !== "1") // 댓글 제외, 본글만
    .map((r: Row) => ({
      id: int(w(r, "wr_id")),
      title: w(r, "wr_subject") || "(제목 없음)",
      content: w(r, "wr_content"),
      views: int(w(r, "wr_hit")),
      authorName: w(r, "wr_name") || "관리자",
      createdAt: dt(w(r, "wr_datetime")),
    }))
    .sort((a, b) => a.id - b.id);

  const res = await prisma.notice.createMany({ data: rows, skipDuplicates: true });
  console.log(`✓ 공지 ${res.count}/${rows.length} 이전`);

  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"notice"','id'), COALESCE((SELECT MAX(id) FROM "notice"),1))`,
  );
  console.log("✓ 시퀀스 보정");
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
