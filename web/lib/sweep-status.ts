// 스케줄러 하트비트 — 앱 내장 스케줄러(instrumentation.ts)가 실제로 돌고 있는지
// 관리자 화면에서 확인하기 위한 "마지막 실행 시각".
//
// 값은 서버 프로세스 전역(globalThis)에 저장한다. instrumentation과 admin 페이지는
// 같은 Node 프로세스를 공유하므로 전역 변수로 주고받을 수 있다.
// ⚠️ 스케줄러 tick에서만 기록한다(수동 정리/페이지 로드가 아니라). 그래야 "자동 스케줄러가
//    살아있는가"를 정확히 나타낸다 — 값이 오래됐으면 스케줄러가 멈춘 것이다.
const g = globalThis as unknown as { __lastSweepAt?: number };

/** 스케줄러가 한 번 돌 때마다 호출 */
export function markSwept() {
  g.__lastSweepAt = Date.now();
}

/** 마지막 스케줄러 실행 시각(ms). 아직 한 번도 안 돌았으면 null. */
export function lastSweptAt(): number | null {
  return g.__lastSweepAt ?? null;
}
