"use client";

import { useState } from "react";

// 로고를 못 불러왔을 때 대신 보여줄 중립 아이콘(회색 둥근 사각형 + 점 3개).
// 외부 요청 없이 즉시 그려지도록 data URI 로 인라인한다.
const FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
      '<rect width="24" height="24" rx="6" fill="#e4e4e7"/>' +
      '<circle cx="8" cy="12" r="1.6" fill="#a1a1aa"/>' +
      '<circle cx="12" cy="12" r="1.6" fill="#a1a1aa"/>' +
      '<circle cx="16" cy="12" r="1.6" fill="#a1a1aa"/>' +
      "</svg>",
  );

/**
 * 서비스 로고·국기 이미지. 불러오기에 실패하면 중립 아이콘으로 대체한다.
 *
 * 로고는 Simple Icons CDN에서 가져오는데 등록되지 않은 브랜드가 꽤 있다
 * (예: OpenAI·아마존·테무·쉬인 — 공식 slug 목록에 아예 없음).
 * 그대로 두면 목록에 브라우저 기본 "깨진 이미지" 아이콘이 뜨므로 여기서 막는다.
 * 크기·모양 클래스를 그대로 유지하려고 <img> 의 src 만 바꾼다.
 */
export default function BrandIcon({ src, className }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={failed ? FALLBACK : src}
      alt=""
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
