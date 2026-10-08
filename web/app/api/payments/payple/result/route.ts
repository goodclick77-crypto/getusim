/**
 * 페이플 결제창의 PCD_RST_URL. 결제창은 callbackFunction 으로 결과를 넘기므로 여기서는
 * 아무 처리도 하지 않는다(승인은 /api/sms/number 의 confirm 에서). 결제창이 이 주소로
 * 폼 POST 를 보내는 경우(모바일 새 창 등)를 위해 창을 닫는 빈 페이지만 돌려준다.
 */
export async function POST() {
  return new Response(
    "<!doctype html><meta charset=utf-8><title>결제</title><script>window.close()</script>결제 창을 닫아 주세요.",
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
