import Link from "next/link";
import { requireUser } from "@/lib/session";
import { COUNTRIES, SERVICES, SMS_WAIT_MS, chargeAmount, pointToWon } from "@/lib/config";
import { quoteOffer } from "@/lib/catalog";
import { cardPaymentAvailable } from "@/lib/payments";
import BrandIcon from "@/components/BrandIcon";
import OrderForm from "./OrderForm";

export const dynamic = "force-dynamic";

/**
 * 주문 페이지: 상품(서비스 × 국가 인증 1건) 확인 → 결제수단 선택 → 결제하기.
 * 결제창(카드·간편결제) / 등록 카드 원클릭 / 잔액 차감 중 하나로 결제하면 번호가 발급되고
 * SMS 인증 화면으로 넘어간다. 코드 미수신 시 결제는 자동 취소된다.
 */
export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; country?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const service = SERVICES.find((s) => s.value === sp.service);
  const country = COUNTRIES.find((c) => c.value === sp.country);

  if (!service || !country) {
    return (
      <div className="glass rounded-2xl p-6 text-sm">
        <p className="font-semibold">주문할 상품이 지정되지 않았습니다.</p>
        <Link href="/products" className="mt-3 inline-block text-emerald-700 underline">
          상품 목록으로
        </Link>
      </div>
    );
  }

  const quote = await quoteOffer(country.value, service.value);
  const waitMin = Math.round(SMS_WAIT_MS / 60000);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <nav aria-label="경로" className="text-xs text-zinc-400">
        <Link href="/products" className="hover:text-zinc-700">상품</Link>
        <i className="fa-solid fa-chevron-right mx-1.5 text-[9px]" aria-hidden />
        <Link href={`/products/${service.value}`} className="hover:text-zinc-700">{service.label} 인증 1건</Link>
        <i className="fa-solid fa-chevron-right mx-1.5 text-[9px]" aria-hidden />
        <span className="text-zinc-600">주문</span>
      </nav>
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <i className="fa-solid fa-cart-shopping text-emerald-600" aria-hidden /> 주문 / 결제
      </h1>

      {/* 주문 상품 */}
      <section className="glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-zinc-500">주문 상품</h2>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
            <BrandIcon src={`https://cdn.simpleicons.org/${service.slug}`} label={service.label} className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">
              {service.label} 인증 1건
              <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-black/5 px-1.5 py-0.5 text-xs font-medium text-zinc-600">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://flagcdn.com/w40/${country.iso}.png`} alt="" width={16} height={11} className="h-2.5 w-4 rounded-[2px] object-cover" />
                {country.label}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              수량 1 · 번호 발급 후 {waitMin}분 내 코드 미수신 시 자동 취소
            </p>
          </div>
          <p className="font-num text-lg font-bold">
            {quote ? `${pointToWon(quote.price).toLocaleString("ko-KR")}원` : "-"}
          </p>
        </div>
      </section>

      {quote ? (
        <OrderForm
          service={service.value}
          country={country.value}
          productName={`${service.label} / ${country.label} 인증 1건`}
          pricePoint={quote.price}
          amountWon={chargeAmount(quote.price)}
          balancePoint={user.point}
          cardAvailable={cardPaymentAvailable()}
          savedCard={user.billingKey ? user.cardLabel : null}
        />
      ) : (
        <section className="rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-700">
          지금은 이 국가에서 {service.label} 번호를 받을 수 없습니다.{" "}
          <Link href={`/products/${service.value}`} className="underline">다른 국가를 선택</Link>해 주세요.
        </section>
      )}
    </div>
  );
}
