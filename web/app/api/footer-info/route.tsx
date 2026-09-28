import { ImageResponse } from "next/og";

// 하단 사업자 정보·저작권 문구를 PNG로 그려서 내려준다.
// 대표자명·주소·이메일이 HTML 텍스트로 있으면 크롤러가 긁어가 사칭·보이스피싱에 쓰일 수 있어서다.
//   /api/footer-info?part=info → 사업자 정보 4줄,  ?part=copy → 저작권 한 줄

const INFO_LINES = [
  "겟유심 | 대표자 : 엄전혜",
  "사업자등록번호 : 843-08-01310",
  "주소 : 경기도 양주시 고읍남로39번길 48",
  "E-mail : admin@getusim.com",
];
const copyLine = () => `© ${new Date().getFullYear()} GetUsim. All rights reserved.`;

const SCALE = 2; // 레티나 선명도용. <img>에는 CSS px 크기로 표시한다.
const FONT_PX = 12;
const LINE_PX = 20;
// components/Footer.tsx 의 <img> width/height 와 같아야 한다.
const FOOTER_INFO_SIZE = { width: 300, height: LINE_PX * INFO_LINES.length };
const FOOTER_COPY_SIZE = { width: 260, height: LINE_PX };

// 한글이 있어 기본 폰트로는 못 그린다 → Noto Sans KR 을 쓰는 글자만 서브셋으로 받아 메모리에 캐시.
// 받아오지 못하면 503 → 다음 요청에서 다시 시도한다(깨진 글자 이미지를 캐시시키지 않기 위해).
let fontPromise: Promise<ArrayBuffer | null> | null = null;
function loadFont() {
  const chars = [...new Set([...INFO_LINES.join(""), ...copyLine(), ..."0123456789"])].join("");
  fontPromise ??= fetch(
    `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400&text=${encodeURIComponent(chars)}`,
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
    .catch((e) => {
      console.error("[footer-info] font load failed:", e);
      fontPromise = null;
      return null;
    });
  return fontPromise;
}

export async function GET(req: Request) {
  const part = new URL(req.url).searchParams.get("part") === "copy" ? "copy" : "info";
  const font = await loadFont();
  if (!font) return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });

  const size = part === "info" ? FOOTER_INFO_SIZE : FOOTER_COPY_SIZE;
  const lines = part === "info" ? INFO_LINES : [copyLine()];

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          justifyContent: "center",
          fontFamily: "Noto Sans KR",
          fontSize: FONT_PX * SCALE,
          lineHeight: `${LINE_PX * SCALE}px`,
          color: part === "info" ? "#71717a" : "#a1a1aa", // zinc-500 / zinc-400 (기존 문구 색)
        }}
      >
        {lines.map((l) => (
          <div key={l} style={{ display: "flex" }}>
            {l}
          </div>
        ))}
      </div>
    ),
    {
      width: size.width * SCALE,
      height: size.height * SCALE,
      fonts: [{ name: "Noto Sans KR", data: font, weight: 400, style: "normal" }],
      headers: {
        "Cache-Control": "public, max-age=86400",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
