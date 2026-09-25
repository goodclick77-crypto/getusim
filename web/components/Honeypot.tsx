import { HONEYPOT_FIELD } from "@/lib/honeypot";

// 봇 함정 입력칸. 화면 밖으로 빼서 사람에게는 보이지 않고, 탭 이동·스크린리더에서도 제외한다.
// (display:none 은 일부 봇이 건너뛰므로 쓰지 않는다)
export default function Honeypot() {
  return (
    <div
      aria-hidden
      style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}
    >
      <label>
        홈페이지
        <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}
