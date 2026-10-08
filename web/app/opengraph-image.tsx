import { ImageResponse } from "next/og";

// 카카오톡·문자 등 링크 공유 미리보기에 뜨는 대표 이미지(1200×630).
// 빌드할 때 한 번 그려 두고 /opengraph-image 로 내보낸다. og:image 메타는 Next 가 자동으로 붙인다.
export const alt = "GetUsim — 해외 가상번호로 SMS 인증";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 이미지 그리는 도구는 woff2 를 못 읽어서 woff 를 받는다(사이트와 같은 Pretendard).
const FONT = "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff/Pretendard-";

async function font(weight: string) {
  const res = await fetch(`${FONT}${weight}.woff`);
  return res.arrayBuffer();
}

export default async function Image() {
  const [bold, semi] = await Promise.all([font("ExtraBold"), font("SemiBold")]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 90px",
          fontFamily: "Pretendard",
          color: "#18181b",
          backgroundColor: "#f6f7fb",
          // 사이트 배경과 같은 초록·파랑·보라 번짐
          backgroundImage:
            "radial-gradient(700px 700px at 105% -10%, rgba(16,185,129,0.32), transparent 60%)," +
            "radial-gradient(600px 600px at -10% 10%, rgba(59,130,246,0.26), transparent 60%)," +
            "radial-gradient(600px 500px at 50% 130%, rgba(168,85,247,0.2), transparent 60%)",
        }}
      >
        {/* 왼쪽: 이름 + 한 줄 소개 */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 800, letterSpacing: -3 }}>
            Get<span style={{ color: "#059669" }}>Usim</span>
          </div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 46, fontWeight: 800, letterSpacing: -1 }}>
            해외 가상번호로 SMS 인증
          </div>
          <div style={{ display: "flex", marginTop: 16, fontSize: 30, fontWeight: 600, color: "#52525b" }}>
            코드를 받았을 때만 포인트 차감
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 40,
              alignSelf: "flex-start",
              padding: "12px 26px",
              borderRadius: 999,
              backgroundColor: "#18181b",
              color: "#ffffff",
              fontSize: 26,
              fontWeight: 600,
            }}
          >
            getusim.com
          </div>
        </div>

        {/* 오른쪽: 인증 문자 말풍선 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 380,
            padding: 34,
            borderRadius: 36,
            backgroundColor: "rgba(255,255,255,0.75)",
            border: "2px solid rgba(255,255,255,0.9)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.10)",
          }}
        >
          <div style={{ display: "flex", fontSize: 24, fontWeight: 600, color: "#71717a" }}>
            인증번호 도착
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 14,
              fontSize: 76,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#059669",
            }}
          >
            482913
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 18,
              padding: "14px 18px",
              borderRadius: 18,
              backgroundColor: "#ecfdf5",
              fontSize: 22,
              fontWeight: 600,
              color: "#047857",
            }}
          >
            ✓ 받은 코드만 결제돼요
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Pretendard", data: bold, weight: 800, style: "normal" },
        { name: "Pretendard", data: semi, weight: 600, style: "normal" },
      ],
    },
  );
}
