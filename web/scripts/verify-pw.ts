// 레거시 비밀번호 검증 테스트.
//   사용: DATABASE_URL=<public url> npm run verify:pw -- <아이디> <비밀번호>
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { verifyPassword } from "../lib/auth";

const prisma = new PrismaClient();

async function main() {
  const [, , loginId, password] = process.argv;
  if (!loginId || !password) {
    console.log("사용법: npm run verify:pw -- <아이디> <비밀번호>");
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { loginId } });
  if (!user) {
    console.log("❌ 존재하지 않는 아이디:", loginId);
    process.exit(1);
  }
  const ok = await verifyPassword(password, user.legacyHash || user.passwordHash);
  console.log(ok ? "✅ 비밀번호 일치 — 로그인 정상 동작" : "❌ 비밀번호 불일치");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
