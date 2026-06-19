import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export class InsufficientPointError extends Error {
  constructor() {
    super("포인트가 부족합니다.");
    this.name = "InsufficientPointError";
  }
}

type AdjustArgs = {
  userId: number;
  amount: number; // +적립 / -차감
  reason: string;
  relType?: string;
  relId?: string | number;
  expireAt?: Date | null;
};

/**
 * 포인트를 원자적으로 조정한다.
 * 잔액(User.point) 갱신 + PointLog(balanceAfter) 기록을 한 트랜잭션으로 처리.
 * 차감 시 잔액 부족이면 InsufficientPointError.
 */
export async function adjustPoint(
  args: AdjustArgs,
  tx?: Prisma.TransactionClient,
) {
  const run = async (db: Prisma.TransactionClient) => {
    const user = await db.user.findUnique({
      where: { id: args.userId },
      select: { point: true },
    });
    if (!user) throw new Error("USER_NOT_FOUND");

    const balanceAfter = user.point + args.amount;
    if (balanceAfter < 0) throw new InsufficientPointError();

    await db.user.update({
      where: { id: args.userId },
      data: { point: balanceAfter },
    });

    return db.pointLog.create({
      data: {
        userId: args.userId,
        amount: args.amount,
        balanceAfter,
        reason: args.reason,
        relType: args.relType ?? "",
        relId: args.relId != null ? String(args.relId) : "",
        expireAt: args.expireAt ?? null,
      },
    });
  };

  if (tx) return run(tx);
  return prisma.$transaction(run);
}
