import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { fivesim, FiveSimError } from "@/lib/fivesim";
import { settleReceived } from "@/lib/rentals";

// 수신 SMS 확인. 코드 도착 시 1회만 정액 차감(멱등).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const rentalId = Number(new URL(req.url).searchParams.get("rentalId"));
  const rental = await prisma.numberRental.findFirst({
    where: { id: rentalId, userId: user.id },
  });
  if (!rental?.fivesimId) {
    return NextResponse.json({ error: "내역을 찾을 수 없습니다" }, { status: 404 });
  }
  if (rental.status === "RECEIVED") {
    return NextResponse.json({ code: rental.smsCode });
  }
  if (rental.status !== "PENDING") {
    return NextResponse.json({ code: null });
  }

  let order;
  try {
    order = await fivesim.check(rental.fivesimId);
  } catch (e) {
    if (e instanceof FiveSimError) return NextResponse.json({ code: null });
    throw e;
  }

  const sms = order.sms?.[0];
  if (!sms?.code) return NextResponse.json({ code: null });

  // 코드 수신 반영(멱등): RECEIVED 전환 + 정액 차감(보유 범위 내, 음수 방지) + finish.
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

  return NextResponse.json({ code: sms.code, balanceAfter: balanceAfter ?? undefined });
}
