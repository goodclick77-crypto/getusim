import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { fivesim } from "@/lib/fivesim";

// 번호 밴 (수신 실패 시). 코드 미수신 상태이므로 차감 없음.
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
  if (rental.status === "PENDING") {
    try {
      await fivesim.ban(rental.fivesimId);
    } catch {}
    await prisma.numberRental.update({
      where: { id: rental.id },
      data: { status: "CANCELED" },
    });
  }
  return NextResponse.json({ ok: true });
}
