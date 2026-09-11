import { ImageResponse } from "next/og";
import { getCurrentUser } from "@/lib/session";
import { BANK_INFO, BANK_IMG_FONT, BANK_IMG_SCALE, bankImageSize } from "@/lib/deposit-account";

// 무통장입금 계좌번호를 PNG로 그려서 내려준다(로그인 사용자 전용).
// 계좌번호가 HTML 텍스트로 노출되면 크롤러가 긁어가 보이스피싱에 악용될 수 있어서다.

// 사이트 숫자 폰트(Montserrat)와 맞춘다. 숫자·하이픈만 서브셋으로 받아오며,
// 계좌번호 자체가 외부 URL에 실리지 않도록 고정 문자셋을 쓴다.
// 받아오지 못하면 next/og 기본 폰트로 그리고, 다음 요청에서 다시 시도한다.
let fontPromise: Promise<ArrayBuffer | null> | null = null;
function loadMontserrat() {
  fontPromise ??= fetch(
    `https://fonts.googleapis.com/css2?family=Montserrat:wght@700&text=${encodeURIComponent("0123456789-")}`,
  )
    .then((r) => r.text())
    .then((css) => {
      const m = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/);
      if (!m) throw new Error("font url not found");
      return fetch(m[1]).then((r) => {
        if (!r.ok) throw new Error(`font ${r.status}`);
        return r.arrayBuffer();
      });
    })
    .catch(() => {
      fontPromise = null;
      return null;
    });
  return fontPromise;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });

  const account = BANK_INFO.account;
  const { width, height } = bankImageSize(account);
  const font = await loadMontserrat();

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "flex-end",
          fontSize: BANK_IMG_FONT * BANK_IMG_SCALE,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "#18181b", // zinc-900
          // fontFamily: undefined 를 넘기면 satori 가 죽는다 → 폰트가 있을 때만 키를 넣는다.
          ...(font ? { fontFamily: "Montserrat" } : {}),
        }}
      >
        {account}
      </div>
    ),
    {
      width: width * BANK_IMG_SCALE,
      height: height * BANK_IMG_SCALE,
      fonts: font ? [{ name: "Montserrat", data: font, weight: 700, style: "normal" }] : undefined,
      headers: {
        "Cache-Control": "private, max-age=600",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
