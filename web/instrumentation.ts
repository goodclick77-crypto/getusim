// 앱 내장 스케줄러 — 외부 크론에 의존하지 않고 만료 정리를 주기 실행한다.
//
// register()는 Next 서버 인스턴스가 뜰 때 1회 호출된다(Next instrumentation).
// 하는 일: 3분(SMS_WAIT_MS) 지난 미수신 SMS 건에 "밴을 대신 눌러준다".
//  - 클라이언트의 3분 자동 밴은 브라우저에서만 눌린다. 사용자가 탭을 닫으면 아무도 안 눌러
//    5sim 번호가 방치된 채 뒤늦게 과금(원가 손실)된다. 이 스케줄러가 그 안전망이다.
//  - 그 사이 코드가 도착했으면 밴 대신 정산(차감)해 매출을 확보한다.
//  - 자동매칭 기간이 지난 미입금 충전 주문도 함께 취소한다.
// 외부 크론 라우트(/api/cron/sweep)는 그대로 둬 이중화한다.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // dev HMR/다중 호출로 인터벌이 중복 등록되는 것 방지
  const g = globalThis as unknown as { __sweepStarted?: boolean };
  if (g.__sweepStarted) return;
  g.__sweepStarted = true;

  const { expireStaleRentals } = await import("@/lib/rentals");
  const { expireStaleChargeOrders } = await import("@/lib/charge");
  const { markSwept } = await import("@/lib/sweep-status");

  let running = false;
  const tick = async () => {
    if (running) return; // 이전 실행이 안 끝났으면 건너뜀(겹침 방지)
    running = true;
    try {
      await Promise.allSettled([expireStaleRentals(), expireStaleChargeOrders()]);
    } catch {
      /* 스케줄러는 절대 죽지 않는다 */
    } finally {
      running = false;
      markSwept(); // 하트비트 갱신(관리자 화면/로그에서 생존 확인)
    }
  };

  console.log("[sweep] 스케줄러 시작 — 30초 간격 자동 정리");

  // 부팅 직후 DB 준비 시간을 잠깐 준 뒤 시작, 이후 30초마다.
  // (30초 주기라 3분 경과 건은 늦어도 3분 30초 안에 정리된다.)
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), 30 * 1000);
  }, 20 * 1000);
}
