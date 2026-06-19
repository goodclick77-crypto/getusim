import bcrypt from "bcryptjs";

const ROUNDS = 10;

/** 신규 비밀번호 해시 (bcrypt) */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

/**
 * 레거시(그누보드5) 비밀번호 검증.
 * 그누보드5는 PHP password_hash(bcrypt, `$2y$`)를 사용한다.
 * bcryptjs 는 `$2a$/$2b$` 만 인식하므로 `$2y$` 를 `$2a$` 로 치환해 비교한다.
 * 아주 오래된 g4 계정의 sha256(64 hex)도 best-effort 로 시도한다.
 */
export async function verifyPassword(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) return false;
  try {
    if (/^\$2[aby]\$/.test(hash)) {
      const normalized = hash.replace(/^\$2y\$/, "$2a$");
      return await bcrypt.compare(plain, normalized);
    }
  } catch {
    return false;
  }
  return false;
}
