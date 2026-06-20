import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { fivesim, FiveSimError } from "@/lib/fivesim";

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

  // 코드 수신 → PENDING 인 경우에만 차감 (동시 폴링 중복차감 방지)
  const code = await prisma.$transaction(async (tx) => {
    const upd = await tx.numberRental.updateMany({
      where: { id: rental.id, status: "PENDING" },
      data: { status: "RECEIVED", smsCode: sms.code, smsText: sms.text },
    });
    if (upd.count === 1) {
      const u = await tx.user.findUnique({
        where: { id: user.id },
        select: { point: true },
      });
      const deduct = Math.min(rental.pricePoint, u?.point ?? 0);
      const balanceAfter = (u?.point ?? 0) - deduct;
      await tx.user.update({ where: { id: user.id }, data: { point: balanceAfter } });
      await tx.pointLog.create({
        data: {
          userId: user.id,
          amount: -deduct,
          balanceAfter,
          reason: `SMS 인증코드 (NO:${rental.fivesimId})`,
          relType: "rental",
          relId: String(rental.id),
        },
      });
    }
    return sms.code;
  });

  return NextResponse.json({ code });
}
