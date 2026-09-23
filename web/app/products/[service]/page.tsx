import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SERVICES, SMS_WAIT_MS, wonOf } from "@/lib/config";
import { listCountryOffers } from "@/lib/catalog";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import BrandIcon from "@/components/BrandIcon";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ service: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { service } = await params;
  const s = SERVICES.find((x) => x.value === service);
  return { title: s ? `${s.label} 인증 1건 — GetUsim` : "상품 — GetUsim" };
}

function rateClass(rate: number) {
  return rate >= 50
    ? "bg-emerald-100 text-emerald-700"
    : rate >= 20
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-600";
}

/**
 * 상품 상세: "서비스 인증 1건". 국가를 고르면 주문 페이지로 간다.
 * 가격·수신률은 공급사 실시간 데이터 + 겟유심 실측.
 */
export default async function ProductDetailPage({ params }: Params) {
  const { service } = await params;
  const s = SERVICES.find((x) => x.value === service);
  if (!s) notFound();

  const offers = await listCountryOffers(service);
  const minPrice = offers.length ? Math.min(...offers.map((o) => o.price)) : null;
  const waitMin = Math.round(SMS_WAIT_MS / 60000);

  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader active="products" />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <nav aria-label="경로" className="text-xs text-zinc-400">
          <Link href="/products" className="hover:text-zinc-700">상품</Link>
          <i className="fa-solid fa-chevron-right mx-1.5 text-[9px]" aria-hidden />
          <span className="text-zinc-600">{s.label} 인증 1건</span>
        </nav>

        {/* 상품 요약 */}
        <section className="glass mt-3 grid gap-5 rounded-3xl p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
            <BrandIcon src={`https://cdn.simpleicons.org/${s.slug}`} label={s.label} className="h-8 w-8" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">{s.label} 인증 1건</h1>
            <p className="mt-1 text-sm text-zinc-500">
              해외 가상번호로 {s.label} 가입·로그인 인증문자 1건을 수신합니다. 국가를 골라 주문하세요.
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
              <li><i className="fa-solid fa-gift mr-1 text-emerald-600" aria-hidden />번호 발급 무료</li>
              <li><i className="fa-solid fa-circle-check mr-1 text-emerald-600" aria-hidden />코드 수신 시에만 결제 확정</li>
              <li><i className="fa-solid fa-rotate-left mr-1 text-emerald-600" aria-hidden />{waitMin}분 미수신 시 자동 취소·무과금</li>
              <li><i className="fa-solid fa-ban mr-1 text-zinc-400" aria-hidden />수신 완료 후 환불 불가 (<Link href="/refund" className="underline">환불규정</Link>)</li>
            </ul>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs text-zinc-400">판매가</p>
            <p className="font-num text-2xl font-bold text-emerald-700">
              {minPrice != null ? wonOf(minPrice) : "-"}
              <span className="ml-1 text-sm font-medium text-zinc-400">부터</span>
            </p>
            <p className="text-[11px] text-zinc-400">국가별 상이 · 부가세 포함</p>
          </div>
        </section>

        {/* 국가(옵션) 선택 */}
        <section className="mt-6">
          <h2 className="flex items-center gap-2 font-bold">
            <i className="fa-solid fa-earth-americas text-emerald-600" aria-hidden /> 국가 선택
            <span className="text-xs font-normal text-zinc-400">· 수신률 높은 순 · 실시간</span>
          </h2>
          {offers.length === 0 ? (
            <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              지금은 이용 가능한 국가가 없습니다. 잠시 후 다시 확인해 주세요.
            </p>
          ) : (
            <div className="glass mt-3 overflow-hidden rounded-2xl">
              <table className="w-full text-sm">
                <thead className="bg-black/[0.03] text-xs text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">국가</th>
                    <th className="px-3 py-2.5 text-left font-medium">예상 수신률</th>
                    <th className="px-3 py-2.5 text-right font-medium">가격</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {offers.map((o) => (
                    <tr key={o.value} className="hover:bg-black/[0.02]">
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`https://flagcdn.com/w40/${o.iso}.png`}
                            alt=""
                            width={20}
                            height={14}
                            className="h-3.5 w-5 rounded-[2px] object-cover shadow-sm"
                          />
                          <span className="font-medium">{o.label}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${rateClass(o.rate)}`}>{o.rate}%</span>
                      </td>
                      <td className="font-num px-3 py-2.5 text-right font-bold">{wonOf(o.price)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Link
                          href={`/order?service=${s.value}&country=${o.value}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                        >
                          <i className="fa-solid fa-cart-shopping" aria-hidden /> 주문하기
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-zinc-400">
            예상 수신률은 공급사 최근 24시간 통계로 참고용이며, 실제 결과와 다를 수 있습니다.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
