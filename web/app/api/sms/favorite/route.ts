import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// 회원별 즐겨찾기 (국가/서비스). GET: 목록, POST: 토글
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ favorites: [] });
  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    select: { kind: true, value: true },
  });
  return NextResponse.json({ favorites });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });

  const { kind, value, on } = await req.json().catch(() => ({}));
  if ((kind !== "country" && kind !== "service") || !value || typeof value !== "string") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  if (on) {
    await prisma.favorite.upsert({
      where: { userId_kind_value: { userId: user.id, kind, value } },
      create: { userId: user.id, kind, value },
      update: {},
    });
  } else {
    await prisma.favorite
      .delete({ where: { userId_kind_value: { userId: user.id, kind, value } } })
      .catch(() => {});
  }
  return NextResponse.json({ ok: true, on: !!on });
}
