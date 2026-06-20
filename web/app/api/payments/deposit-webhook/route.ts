import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { parseKbDeposit } from "@/lib/bank";
import { completeCharge } from "@/lib/charge";

// 은행 입금 알림(폰 SMS 포워딩) 수신 → 충전 주문 자동 매칭/지급.
// 보안: 환경변수 DEPOSIT_WEBHOOK_TOKEN 과 일치하는 X-Webhook-Token 헤더 필요.
const MATCH_WINDOW_DAYS = 14;

export async function POST(req: Request) {
  const secret = process.env.DEPOSIT_WEBHOOK_TOKEN;
  // 헤더(X-Webhook-Token) 또는 쿼리(?token=) 둘 다 허용 — 헤더 못 넣는 앱 대비
  const token =
    req.headers.get("x-webhook-token") || new URL(req.url).searchParams.get("token");
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const text = String(
    (body as Record<string, unknown>)?.text ??
      (body as Record<string, unknown>)?.message ??
      (body as Record<string, unknown>)?.msg ??
      "",
  ).trim();
  if (!text) return NextResponse.json({ error: "no text" }, { status: 400 });

  const txKey = createHash("sha256").update(text).digest("hex");

  // 멱등: 동일 문자 재전송 무시
  const dup = await prisma.depositLog.findUnique({ where: { txKey } });
  if (dup) return NextResponse.json({ ok: true, dup: true, matched: dup.matched });

  const parsed = parseKbDeposit(text);

  const log = await prisma.depositLog.create({
    data: {
      rawText: text,
      txKey,
      depositorName: parsed?.name ?? "",
      amount: parsed?.amount ?? 0,
      occurredAt: parsed?.occurredAt ?? null,
    },
  });

  // 자동 매칭: (금액 + 입금자명 일치) 미충전 PENDING 주문이 정확히 1건일 때만 지급
  let matched = false;
  if (parsed && parsed.amount > 0 && parsed.name) {
    const norm = (s: string) => s.replace(/\s/g, "");
    const since = new Date(Date.now() - MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const candidates = await prisma.chargeOrder.findMany({
      where: {
        status: "PENDING",
        charged: false,
        amount: parsed.amount,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "asc" },
    });
    const hits = candidates.filter((o) => norm(o.depositName) === norm(parsed.name));
    if (hits.length === 1) {
      const ok = await completeCharge(hits[0].id, parsed.amount);
      if (ok) {
        matched = true;
        await prisma.depositLog.update({
          where: { id: log.id },
          data: { matched: true, matchedOrderId: hits[0].id },
        });
      }
    }
  }

  return NextResponse.json({ ok: true, matched });
}
