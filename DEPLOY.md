# 배포 가이드 (Railway)

## 1. Railway 프로젝트 생성

1. Railway → **New Project → Deploy from GitHub repo** → `goodclick77-crypto/getusim` 선택
2. 생성된 서비스 → **Settings → Root Directory** 를 **`web`** 로 설정
   (앱이 `web/` 하위에 있으므로 필수)
3. 같은 프로젝트에 **New → Database → PostgreSQL** 추가

## 2. 환경변수 (서비스 → Variables)

| 키 | 값 |
|---|---|
| `DATABASE_URL` | Postgres 서비스의 `DATABASE_URL` 참조 (`${{Postgres.DATABASE_URL}}`) |
| `AUTH_SECRET` | 긴 랜덤 문자열 (`openssl rand -hex 32`) |
| `FIVESIM_API_KEY` | 5sim.net → Profile → API Key |
| `FIVESIM_BASE_URL` | `https://5sim.net/v1` |
| `POINT_PER_5SIM_UNIT` | 5sim 단가→포인트 환산 배수 (마진, 예: 30) |
| `DEPOSIT_BANK` / `DEPOSIT_ACCOUNT` / `DEPOSIT_HOLDER` | 무통장 입금 계좌 안내 |
| `ADMIN_LOGIN_ID` / `ADMIN_PASSWORD` | (신규 관리자 시드용, 선택) |

## 3. 배포

- GitHub `main` 푸시 시 자동 배포.
- 배포 시 `prisma migrate deploy` 가 자동 실행되어 스키마가 생성됩니다
  (`web/railway.json` 의 startCommand).

## 4. 레거시 데이터 이전 (1회)

백업 SQL은 보안상 git에 없으므로 **로컬에서** Railway DB로 직접 적재합니다.

```bash
cd web
# Railway Postgres의 공개 연결 URL 사용 (Connect 탭의 Public Network)
export DATABASE_URL="postgresql://...railway 공개주소..."

npx prisma migrate deploy   # 스키마 생성 (최초 1회)
npm run migrate:legacy      # 회원/포인트/충전/문의 이전
```

이전 결과 예시:
```
✓ 회원 10443/10443
✓ 포인트내역 35934/35934
✓ 충전주문 10607/10607
✓ 1:1문의 4130/4130
```

> ⚠️ 기존 회원 비밀번호는 그누보드 해시 그대로 보존되어, **최초 로그인 시 자동으로
> 신규 bcrypt 해시로 이행**됩니다. 사용자는 기존 비밀번호 그대로 로그인합니다.

## 5. 관리자 로그인

- 레거시 이전 시: 기존 관리자(레벨 10) 계정으로 로그인.
- 신규 시드: `ADMIN_PASSWORD` 설정 후 `npm run seed:admin`.
