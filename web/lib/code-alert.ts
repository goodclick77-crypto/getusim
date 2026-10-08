/**
 * 인증코드 도착 알림음("띵-동"). 브라우저에서만 쓴다.
 *
 * - 소리 파일 없이 Web Audio 로 직접 만든다(미 → 라 두 음, 약 0.5초).
 * - 브라우저는 사용자가 누르기 전에는 소리를 막는다(특히 iOS 사파리). 그래서 "번호 받기"
 *   클릭 같은 사용자 동작 안에서 unlockCodeAlert() 를 먼저 불러 오디오를 깨워 둔다.
 *   이어받기(새로고침 후 대기 재개)처럼 누른 적이 없으면 소리가 안 날 수 있다 — 그건 무시.
 * - 어떤 실패도 화면 흐름을 막지 않도록 전부 try/catch 로 삼킨다.
 */

const MUTE_KEY = "getusim:codeAlertMuted";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  } catch {
    return null;
  }
}

/** 사용자 클릭 안에서 호출해 오디오를 깨워 둔다(await 전에 동기 호출할 것). */
export function unlockCodeAlert() {
  const a = audio();
  if (a && a.state === "suspended") a.resume().catch(() => {});
}

export function isCodeAlertMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setCodeAlertMuted(muted: boolean) {
  try {
    if (muted) localStorage.setItem(MUTE_KEY, "1");
    else localStorage.removeItem(MUTE_KEY);
  } catch {
    /* 저장 못 해도 이번 화면에서는 적용된다 */
  }
}

/** 종소리 한 음: 사인파 + 약한 배음, 빠르게 올라갔다 천천히 사라짐 */
function bell(a: AudioContext, freq: number, start: number, dur: number) {
  const t = a.currentTime + start;
  for (const [mul, g] of [
    [1, 1],
    [2, 0.25],
    [3, 0.08],
  ]) {
    const o = a.createOscillator();
    const v = a.createGain();
    o.type = "sine";
    o.frequency.value = freq * mul;
    v.gain.setValueAtTime(0, t);
    v.gain.linearRampToValueAtTime(0.35 * g, t + 0.01);
    v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(v);
    v.connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

/** "띵-동" 재생. muted 면 아무것도 안 한다. force 는 켜기 버튼의 미리듣기용. */
export function playCodeAlert(force = false) {
  if (!force && isCodeAlertMuted()) return;
  try {
    const a = audio();
    if (!a) return;
    const play = () => {
      bell(a, 659.25, 0, 0.6); // 미
      bell(a, 880, 0.18, 0.8); // 라
    };
    if (a.state === "suspended") a.resume().then(play, () => {});
    else play();
  } catch {
    /* 소리는 부가 기능 — 실패해도 코드 표시는 그대로 */
  }
}
