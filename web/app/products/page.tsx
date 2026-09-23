import type { Metadata } from "next";
import Link from "next/link";
import { SERVICES, wonOf } from "@/lib/config";
import { listServiceSummaries } from "@/lib/catalog";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import BrandIcon from "@/components/BrandIcon";
import Reveal from "@/components/Reveal";

export const metadata: Metadata = { title: "상품 — GetUsim" };
export const dynamic = "force-dynamic";

/**
 * 상품 목록. 판매 단위는 "서비스 인증 1건". 국가는 상세 페이지에서 고른다.
 * 가격은 국가마다 달라 기본가("~부터")만 보여준다.
 */
export default async function ProductsPage() {
  // 서비스별 실시간 최저가·이용 가능 국가 수(60초 캐시)
  const summaries = await listServiceSummaries();
  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader active="products" />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <i className="fa-solid fa-bag-shopping text-emerald-600" aria-hidden /> 상품
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          인증 <b>1건 단위</b>로 판매합니다. 번호 발급은 무료이고, 인증코드가 실제로 도착했을 때만
          결제가 확정됩니다. 코드를 받지 못하면 결제가 자동 취소됩니다.
        </p>

        <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
          <i className="fa-solid fa-arrows-rotate" aria-hidden />
          가격은 국가·환율에 따라 실시간으로 변동됩니다. 표시 금액은 지금 가장 저렴한 국가 기준입니다.
        </p>

        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {SERVICES.map((s, i) => {
            const sum = summaries.get(s.value);
            return (
            <Reveal key={s.value} delay={Math.min(i, 8) * 40}>
              <li className="glass tilt h-full rounded-2xl p-4">
                <Link href={`/products/${s.value}`} className="flex h-full flex-col">
                  <span className="flex items-center gap-2.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                      <BrandIcon src={`https://cdn.simpleicons.org/${s.slug}`} label={s.label} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{s.label}</span>
                      <span className="block text-xs text-zinc-500">인증 1건</span>
                    </span>
                  </span>
                  <span className="mt-4 flex items-end justify-between">
                    <span>
                      {sum === undefined || sum === null ? (
                        <span className="text-sm text-zinc-400">가격 확인 중</span>
                      ) : sum.countries === 0 ? (
                        <span className="text-sm text-zinc-400">지금 이용 가능 국가 없음</span>
                      ) : (
                        <>
                          <span className="font-num text-lg font-bold text-emerald-700">{wonOf(sum.minPrice)}</span>
                          <span className="ml-1 text-xs text-zinc-400">부터</span>
                          <span className="font-num mt-0.5 block text-[11px] text-zinc-400">
                            {sum.countries}개국 이용 가능
                          </span>
                        </>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white">
                      상품 보기 <i className="fa-solid fa-chevron-right text-[10px]" aria-hidden />
                    </span>
                  </span>
                </Link>
              </li>
            </Reveal>
            );
          })}
        </ul>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            ["fa-gift", "번호 발급 무료", "번호를 받는 것만으로는 요금이 없습니다."],
            ["fa-circle-check", "수신 성공 시에만 결제", "인증코드가 도착한 건만 결제가 확정됩니다."],
            ["fa-rotate-left", "미수신 자동 취소", "3분 안에 코드가 없으면 결제가 자동 취소됩니다."],
          ].map(([icon, h, d]) => (
            <div key={h} className="glass rounded-2xl p-4">
              <p className="flex items-center gap-2 font-semibold">
                <i className={`fa-solid ${icon} text-emerald-600`} aria-hidden /> {h}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{d}</p>
            </div>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  );
}
