"use client";

import { useState } from "react";

// 로고를 못 불러왔을 때 대신 쓸 색상. 무작위가 아니라 이름 해시로 골라
// 같은 서비스는 항상 같은 색이 나오게 한다(새로고침할 때마다 바뀌면 딴 서비스처럼 보인다).
const TINTS = ["#4f46e5", "#0d9488", "#b45309", "#be123c", "#7c3aed", "#0369a1"];

function tintOf(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

/**
 * 이름 첫 글자를 그린 대체 아이콘(SVG data URI).
 *
 * <img> 의 src 만 바꾸는 방식이라 호출부의 크기·모양 클래스가 그대로 먹는다.
 * SVG 안의 글자는 문서 폰트를 못 쓰고 시스템 폰트로만 그려지므로, 한글이 깨지지 않도록
 * 윈도우(맑은 고딕)·맥/iOS(Apple SD Gothic Neo)를 명시하고 sans-serif 로 마무리한다.
 */
function letterIcon(label: string): string {
  const ch = (label.trim()[0] || "?").toUpperCase();
  const bg = tintOf(label);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
    `<rect width="24" height="24" rx="6" fill="${bg}"/>` +
    '<text x="12" y="12.5" text-anchor="middle" dominant-baseline="central" ' +
    'font-family="Apple SD Gothic Neo,Malgun Gothic,sans-serif" ' +
    `font-size="13" font-weight="700" fill="#ffffff">${ch}</text>` +
    "</svg>";
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

/**
 * 서비스 로고·국기 이미지. 불러오기에 실패하면 이름 첫 글자 아이콘으로 대체한다.
 *
 * 로고는 Simple Icons CDN에서 가져오는데 등록되지 않은 브랜드가 있다
 * (ChatGPT·아마존·테무·쉬인 — 공식 slug 목록에 아예 없어 404). 5sim 스프라이트에도
 * 테무·쉬인은 없어서, 어느 출처를 쓰든 대체 아이콘은 필요하다.
 * label 을 주면 첫 글자로, 없으면 이름 없는 회색 상자로 그린다.
 */
export default function BrandIcon({
  src,
  label,
  className,
}: {
  src: string;
  label?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={failed ? letterIcon(label || "?") : src}
      alt=""
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
