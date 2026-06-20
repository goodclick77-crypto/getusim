import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// 진행 중(수신대기)인 가장 최근 번호. 페이지 재진입 시 이어받기용.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ rental: null });

  const rental = await prisma.numberRental.findFirst({
    where: { userId: user.id, status: "PENDING", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      phoneNumber: true,
      expiresAt: true,
      country: true,
      service: true,
      pricePoint: true,
      smsCode: true,
    },
  });

  return NextResponse.json({ rental });
}
