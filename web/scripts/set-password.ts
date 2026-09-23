// 회원 비밀번호 강제 변경(운영자용).
//   실행: npx tsx scripts/set-password.ts <loginId> <newPassword>
//   DB 선택: DATABASE_URL 이 없거나 railway 내부 호스트(*.railway.internal)면 DATABASE_PUBLIC_URL 을 쓴다.
//   → `railway run --environment staging --service Postgres -- npx tsx scripts/set-password.ts test 1234`
//     처럼 railway run 으로 접속정보를 주입하면 비밀번호가 화면에 찍히지 않는다.
const pub = process.env.DATABASE_PUBLIC_URL;
const cur = process.env.DATABASE_URL || "";
if (pub && (!cur || cur.includes(".railway.internal") || cur.includes("localhost"))) {
  process.env.DATABASE_URL = pub;
}

async function main() {
  const [loginId, password] = process.argv.slice(2);
  if (!loginId || !password) {
    throw new Error("사용법: npx tsx scripts/set-password.ts <loginId> <newPassword>");
  }
  const { PrismaClient } = await import("@prisma/client");
  const bcrypt = (await import("bcryptjs")).default;
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { loginId }, select: { id: true, name: true } });
    if (!user) throw new Error(`회원을 찾을 수 없습니다: ${loginId}`);
    const passwordHash = await bcrypt.hash(password, 10);
    // legacyHash 를 지워 그누보드 해시 폴백이 새 비밀번호를 덮어쓰지 않게 한다.
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash, legacyHash: null } });
    const host = (process.env.DATABASE_URL || "").replace(/.*@/, "").replace(/\/.*/, "");
    console.log(`✅ 비밀번호 변경 완료: ${loginId} (id=${user.id}, ${user.name || "-"}) @ ${host}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});
