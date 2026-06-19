import "server-only";
import { prisma } from "./prisma";
import { hashPassword, verifyPassword } from "./auth";

/**
 * 로그인 인증 + 레거시 비밀번호 자동 이행.
 * - passwordHash(신규)가 있으면 그걸로 검증.
 * - 없으면 legacyHash(그누보드 해시)로 검증 후, 성공 시 신규 해시로 재저장.
 */
export async function authenticate(loginId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { loginId } });
  if (!user || user.leftAt) return null;

  if (user.passwordHash) {
    const ok = await verifyPassword(password, user.passwordHash);
    return ok ? user : null;
  }

  // 레거시 이행
  const ok = await verifyPassword(password, user.legacyHash);
  if (!ok) return null;
  const newHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash, legacyHash: null },
  });
  return user;
}

export class RegisterError extends Error {}

export async function registerUser(input: {
  loginId: string;
  password: string;
  name: string;
  email: string;
  phone: string;
}) {
  const loginId = input.loginId.trim();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(loginId))
    throw new RegisterError("아이디는 영문/숫자 3~20자여야 합니다.");
  if (input.password.length < 6)
    throw new RegisterError("비밀번호는 6자 이상이어야 합니다.");

  const exists = await prisma.user.findUnique({ where: { loginId } });
  if (exists) throw new RegisterError("이미 사용 중인 아이디입니다.");

  return prisma.user.create({
    data: {
      loginId,
      passwordHash: await hashPassword(input.password),
      name: input.name.trim(),
      nickname: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      level: 2,
      role: "USER",
    },
  });
}
