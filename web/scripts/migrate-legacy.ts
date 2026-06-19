// 레거시 그누보드5 덤프 → 신규 Postgres 마이그레이션.
//   실행: cd web && npm run migrate:legacy
//   - 원본 PK 보존: User.id=mb_no, Inquiry.id=qa_id, ChargeOrder.legacyOdId=od_id
//   - 비밀번호: mb_password 를 legacyHash 로 보존(최초 로그인 시 재해시)
//   - 재실행 안전: skipDuplicates
import "dotenv/config";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { parseDump, accessor, type Row } from "./sql-dump";

const prisma = new PrismaClient();

const DUMP =
  process.env.LEGACY_DUMP ||
  path.resolve(process.cwd(), "..", "20260619_clickpress_DB_Backup.sql");

const FALLBACK = new Date("2021-11-19T00:00:00Z");

function dt(s: string): Date | null {
  if (!s || s.startsWith("0000")) return null;
  const d = new Date(s.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}
const dtReq = (s: string): Date => dt(s) ?? FALLBACK;
const int = (s: string): number => {
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  console.log("• 덤프 파싱:", DUMP);
  const dump = parseDump(DUMP, [
    "g5_member",
    "g5_point",
    "g5_wpot_order",
    "g5_wpot_order_data",
    "g5_qa_content",
  ]);

  // ---------- USERS ----------
  const mCols = dump.columns["g5_member"];
  const m = accessor(mCols);
  const memberRows = dump.rows["g5_member"];
  const mbIdToNo = new Map<string, number>();

  const users = memberRows.map((r: Row) => {
    const mbNo = int(m(r, "mb_no"));
    const mbId = m(r, "mb_id");
    mbIdToNo.set(mbId, mbNo);
    const level = int(m(r, "mb_level"));
    const extra: Record<string, string> = {};
    for (let i = 1; i <= 10; i++) {
      const v = m(r, `mb_${i}`);
      if (v) extra[`mb_${i}`] = v;
    }
    return {
      id: mbNo,
      loginId: mbId,
      passwordHash: "", // 최초 로그인 시 legacyHash 검증 후 채움
      legacyHash: m(r, "mb_password") || null,
      name: m(r, "mb_name"),
      nickname: m(r, "mb_nick"),
      email: m(r, "mb_email"),
      phone: m(r, "mb_hp"),
      level,
      role: (level >= 10 ? "ADMIN" : "USER") as "ADMIN" | "USER",
      point: int(m(r, "mb_point")),
      recommendedBy: m(r, "mb_recommend"),
      smsAgree: m(r, "mb_sms") === "1",
      mailAgree: m(r, "mb_mailling") === "1",
      memo: m(r, "mb_memo") || null,
      extra: Object.keys(extra).length ? extra : undefined,
      lastLoginAt: dt(m(r, "mb_today_login")),
      lastLoginIp: m(r, "mb_login_ip"),
      leftAt: m(r, "mb_leave_date") ? dtReq(m(r, "mb_leave_date")) : null,
      createdAt: dtReq(m(r, "mb_datetime")),
    };
  });

  let n = 0;
  for (const c of chunk(users, 1000)) {
    const res = await prisma.user.createMany({ data: c, skipDuplicates: true });
    n += res.count;
  }
  console.log(`  ✓ 회원 ${n}/${users.length}`);

  // ---------- POINT LOGS ----------
  const p = accessor(dump.columns["g5_point"]);
  const pointLogs = dump.rows["g5_point"]
    .map((r: Row) => {
      const uid = mbIdToNo.get(p(r, "mb_id"));
      if (!uid) return null;
      return {
        userId: uid,
        amount: int(p(r, "po_point")),
        balanceAfter: int(p(r, "po_mb_point")),
        reason: p(r, "po_content"),
        relType: p(r, "po_rel_table"),
        relId: p(r, "po_rel_id"),
        expireAt: dt(p(r, "po_expire_date")),
        expired: p(r, "po_expired") === "1",
        createdAt: dtReq(p(r, "po_datetime")),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  n = 0;
  for (const c of chunk(pointLogs, 2000)) {
    const res = await prisma.pointLog.createMany({ data: c });
    n += res.count;
  }
  console.log(`  ✓ 포인트내역 ${n}/${dump.rows["g5_point"].length}`);

  // ---------- CHARGE ORDERS (+order_data 병합) ----------
  const od = accessor(dump.columns["g5_wpot_order_data"]);
  const dataByOid = new Map<string, Record<string, string | null>>();
  for (const r of dump.rows["g5_wpot_order_data"]) {
    dataByOid.set(od(r, "od_id"), {
      dt_pg: od(r, "dt_pg"),
      dt_data: od(r, "dt_data"),
      P_TID: od(r, "P_TID"),
      P_MID: od(r, "P_MID"),
    });
  }

  const w = accessor(dump.columns["g5_wpot_order"]);
  const statusMap: Record<string, "PENDING" | "COMPLETED" | "CANCELED"> = {
    대기: "PENDING",
    완료: "COMPLETED",
    취소: "CANCELED",
  };
  const methodMap: Record<string, "BANK_TRANSFER" | "CARD" | "EASY_PAY" | "VBANK"> = {
    무통장: "BANK_TRANSFER",
    계좌이체: "BANK_TRANSFER",
    신용카드: "CARD",
    카드: "CARD",
    간편결제: "EASY_PAY",
    가상계좌: "VBANK",
  };
  const orders = dump.rows["g5_wpot_order"]
    .map((r: Row) => {
      const uid = mbIdToNo.get(w(r, "mb_id"));
      if (!uid) return null;
      const odId = w(r, "od_id");
      return {
        legacyOdId: odId ? BigInt(odId) : null,
        userId: uid,
        amount: int(w(r, "bk_price")),
        chargePoint: int(w(r, "bk_charge_point")),
        pointTermDays: int(w(r, "bk_chargepoint_term")),
        method: methodMap[w(r, "bk_payment")] ?? "BANK_TRANSFER",
        status: statusMap[w(r, "bk_status")] ?? "PENDING",
        depositName: w(r, "bk_deposit_name"),
        bankAccount: w(r, "bk_bank_account"),
        paidPrice: int(w(r, "bk_receipt_price")),
        paidAt: dt(w(r, "bk_receipt_time")),
        charged: w(r, "bk_is_charge") === "1",
        pg: w(r, "bk_pg"),
        pgTno: w(r, "bk_tno"),
        legacyData: dataByOid.get(odId) ?? undefined,
        ip: w(r, "bk_ip"),
        createdAt: dtReq(w(r, "bk_time")),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  n = 0;
  for (const c of chunk(orders, 1000)) {
    const res = await prisma.chargeOrder.createMany({ data: c, skipDuplicates: true });
    n += res.count;
  }
  console.log(`  ✓ 충전주문 ${n}/${dump.rows["g5_wpot_order"].length}`);

  // ---------- INQUIRIES ----------
  const q = accessor(dump.columns["g5_qa_content"]);
  const qaIds = new Set(dump.rows["g5_qa_content"].map((r) => int(q(r, "qa_id"))));
  const inquiries = dump.rows["g5_qa_content"]
    .map((r: Row) => {
      const qaId = int(q(r, "qa_id"));
      const parent = int(q(r, "qa_parent"));
      return {
        id: qaId,
        userId: mbIdToNo.get(q(r, "mb_id")) ?? null,
        parentId: parent > 0 && parent !== qaId && qaIds.has(parent) ? parent : null,
        title: q(r, "qa_subject"),
        content: q(r, "qa_content"),
        status: (q(r, "qa_status") === "1" ? "ANSWERED" : "OPEN") as "ANSWERED" | "OPEN",
        name: q(r, "qa_name"),
        email: q(r, "qa_email"),
        phone: q(r, "qa_hp"),
        createdAt: dtReq(q(r, "qa_datetime")),
      };
    })
    // 부모 먼저 삽입되도록 id 오름차순
    .sort((a, b) => a.id - b.id);

  n = 0;
  for (const c of chunk(inquiries, 1000)) {
    const res = await prisma.inquiry.createMany({ data: c, skipDuplicates: true });
    n += res.count;
  }
  console.log(`  ✓ 1:1문의 ${n}/${dump.rows["g5_qa_content"].length}`);

  // ---------- 시퀀스 보정 (명시적 id 삽입分) ----------
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"user"','id'), COALESCE((SELECT MAX(id) FROM "user"),1))`,
  );
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"inquiry"','id'), COALESCE((SELECT MAX(id) FROM "inquiry"),1))`,
  );
  console.log("  ✓ 시퀀스 보정 완료");

  console.log("\n✅ 마이그레이션 완료");
}

main()
  .catch((e) => {
    console.error("❌ 실패:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
