"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { COUNTRIES, SERVICES, SMS_BASE_POINT, chargeAmount, wonOf } from "@/lib/config";
import { phoneFmt } from "@/lib/format";
import ImageSelect from "@/components/ImageSelect";
import CopyButton from "@/components/CopyButton";
import BrandIcon from "@/components/BrandIcon";

type Props = {
  initialPoint: number;
  /** 등록된 결제 카드(빌링키). 없으면 null. */
  card: { label: string } | null;
  /** 결제사가 설정돼 카드 결제를 쓸 수 있는지(운영은 PG 승인 전까지 false). */
  cardAvailable: boolean;
};
type PayMethod = "POINT" | "CARD";
/** 겟유심 자체 발급 이력으로 계산한 실측 성공률(최근 N일). 표본 부족이면 null. */
type Ours = { rate: number; n: number } | null;
type Svc = {
  value: string;
  label: string;
  slug: string;
  price?: number;
  rate?: number;
  ours?: Ours;
};
type Cnt = {
  value: string;
  label: string;
  iso: string;
  price?: number;
  rate?: number;
  ours?: Ours;
};
type Recent = { value: string; label: string; iso: string };

// 인증문자는 보통 1~2분 내 도착 → 그 안에 안 오면 사실상 안 옴.
// 최대 3분만 기다리다 자동 포기하고 5sim 번호를 취소(잔액 즉시 반환)한다.
const SMS_WAIT_MS = 3 * 60 * 1000;

function rateColor(rate: number) {
  return rate >= 50
    ? "bg-emerald-100 text-emerald-700"
    : rate >= 20
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-600";
}

/**
 * 국가 목록 위에 띄우는 참고용 한 줄. 클릭하면 그 국가가 선택된다.
 * 최근 72시간 내 **실제로 코드를 받은** 국가만 최신순으로 보여준다(우리 DB의 RECEIVED 기록).
 *
 * ★ 예전에는 성공 이력이 없으면 수신률 상위 국가로 대체했는데(폴백) 그건 없앴다.
 *   목록이 이미 수신률 내림차순이라 바로 아래 1·2등을 그대로 복사하는 중복이었고,
 *   5sim 수신률은 못 사는 국가가 1등으로 올라오는 일이 있어(리투아니아 58%, 구매 불가)
 *   근거 없는 항목에 "추천" 이름표를 달아 회원이 더 확신을 갖고 누르게 만들었다.
 *   이제 이 줄이 뜬다는 건 실제 성공 실적이 있다는 뜻이다.
 */
function ReferenceRow({
  loading,
  recent,
  selected,
  onPick,
}: {
  loading: boolean;
  recent: Recent[];
  selected: string;
  onPick: (v: string) => void;
}) {
  // 실적이 없으면 아무것도 안 뜨는 게 정상이라, 로딩 중에도 자리를 잡지 않는다
  // (스켈레톤을 띄웠다가 사라지면 대부분의 경우 화면이 튄다).
  if (loading) return null;

  const items = recent;
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
      <p className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-zinc-600">
        <i className="fa-solid fa-thumbs-up text-emerald-600" aria-hidden />
        추천 국가
        <span className="font-normal text-zinc-400">· 참고용</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => {
          const sel = selected === it.value;
          return (
            <button
              key={it.value}
              type="button"
              onClick={() => onPick(it.value)}
              aria-pressed={sel}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition ${
                sel
                  ? "border-emerald-500 bg-white font-bold"
                  : "border-black/10 bg-white/80 hover:border-emerald-300"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://flagcdn.com/w40/${it.iso}.png`}
                alt=""
                className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover shadow-sm"
                loading="lazy"
              />
              <span className="font-medium">{it.label}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-zinc-400">
        최근 실제로 인증코드가 도착한 국가예요. 결과는 그때그때 달라질 수 있습니다.
      </p>
    </div>
  );
}

type Row = {
  value: string;
  label: string;
  img: string;
  rate: number;
  price: number;
  ours?: Ours;
};

/** 실측 표본이 이만큼 쌓였는데 성공이 0건이면 "안 되는 조합"으로 보고 흐리게 표시한다. */
const OURS_DEAD_SAMPLE = 5;
function isDead(o: Ours | undefined) {
  return !!o && o.n >= OURS_DEAD_SAMPLE && o.rate === 0;
}

function CompareTable({
  colLabel,
  loading,
  selected,
  onPick,
  imgClass,
  rows,
  favValues,
  onToggleFav,
}: {
  colLabel: string;
  loading: boolean;
  selected: string;
  onPick: (v: string) => void;
  imgClass: string;
  rows: Row[];
  favValues: Set<string>;
  onToggleFav: (value: string) => void;
}) {
  // 즐겨찾기한 항목을 위로 (그 안에서는 기존 수신률 순서 유지)
  const sorted = [...rows].sort(
    (a, b) => (favValues.has(b.value) ? 1 : 0) - (favValues.has(a.value) ? 1 : 0),
  );

  const listRef = useRef<HTMLUListElement>(null);
  const selectedRef = useRef<HTMLLIElement>(null);

  // 추천 칩으로 선택하면 목록에서는 화면 밖에 있을 수 있다 → 목록을 그 항목까지 스크롤.
  // scrollIntoView는 조상까지 스크롤해 페이지가 튀므로, 목록 컨테이너만 직접 움직인다.
  useEffect(() => {
    const list = listRef.current;
    const item = selectedRef.current;
    if (!list || !item) return;
    const lr = list.getBoundingClientRect();
    const ir = item.getBoundingClientRect();
    if (ir.top < lr.top || ir.bottom > lr.bottom) {
      list.scrollTo({ top: list.scrollTop + (ir.top - lr.top), behavior: "smooth" });
    }
  }, [selected, rows]);

  return (
    <div>
      <p className="mb-1.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-700">
        <i className="fa-solid fa-list-check text-emerald-600" aria-hidden /> {colLabel} 선택
        <span className="text-xs font-normal text-zinc-400">· 참고용 추정치 · 수신률 높은 순</span>
      </p>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-11 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          현재 이용 가능한 {colLabel}가 없습니다. 다른 선택을 시도해보세요.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-black/10">
          <ul ref={listRef} className="max-h-80 divide-y divide-black/5 overflow-auto">
            {sorted.map((r) => {
              const sel = selected === r.value;
              const fav = favValues.has(r.value);
              const dead = isDead(r.ours);
              return (
                <li
                  key={r.value}
                  ref={sel ? selectedRef : undefined}
                  className={`flex items-stretch ${sel ? "bg-emerald-50" : ""} ${
                    dead && !sel ? "opacity-55" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggleFav(r.value)}
                    aria-label={fav ? "즐겨찾기 해제" : "즐겨찾기"}
                    aria-pressed={fav}
                    className="shrink-0 px-3 transition hover:bg-black/[0.03]"
                  >
                    <i
                      className={`fa-${fav ? "solid" : "regular"} fa-star ${
                        fav ? "text-amber-400" : "text-zinc-300"
                      }`}
                      aria-hidden
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => onPick(r.value)}
                    className={`min-w-0 flex-1 py-2.5 pr-3 text-left transition ${
                      sel ? "" : "hover:bg-black/[0.02]"
                    }`}
                  >
                    {/* 1줄: 이름 + 가격 */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <BrandIcon src={r.img} label={r.label} className={`${imgClass} shrink-0`} />
                        <span className={`truncate text-sm ${sel ? "font-bold" : "font-medium"}`}>
                          {r.label}
                        </span>
                        {sel && <i className="fa-solid fa-check shrink-0 text-emerald-600" aria-hidden />}
                      </span>
                      <span className="font-num shrink-0 text-base font-bold">
                        {wonOf(r.price)}
                      </span>
                    </div>
                    {/* 2줄: 수신률 — 재고는 표시하지 않는다.
                        5sim이 주는 재고(count)가 실제 구매 가능 여부와 맞지 않기 때문이다.
                        재고 36,600개로 표시된 조합을 연속 3회 사봤지만 전부 "번호 없음"이었다.
                        틀린 숫자를 보여주면 회원 신뢰만 깎이므로 뺀다(필터로는 계속 쓴다). */}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className={`rounded px-1.5 py-0.5 font-semibold ${rateColor(r.rate)}`}>
                        예상 수신률 {r.rate}%
                      </span>
                      {/* 겟유심 실측: 우리 회원이 최근 실제로 받은 비율. 5sim 통계보다 한국 사용 패턴에 가깝다.
                          표본이 적으면(서버 기준 3건 미만) 내려오지 않으므로 표시하지 않는다. */}
                      {r.ours &&
                        (dead ? (
                          <span className="rounded bg-zinc-200 px-1.5 py-0.5 font-semibold text-zinc-500">
                            <i className="fa-solid fa-ban mr-1" aria-hidden />
                            최근 성공 사례 없음 ({r.ours.n}건)
                          </span>
                        ) : (
                          <span
                            className={`rounded px-1.5 py-0.5 font-semibold ring-1 ring-inset ring-current/20 ${rateColor(r.ours.rate)}`}
                            title="겟유심 회원의 최근 실제 발급 결과로 계산한 성공률"
                          >
                            <i className="fa-solid fa-circle-check mr-1" aria-hidden />
                            실측 {r.ours.rate}% ({r.ours.n}건)
                          </span>
                        ))}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {!loading && rows.length > 0 && (
        <p className="mt-1.5 text-xs text-zinc-400">
          <i className="fa-solid fa-circle-info mr-1" aria-hidden />
          예상 수신률은 공급사의 최근 24시간 통계, 실측은 겟유심 회원의 최근 실제 발급 결과예요.
          둘 다 참고용이며 실제 결과와 다를 수 있어요.
        </p>
      )}
    </div>
  );
}

export default function NumberAuth({ initialPoint, card, cardAvailable }: Props) {
  const [point, setPoint] = useState(initialPoint);
  const [cardLabel, setCardLabel] = useState<string | null>(card?.label ?? null);
  const [cardBusy, setCardBusy] = useState(false);
  /** 회원이 고른 결제수단. "auto"면 포인트가 충분할 때 포인트, 아니면 카드. */
  const [payPick, setPayPick] = useState<"auto" | PayMethod>("auto");
  /** 현재 발급건의 결제 정보(결과 패널 표시용) */
  const [paid, setPaid] = useState<{ method: PayMethod; amount: number } | null>(null);
  const [country, setCountry] = useState("");
  const [service, setService] = useState("");

  const [rentalId, setRentalId] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [remain, setRemain] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [needCharge, setNeedCharge] = useState(false);
  const [mode, setMode] = useState<"country" | "service">("country");
  const [services, setServices] = useState<Svc[]>([]);
  const [countries, setCountries] = useState<Cnt[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [favs, setFavs] = useState<Set<string>>(new Set()); // `${kind}:${value}`
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const pollGenRef = useRef(0); // 폴링 세대 토큰(동시 폴링 방지)
  // 비동기 폴링 루프 안에서 최신 결제 정보를 읽기 위한 ref(렌더 중 접근 금지 규칙 때문에 effect 로 동기화)
  const paidRef = useRef<{ method: PayMethod; amount: number } | null>(null);
  useEffect(() => {
    paidRef.current = paid;
  }, [paid]);

  // 즐겨찾기 로드 (회원별)
  useEffect(() => {
    let alive = true;
    fetch("/api/sms/favorite")
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const arr: { kind: string; value: string }[] = j.favorites || [];
        setFavs(new Set(arr.map((f) => `${f.kind}:${f.value}`)));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  function toggleFav(kind: "country" | "service", value: string) {
    const key = `${kind}:${value}`;
    const on = !favs.has(key);
    setFavs((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
    fetch("/api/sms/favorite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, value, on }),
    }).catch(() => {});
  }

  function favValues(kind: "country" | "service") {
    const prefix = `${kind}:`;
    const out = new Set<string>();
    for (const k of favs) if (k.startsWith(prefix)) out.add(k.slice(prefix.length));
    return out;
  }

  // 진행 중(수신대기) 번호 이어받기 — 다른 메뉴 갔다 와도 받은 번호/코드 유지
  useEffect(() => {
    let alive = true;
    fetch("/api/sms/active")
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j.rental) return;
        const r = j.rental;
        // 이어받은 발급건은 국가가 이미 확정돼 있다 → 스마트(자동선택) 화면이면 표시가 어긋나므로
        // 국가 모드로 돌려 실제 발급된 국가·서비스가 그대로 보이게 한다.
        setMode("country");
        setCountry(r.country);
        setService(r.service);
        setRentalId(r.id);
        setPhone(r.phoneNumber || "");
        const raw = r.expiresAt ? new Date(r.expiresAt).getTime() : Infinity;
        const deadline = Math.min(raw, Date.now() + SMS_WAIT_MS);
        setExpiresAt(deadline);
        const isCard = r.payMethod === "CARD";
        setPaid(
          isCard
            ? { method: "CARD", amount: r.payAmount ?? 0 }
            : { method: "POINT", amount: r.pricePoint ?? SMS_BASE_POINT },
        );
        if (r.smsCode) {
          setCode(r.smsCode);
          setStatus("인증코드 수신 완료");
        } else if (deadline - Date.now() > 0) {
          // 폴링 재개 (남은 시간 있으면). 카드 건은 포인트를 깎지 않는다.
          pollCode(r.id, isCard ? 0 : (r.pricePoint ?? SMS_BASE_POINT), deadline);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 국가 모드: 국가 선택 → 서비스 목록
  useEffect(() => {
    if (mode !== "country" || !country) {
      setServices([]);
      return;
    }
    let alive = true;
    setListLoading(true);
    setServices([]);
    fetch(`/api/sms/services?country=${country}`)
      .then((r) => r.json())
      .then((j) => alive && setServices(j.services || []))
      .catch(() => alive && setServices([]))
      .finally(() => alive && setListLoading(false));
    return () => {
      alive = false;
    };
  }, [mode, country]);

  // 서비스 모드: 서비스 선택 → 잘 받아지는 국가 목록 + 최근 성공 국가(참고용)
  useEffect(() => {
    if (mode !== "service" || !service) {
      setCountries([]);
      setRecent([]);
      return;
    }
    let alive = true;
    setListLoading(true);
    setCountries([]);
    setRecent([]);
    fetch(`/api/sms/recent?service=${service}`)
      .then((r) => r.json())
      .then((j) => alive && setRecent(j.countries || []))
      .catch(() => {}); // 참고 정보 — 실패해도 국가 목록은 그대로 뜬다
    fetch(`/api/sms/countries?service=${service}`)
      .then((r) => r.json())
      .then((j) => alive && setCountries(j.countries || []))
      .catch(() => alive && setCountries([]))
      .finally(() => alive && setListLoading(false));
    return () => {
      alive = false;
    };
  }, [mode, service]);

  // 화면에 표시 중인 가격의 출처. 발급 요청 때 상한(maxPoint)으로 함께 보내
  // 회원이 본 금액보다 비싸게 사지 않도록 한다.
  const selected: { price?: number } | undefined =
    mode === "country"
      ? services.find((s) => s.value === service)
      : countries.find((c) => c.value === country);

  // 카운트다운 (표시 전용 — 중단은 pollCode가 처리)
  useEffect(() => {
    if (expiresAt == null) {
      setRemain(null);
      return;
    }
    const tick = () => {
      const left = Math.ceil((expiresAt - Date.now()) / 1000);
      setRemain(left > 0 ? left : 0);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  // ---- 결제수단 결정 ----
  // 표시 가격(포인트)과 그 카드 결제 환산액. 카드 금액은 충전 수수료율을 그대로 적용해 두 경로가 같은 값이다.
  const need = Math.max(selected?.price ?? SMS_BASE_POINT, SMS_BASE_POINT);
  const needWon = chargeAmount(need);
  const pointEnough = point >= need;
  const canCard = cardAvailable && !!cardLabel;
  const payMethod: PayMethod = payPick === "auto" ? (pointEnough ? "POINT" : "CARD") : payPick;
  /** 지금 상태로 결제가 가능한가(버튼 활성 조건) */
  const payReady = payMethod === "POINT" ? pointEnough : canCard;

  async function registerCard() {
    if (cardBusy) return;
    setCardBusy(true);
    setStatus("");
    try {
      // 실제 PG(토스 등)는 카드등록 창을 띄워 authKey 를 받아 넘긴다. mock 결제사는 즉시 발급.
      const res = await fetch("/api/payments/billing-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authPayload: {} }),
      });
      const j = await res.json();
      if (j.ok && j.card?.label) {
        setCardLabel(j.card.label);
        setStatus(`카드가 등록되었습니다 (${j.card.label})`);
      } else {
        setStatus(j.error || "카드 등록에 실패했습니다");
      }
    } catch {
      setStatus("카드 등록에 실패했습니다");
    } finally {
      setCardBusy(false);
    }
  }

  async function removeCard() {
    if (cardBusy) return;
    setCardBusy(true);
    try {
      await fetch("/api/payments/billing-key", { method: "DELETE" });
      setCardLabel(null);
      setPayPick("auto");
    } catch {}
    setCardBusy(false);
  }

  async function getNumber() {
    if (running) return;
    pollGenRef.current++; // 진행 중 폴링(이어받기 등) 취소
    setCode("");
    setPhone("");
    setRemain(null);
    setExpiresAt(null);
    setStatus("");
    setNeedCharge(false);
    setPaid(null);
    if (!country || !service) {
      setStatus("국가와 서비스를 선택하세요");
      return;
    }
    // 결제 가능 여부를 먼저 확인 — 포인트가 모자라고 카드도 없으면 요청 자체를 하지 않는다.
    if (payMethod === "POINT" && !pointEnough) {
      setStatus(
        `잔액이 부족합니다 (${wonOf(need)} 필요, 보유 ${wonOf(point)})`,
      );
      setNeedCharge(true);
      return;
    }
    if (payMethod === "CARD" && !canCard) {
      setStatus(cardAvailable ? "먼저 결제할 카드를 등록해 주세요" : "카드 결제가 아직 준비되지 않았습니다");
      if (!cardAvailable) setNeedCharge(true);
      return;
    }

    setStatus(payMethod === "CARD" ? "번호 요청 중… (번호가 잡히면 결제됩니다)" : "번호 요청 중…");
    setRunning(true);

    let data: {
      rentalId?: number;
      phone?: string;
      expires?: string;
      error?: string;
      message?: string;
      pricePoint?: number;
      payMethod?: PayMethod;
      payAmount?: number;
    };
    try {
      const res = await fetch("/api/sms/number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // maxPoint = 지금 화면에 떠 있는 차감예정 금액. 조회~발급 사이 5sim 가격이 올라도
        // 이 금액을 넘으면 서버가 사지 않고 취소한다(스마트·수동 모드 공통).
        body: JSON.stringify({
          country,
          service,
          maxPoint: selected?.price,
          pay: payMethod === "CARD" ? "card" : "point",
        }),
      });
      data = await res.json();
    } catch {
      setStatus("일시적인 문제로 발급이 불가능합니다. 다른 국가·서비스를 이용해주세요.");
      setRunning(false);
      return;
    }

    if (data.error || !data.rentalId) {
      if (data.error === "need") setNeedCharge(true);
      setStatus(
        data.error === "00"
          ? "현재 이용 가능한 번호가 없습니다. 목록을 새로 불러왔어요."
          : data.error === "need"
            ? data.message || "잔액이 부족합니다"
            : data.message || data.error || "번호 발급 실패",
      );
      setRunning(false);

      // "번호 없음"이면 방금 실패한 조합이 서버 제외목록에 올라갔다 → 목록을 다시 불러오면
      // 그 항목이 사라진다. 대신 고르는 건 회원 몫이다(국가마다 가격이 달라 임의로 바꾸면 안 된다).
      if (data.error === "00") {
        setListLoading(true);
        try {
          if (mode === "service" && service) {
            const j = await (await fetch(`/api/sms/countries?service=${service}`)).json();
            setCountries(j.countries || []);
            setCountry("");
          } else if (mode === "country" && country) {
            const j = await (await fetch(`/api/sms/services?country=${country}`)).json();
            setServices(j.services || []);
            setService("");
          }
        } catch {
          /* 재조회 실패는 위에서 세운 안내 문구를 그대로 둔다 */
        }
        setListLoading(false);
      }
      return;
    }

    const isCard = data.payMethod === "CARD";
    // 카드 건은 이미 결제됐으므로 코드 수신 시 포인트를 깎지 않는다(charged=0).
    const charged = isCard ? 0 : (data.pricePoint ?? SMS_BASE_POINT);
    setPaid(
      isCard
        ? { method: "CARD", amount: data.payAmount ?? needWon }
        : { method: "POINT", amount: data.pricePoint ?? SMS_BASE_POINT },
    );
    // 5sim 만료와 3분 중 먼저 오는 쪽까지만 대기(카운트다운도 이 값 기준).
    const raw = data.expires ? new Date(data.expires).getTime() : Date.now() + 15 * 60 * 1000;
    const deadline = Math.min(raw, Date.now() + SMS_WAIT_MS);

    setRentalId(data.rentalId);
    setPhone(data.phone || "");
    setExpiresAt(deadline);

    await pollCode(data.rentalId, charged, deadline);
  }

  // 코드 수신 폴링 (발급 직후 / 이어받기 공용). 세대 토큰으로 동시 폴링 방지.
  async function pollCode(id: number, charged: number, deadline: number | null) {
    const myGen = ++pollGenRef.current;
    setRunning(true);
    setStatus("SMS 코드 수신 대기 중…");
    // 3분(또는 5sim 만료) 상한. 만료 정보 없거나 잘못돼도 무한루프 방지.
    const hardStop = Math.min(deadline ?? Infinity, Date.now() + SMS_WAIT_MS);
    while (pollGenRef.current === myGen) {
      await new Promise((r) => setTimeout(r, 2500));
      if (pollGenRef.current !== myGen) return; // 다른 폴링/취소로 무효화됨
      if (Date.now() >= hardStop) {
        // 3분 경과 → 폴링 종료 + 5sim 번호 자동 밴(잔액 반환).
        // 단, 밴 직전 코드가 도착했을 수 있어 서버가 정산 후 received로 알려주면 코드를 보여준다.
        pollGenRef.current++;
        try {
          const res = await fetch("/api/sms/ban", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rentalId: id }),
          });
          const j = await res.json();
          if (j.received && j.code) {
            setCode(j.code);
            setStatus("인증코드 수신 완료");
            if (typeof j.balanceAfter === "number") setPoint(Math.max(0, j.balanceAfter));
            else setPoint((p) => Math.max(0, p - charged));
            setRunning(false);
            return;
          }
        } catch {
          /* 밴 요청 실패는 무시 — 서버 스케줄러가 정리한다 */
        }
        setStatus(
          paidRef.current?.method === "CARD"
            ? "문자가 오지 않아 번호를 자동 취소했어요. 카드 결제도 자동 취소되어 요금이 청구되지 않습니다."
            : "문자가 오지 않아 번호를 자동 취소했어요. 다른 국가·서비스로 다시 받아주세요.",
        );
        setRunning(false);
        setPhone("");
        setExpiresAt(null);
        setRemain(null);
        setPaid(null);
        return;
      }
      try {
        const res = await fetch(`/api/sms/code?rentalId=${id}`);
        const j = await res.json();
        if (pollGenRef.current !== myGen) return;
        if (j.code) {
          setCode(j.code);
          setStatus("인증코드 수신 완료");
          if (typeof j.balanceAfter === "number") setPoint(Math.max(0, j.balanceAfter));
          else setPoint((p) => Math.max(0, p - charged));
          setRunning(false);
          pollGenRef.current++; // 이 폴링 종료
          return;
        }
      } catch {
        /* 폴링 실패는 무시하고 재시도 */
      }
    }
  }

  async function ban() {
    if (!rentalId) return;
    pollGenRef.current++; // 폴링 중단
    setRunning(false);
    setExpiresAt(null);
    // 밴 직전 코드가 도착했으면 서버가 정산 후 received로 알려준다 → 코드 표시(차감 반영).
    try {
      const res = await fetch("/api/sms/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rentalId }),
      });
      const j = await res.json();
      if (j.received && j.code) {
        setCode(j.code);
        setStatus("인증코드 수신 완료");
        if (typeof j.balanceAfter === "number") setPoint(Math.max(0, j.balanceAfter));
        setRemain(null);
        return;
      }
    } catch {}
    setStatus(
      paidRef.current?.method === "CARD"
        ? "번호를 밴 처리했고 카드 결제는 자동 취소되었습니다. 다시 번호를 받아주세요."
        : "번호를 밴 처리했습니다. 다시 번호를 받아주세요.",
    );
    setPhone("");
    setRemain(null);
    setPaid(null);
  }

  return (
    <div className="space-y-5">
      <div className="glass-dark rounded-2xl p-5 text-white">
        <p className="flex items-center gap-2 text-sm text-zinc-400">
          <i className="fa-solid fa-wallet text-emerald-400" aria-hidden /> 보유 잔액
        </p>
        <p className="font-num mt-1 text-2xl font-bold">{wonOf(point)}</p>
        <p className="mt-1 text-xs text-zinc-400">
          인증코드 수신 성공 시 차감 (번호 발급은 무료) · 서비스별 가격 상이, 1건{" "}
          {wonOf(SMS_BASE_POINT)}부터
        </p>
        {cardAvailable && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-sm">
            <span className="flex items-center gap-2 text-zinc-300">
              <i className="fa-regular fa-credit-card text-emerald-400" aria-hidden />
              {cardLabel ? (
                <>
                  결제 카드 <b className="font-num text-white">{cardLabel}</b>
                </>
              ) : (
                "결제 카드 없음 · 등록하면 충전 없이 건별 결제할 수 있어요"
              )}
            </span>
            {cardLabel ? (
              <button
                type="button"
                onClick={removeCard}
                disabled={cardBusy}
                className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/10 disabled:opacity-50"
              >
                카드 해제
              </button>
            ) : (
              <button
                type="button"
                onClick={registerCard}
                disabled={cardBusy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
              >
                <i className={`fa-solid ${cardBusy ? "fa-spinner fa-spin" : "fa-plus"}`} aria-hidden />
                카드 등록
              </button>
            )}
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="space-y-4">
          {/* 검색 모드 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("country")}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
                mode === "country"
                  ? "bg-zinc-900 text-white"
                  : "bg-black/5 text-zinc-600 hover:bg-black/10"
              }`}
            >
              <i className="fa-solid fa-flag mr-1.5" aria-hidden /> 국가로 찾기
            </button>
            <button
              type="button"
              onClick={() => setMode("service")}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
                mode === "service"
                  ? "bg-zinc-900 text-white"
                  : "bg-black/5 text-zinc-600 hover:bg-black/10"
              }`}
            >
              <i className="fa-solid fa-grip mr-1.5" aria-hidden /> 서비스로 찾기
            </button>
          </div>

          {mode === "country" && (
            <div>
              <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-zinc-700">
                <i className="fa-solid fa-flag text-emerald-600" aria-hidden /> 국가
              </p>
              <ImageSelect
                placeholder="국가 선택"
                value={country}
                onChange={(v) => {
                  setCountry(v);
                  setService("");
                }}
                imgClass="h-[18px] w-6 rounded-sm object-cover shadow-sm"
                options={COUNTRIES.map((c) => ({
                  value: c.value,
                  label: c.label,
                  img: `https://flagcdn.com/w40/${c.iso}.png`,
                }))}
              />
            </div>
          )}

          {mode === "service" && (
            <div>
              <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-zinc-700">
                <i className="fa-solid fa-grip text-emerald-600" aria-hidden /> 서비스
              </p>
              <ImageSelect
                placeholder="서비스 선택"
                value={service}
                onChange={(v) => {
                  setService(v);
                  setCountry("");
                }}
                imgClass="h-5 w-5 object-contain"
                options={SERVICES.map((s) => ({
                  value: s.value,
                  label: s.label,
                  img: `https://cdn.simpleicons.org/${s.slug}`,
                }))}
              />
            </div>
          )}

          {/* 국가모드: 서비스 비교표 */}
          {mode === "country" && country && (
            <CompareTable
              colLabel="서비스"
              loading={listLoading}
              selected={service}
              onPick={setService}
              imgClass="h-4 w-4"
              favValues={favValues("service")}
              onToggleFav={(v) => toggleFav("service", v)}
              rows={services.map((s) => ({
                value: s.value,
                label: s.label,
                img: `https://cdn.simpleicons.org/${s.slug}`,
                rate: s.rate ?? 0,
                price: s.price ?? 0,
                ours: s.ours,
              }))}
            />
          )}

          {/* 서비스모드: 최근 성공 국가(참고용) */}
          {mode === "service" && service && (
            <ReferenceRow
              loading={listLoading}
              // 추천은 과거 수신 성공 이력이라 현재 재고를 모른다. 지금 발급 가능한 국가(countries)에
              // 없는 건 빼야 한다 — 안 그러면 추천엔 있는데 아래 목록엔 없는 국가를 눌러 헛걸음한다.
              recent={recent.filter((r) => countries.some((c) => c.value === r.value))}
              selected={country}
              onPick={setCountry}
            />
          )}

          {/* 서비스모드: 국가 비교표 */}
          {mode === "service" && service && (
            <CompareTable
              colLabel="국가"
              loading={listLoading}
              selected={country}
              onPick={setCountry}
              imgClass="h-3.5 w-5 rounded-[2px] object-cover shadow-sm"
              favValues={favValues("country")}
              onToggleFav={(v) => toggleFav("country", v)}
              rows={countries.map((c) => ({
                value: c.value,
                label: c.label,
                img: `https://flagcdn.com/w40/${c.iso}.png`,
                rate: c.rate ?? 0,
                price: c.price ?? 0,
                ours: c.ours,
              }))}
            />
          )}

          {/* 상품 요약 + 결제 — 국가·서비스가 정해지면 "무엇을 얼마에 사는지"를 한 칸으로 보여준다 */}
          {country && service && !running && !phone && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">상품</p>
                  <p className="mt-0.5 truncate font-bold">
                    {SERVICES.find((s) => s.value === service)?.label ?? service} ·{" "}
                    {COUNTRIES.find((c) => c.value === country)?.label ?? country} 인증 1건
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    번호 발급 후 {Math.round(SMS_WAIT_MS / 60000)}분 안에 코드가 안 오면 자동 취소 · 요금 없음
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-num text-xl font-bold text-emerald-700">
                    {needWon.toLocaleString("ko-KR")}원
                  </p>
                  <p className="font-num text-[11px] text-zinc-400">
                    {payMethod === "CARD" ? "카드로 결제" : "잔액에서 차감"}
                  </p>
                </div>
              </div>

              {/* 결제수단 — 카드 결제가 가능한 환경에서만 고르게 한다 */}
              {cardAvailable && (
                <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="결제수단">
                  {(
                    [
                      {
                        v: "POINT",
                        label: "잔액",
                        sub: pointEnough ? `보유 ${wonOf(point)}` : "잔액 부족",
                        ok: pointEnough,
                        icon: "fa-coins",
                      },
                      {
                        v: "CARD",
                        label: "카드 결제",
                        sub: cardLabel ?? "카드 등록 필요",
                        ok: canCard,
                        icon: "fa-credit-card",
                      },
                    ] as { v: PayMethod; label: string; sub: string; ok: boolean; icon: string }[]
                  ).map((o) => {
                    const on = payMethod === o.v;
                    return (
                      <button
                        key={o.v}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setPayPick(o.v)}
                        className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                          on ? "border-emerald-500 bg-white shadow-sm" : "border-black/10 bg-white/50 hover:bg-white"
                        } ${o.ok ? "" : "opacity-60"}`}
                      >
                        <span className="flex items-center gap-1.5 font-semibold">
                          <i
                            className={`fa-solid ${o.icon} ${on ? "text-emerald-600" : "text-zinc-400"}`}
                            aria-hidden
                          />
                          {o.label}
                        </span>
                        <span className="font-num mt-0.5 block text-xs text-zinc-500">{o.sub}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {payMethod === "CARD" && !canCard && cardAvailable ? (
                  <button
                    type="button"
                    onClick={registerCard}
                    disabled={cardBusy}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <i className={`fa-solid ${cardBusy ? "fa-spinner fa-spin" : "fa-credit-card"}`} aria-hidden />
                    카드 등록하고 결제하기
                  </button>
                ) : (
                  <button
                    onClick={getNumber}
                    disabled={!payReady}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <i className="fa-solid fa-mobile-screen-button" aria-hidden />
                    {payMethod === "CARD"
                      ? `${needWon.toLocaleString("ko-KR")}원 결제하고 번호 받기`
                      : `잔액 ${needWon.toLocaleString("ko-KR")}원으로 번호 받기`}
                  </button>
                )}
                {!payReady && payMethod === "POINT" && (
                  <Link
                    href="/charge"
                    className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    <i className="fa-solid fa-bolt text-indigo-500" aria-hidden /> 잔액 충전
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* 진행 중 액션 */}
          {(running || phone) && (
            <div className="flex gap-2">
              <button
                disabled
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white opacity-60"
              >
                <i className="fa-solid fa-spinner fa-spin" aria-hidden />
                진행 중…
              </button>
              {running && (
                <button
                  onClick={ban}
                  className="rounded-xl bg-red-600 px-4 py-3 font-medium text-white hover:bg-red-500"
                >
                  밴넘버
                </button>
              )}
            </div>
          )}
        </div>

        {status && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
              code
                ? "bg-emerald-50 text-emerald-700"
                : /부족|없|오류|실패|불가/.test(status)
                  ? "bg-red-50 text-red-600"
                  : "bg-amber-50 text-amber-700"
            }`}
          >
            <i
              className={`fa-solid ${code ? "fa-circle-check" : "fa-circle-info"}`}
              aria-hidden
            />
            {status}
          </div>
        )}

        {needCharge && (
          <Link
            href="/charge"
            className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            <i className="fa-solid fa-bolt" aria-hidden />
            충전하러 가기
          </Link>
        )}

        {(phone || running) && (
          <div className="mt-4 space-y-2.5 rounded-2xl border border-black/5 bg-black/[0.02] p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-zinc-500">발급 번호</span>
              <span className="flex items-center gap-1">
                <span className="font-num text-lg font-bold">
                  {phone ? phoneFmt(phone) : "요청 중…"}
                </span>
                {phone && <CopyButton text={phone} />}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">남은 시간</span>
              <span className="font-num">{remain != null ? `${remain}초` : "-"}</span>
            </div>
            {paid && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-500">결제</span>
                <span className="font-num text-right">
                  {paid.method === "CARD" ? (
                    <>
                      카드 {paid.amount.toLocaleString("ko-KR")}원{" "}
                      <span className="text-xs text-zinc-400">
                        {code ? "· 확정" : "· 승인됨 (미수신 시 자동취소)"}
                      </span>
                    </>
                  ) : (
                    <>
                      잔액 {wonOf(paid.amount)}{" "}
                      <span className="text-xs text-zinc-400">{code ? "· 차감됨" : "· 수신 시 차감"}</span>
                    </>
                  )}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 border-t border-black/5 pt-2.5">
              <span className="text-zinc-500">인증코드</span>
              {code ? (
                <span className="flex items-center gap-1">
                  <span className="font-num rounded-lg bg-emerald-100 px-3 py-1 text-xl font-bold tracking-widest text-emerald-700">
                    {code}
                  </span>
                  <CopyButton text={code} label="복사" />
                </span>
              ) : (
                <span className="text-zinc-400">{running ? "수신 대기중…" : "-"}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700">
        번호를 받은 뒤 문자가 오지 않으면 꼭 “밴넘버”를 눌러주세요. 밴넘버를 누르지 않고 그냥
        창을 닫으면, 이후 인증문자가 도착했을 때 요금이 차감될 수 있습니다. 인증번호 수신
        후에는 환불이 불가능하며, 합법적인 용도로만 사용하셔야 합니다.
      </p>

    </div>
  );
}
