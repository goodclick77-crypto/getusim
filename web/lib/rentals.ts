import { prisma } from "./prisma";

// 만료시간이 지났는데도 PENDING(수신대기)로 남은 발급건을 EXPIRED(만료)로 정리.
// (코드 미수신·미차감 건이므로 포인트/원가 영향 없음. 화면을 정확히 보이기 위함.)
// 만료시간이 없는 옛 건은 발급 30분 경과 시 만료 처리.
export async function expireStaleRentals() {
  const now = new Date();
  try {
    await prisma.numberRental.updateMany({
      where: {
        status: "PENDING",
        OR: [
          { expiresAt: { lt: now } },
          { expiresAt: null, createdAt: { lt: new Date(now.getTime() - 30 * 60 * 1000) } },
        ],
      },
      data: { status: "EXPIRED" },
    });
  } catch {
    /* 정리 실패는 무시(주 흐름 방해 금지) */
  }
}
