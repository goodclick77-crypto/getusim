# GetUsim

글로벌 SMS 인증(가상번호 수신) 서비스. 사용자가 **포인트를 충전**하고 그 포인트로 **5sim.net 기반 가상번호 SMS 인증**을 이용합니다.

레거시 **그누보드5 + 영카트5 (PHP/MariaDB)** 시스템을 **최신 스택**으로 재구축하는 프로젝트입니다. 기존 데이터(회원·포인트·결제 이력 등)는 그대로 이전합니다.

## 스택

| 영역 | 기술 |
|---|---|
| 프론트 + 백엔드 | Next.js (App Router) + TypeScript |
| ORM | Prisma 6 |
| DB | PostgreSQL (Railway 관리형) |
| 인증 | 자체 세션 + bcrypt (레거시 비밀번호 호환) |
| SMS 인증 엔진 | 5sim.net API |
| 결제 | 무통장입금(현행) — PG는 추상화 후 추가 예정 |
| 배포 | Railway (GitHub 연동 자동 배포) |

## 구조

```
getusim/
├─ web/                 # Next.js 앱 (Railway Root Directory = web)
│  ├─ app/              # App Router
│  ├─ lib/prisma.ts     # Prisma 클라이언트 싱글톤
│  ├─ prisma/schema.prisma
│  └─ .env.example
└─ (레거시 백업 .sql / Data_Backup — gitignore, 절대 커밋 금지)
```

## 데이터 모델 (정리된 핵심 6종)

- `User` ← g5_member (회원 10,443)
- `PointLog` ← g5_point (포인트 내역 35,934)
- `ChargeOrder` ← g5_wpot_order (충전 주문 10,607, 무통장 중심)
- `Inquiry` ← g5_qa_content (1:1 문의 4,130)
- `NumberRental` ← 신규 (5sim 가상번호/SMS 수신)
- 로그성(g5_visit, g5_uniqid)·미사용 영카트 테이블은 폐기

## 로컬 개발

```bash
cd web
cp .env.example .env   # DATABASE_URL 등 채우기
npm install
npx prisma generate
npx prisma migrate dev # DB 연결 후
npm run dev
```
