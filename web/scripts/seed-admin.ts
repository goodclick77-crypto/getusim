// 관리자 계정 시드/갱신.
//   ADMIN_LOGIN_ID, ADMIN_PASSWORD 환경변수 사용. 실행: npm run seed:admin
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const loginId = process.env.ADMIN_LOGIN_ID || "admin";
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD 환경변수를 설정하세요.");
  }
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { loginId },
    update: { passwordHash, legacyHash: null, role: "ADMIN", level: 10 },
    create: {
      loginId,
      passwordHash,
      name: "관리자",
      nickname: "관리자",
      role: "ADMIN",
      level: 10,
    },
  });
  console.log(`✅ 관리자 준비 완료: ${user.loginId} (id=${user.id})`);
}

main()
  .catch((e) => {
    console.error("❌", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
