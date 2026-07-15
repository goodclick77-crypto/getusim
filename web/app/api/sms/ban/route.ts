import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { fivesim, FiveSimError } from "@/lib/fivesim";
import { settleReceived } from "@/lib/rentals";

// 번호 밴(수신 실패 시). 단, 밴 직전 코드가 이미 도착했을 수 있으므로 먼저 5sim을 확인한다.
// 코드가 있으면 5sim은 이미 과금한 상태 → 그냥 밴하면 원가만 나가고 포인트는 안 빠져 손실.
// 그래서 코드가 있으면 밴이 아니라 정산(차감)으로 전환한다.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { rentalId } = await req.json().catch(() => ({}));
  const rental = await prisma.numberRental.findFirst({
    where: { id: Number(rentalId), userId: user.id },
  });
  if (!rental?.fivesimId) {
    return NextResponse.json({ error: "내역을 찾을 수 없습니다" }, { status: 404 });
  }

  // 이미 수신 처리된 건이면 코드를 그대로 반환(멱등)
  if (rental.status === "RECEIVED") {
    return NextResponse.json({ ok: true, received: true, code: rental.smsCode });
  }
  if (rental.status !== "PENDING") {
    return NextResponse.json({ ok: true, received: false });
  }

  // 밴 전에 코드 도착 여부 확인.
  let order;
  try {
    order = await fivesim.check(rental.fivesimId);
  } catch (e) {
    if (!(e instanceof FiveSimError)) throw e;
    order = null; // 확인 불가 → 아래에서 밴 처리
  }

  const sms = order?.sms?.[0];
  if (sms?.code) {
    // 코드 도착 → 밴 대신 정산(차감/RECEIVED + 5sim finish). 멱등.
    const balanceAfter = await settleReceived(
      {
        id: rental.id,
        userId: rental.userId,
        pricePoint: rental.pricePoint,
        fivesimId: rental.fivesimId,
      },
      sms.code,
      sms.text,
    );
    return NextResponse.json({
      ok: true,
      received: true,
      code: sms.code,
      balanceAfter: balanceAfter ?? undefined,
    });
  }

  // 코드 없음 → 5sim 밴(원가 환불) 후 CANCELED. 상태 가드로 동시 수신 처리와 충돌 방지.
  try {
    await fivesim.ban(rental.fivesimId);
  } catch {}
  await prisma.numberRental.updateMany({
    where: { id: rental.id, status: "PENDING" },
    data: { status: "CANCELED" },
  });
  return NextResponse.json({ ok: true, received: false });
}
