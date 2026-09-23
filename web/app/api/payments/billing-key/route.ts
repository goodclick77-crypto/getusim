import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider, PaymentNotConfiguredError } from "@/lib/payments";

/**
 * 카드 등록(빌링키 발급) / 해제.
 * POST body: { authPayload?: Record<string,string> } — PG 카드등록 창이 돌려준 값(토스는 authKey).
 *   mock 결제사는 아무 값 없이 즉시 발급된다(스테이징 미리보기용).
 * DELETE: 등록 해제(빌링키 삭제). PG 쪽 빌링키 폐기는 결제사별로 추후.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const provider = getPaymentProvider();
  if (!provider.isConfigured()) {
    return NextResponse.json({ error: "카드 결제가 아직 준비되지 않았습니다" }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as { authPayload?: Record<string, string> };

  try {
    const r = await provider.issueBillingKey({
      customerId: `U${user.id}`,
      authPayload: body.authPayload ?? {},
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { billingKey: r.billingKey, billingProvider: provider.name, cardLabel: r.cardLabel },
    });
    return NextResponse.json({ ok: true, card: { label: r.cardLabel } });
  } catch (e) {
    if (e instanceof PaymentNotConfiguredError) {
      return NextResponse.json({ error: "카드 결제가 아직 준비되지 않았습니다" }, { status: 503 });
    }
    console.error("[pay] 빌링키 발급 실패:", e);
    return NextResponse.json({ error: "카드 등록에 실패했습니다. 다시 시도해 주세요." }, { status: 500 });
  }
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  await prisma.user.update({
    where: { id: user.id },
    data: { billingKey: null, billingProvider: "", cardLabel: "" },
  });
  return NextResponse.json({ ok: true });
}
