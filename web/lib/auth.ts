import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const ROUNDS = 10;

/** 신규 비밀번호 해시 (bcrypt) */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

/**
 * 그누보드5 PBKDF2 형식 검증.
 * 형식: `algo:iterations:salt:base64hash` (Defuse/crackstation PBKDF2).
 *  - salt 는 base64 디코드하지 않고 문자열 그대로 사용
 *  - 파생 키 길이 = base64 디코드한 해시의 바이트 길이
 */
function verifyGnuboardPbkdf2(plain: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 4) return false;
  const [algo, iterStr, salt, hashB64] = parts;
  const iterations = parseInt(iterStr, 10);
  if (!iterations) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(hashB64, "base64");
  } catch {
    return false;
  }
  if (expected.length === 0) return false;

  const derived = crypto.pbkdf2Sync(
    plain,
    salt,
    iterations,
    expected.length,
    algo,
  );
  return (
    derived.length === expected.length && crypto.timingSafeEqual(derived, expected)
  );
}

/**
 * 레거시 비밀번호 검증.
 *  - 그누보드5 PBKDF2 (`sha256:12000:...`)  ← 이 사이트의 실제 형식
 *  - bcrypt (`$2y$/$2a$/$2b$`)  ← 버전에 따라 일부 존재 가능
 */
export async function verifyPassword(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) return false;
  try {
    if (/^[a-zA-Z0-9]+:\d+:/.test(hash)) {
      return verifyGnuboardPbkdf2(plain, hash);
    }
    if (/^\$2[aby]\$/.test(hash)) {
      const normalized = hash.replace(/^\$2y\$/, "$2a$");
      return await bcrypt.compare(plain, normalized);
    }
  } catch {
    return false;
  }
  return false;
}
