"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { COUNTRIES, SERVICES, SMS_BASE_POINT } from "@/lib/config";
import { phoneFmt } from "@/lib/format";
import ImageSelect from "@/components/ImageSelect";
import CopyButton from "@/components/CopyButton";

type Props = { initialPoint: number };
type Svc = {
  value: string;
  label: string;
  slug: string;
  price?: number;
  rate?: number;
  stock?: number;
};
type Cnt = {
  value: string;
  label: string;
  iso: string;
  price?: number;
  rate?: number;
  stock?: number;
};
type Recent = { value: string; label: string; iso: string };
// 스마트 모드에서 서버가 자동으로 골라준 국가·통신사 한 건
type SmartPickT = {
  country: string;
  label: string;
  iso: string;
  operator: string;
  price: number;
  rate: number;
  stock: number;
};

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
 * 최근 72시간 내 수신 성공한 국가를 최신순으로 보여주고, 없으면 수신률 상위 국가로 대체한다.
 * 어느 쪽이든 화면에 보이는 모양(문구·아이콘·칩)은 동일하다 — 사용자가 구분할 이유가 없다.
 */
function ReferenceRow({
  loading,
  recent,
  fallback,
  selected,
  onPick,
}: {
  loading: boolean;
  recent: Recent[];
  fallback: Recent[];
  selected: string;
  onPick: (v: string) => void;
}) {
  if (loading) return <div className="skeleton h-16 rounded-xl" />;

  const items = recent.length > 0 ? recent : fallback;
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
        수신률은 네트워크 환경에 따라 달라질 수 있습니다.
      </p>
    </div>
  );
}

type Row = { value: string; label: string; img: string; rate: number; stock: number; price: number };

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
              return (
                <li
                  key={r.value}
                  ref={sel ? selectedRef : undefined}
                  className={`flex items-stretch ${sel ? "bg-emerald-50" : ""}`}
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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.img} alt="" className={`${imgClass} shrink-0`} loading="lazy" />
                        <span className={`truncate text-sm ${sel ? "font-bold" : "font-medium"}`}>
                          {r.label}
                        </span>
                        {sel && <i className="fa-solid fa-check shrink-0 text-emerald-600" aria-hidden />}
                      </span>
                      <span className="font-num shrink-0 text-base font-bold">
                        {r.price.toLocaleString("ko-KR")}
                        <span className="text-xs font-normal text-zinc-400">P</span>
                      </span>
                    </div>
                    {/* 2줄: 수신률 + 재고 */}
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span className={`rounded px-1.5 py-0.5 font-semibold ${rateColor(r.rate)}`}>
                        예상 수신률 {r.rate}%
                      </span>
                      <span className="text-zinc-400">재고 약 {r.stock.toLocaleString("ko-KR")}</span>
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
          표시된 수신률·재고는 실시간 추정치로 참고용이며, 실제 발급 결과와 다를 수 있어요.
        </p>
      )}
    </div>
  );
}

/**
 * 스마트 모드 결과 카드.
 * 서비스만 고르면 서버가 지금 가장 잘 받아지는 국가·통신사를 대신 골라준다.
 * 회원이 누를 게 없으므로 선택지가 아니라 "이걸로 발급된다"는 확인용 표시다 —
 * 가격을 보고 발급할지 말지만 판단하면 된다.
 */
function SmartPick({ loading, pick }: { loading: boolean; pick: SmartPickT | null }) {
  if (loading) return <div className="skeleton h-[92px] rounded-xl" />;

  if (!pick) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-700">
        <i className="fa-solid fa-triangle-exclamation mr-1.5" aria-hidden />
        지금은 이 서비스에 추천할 만한 국가가 없어요. <b>국가로 찾기</b> 탭에서 직접 골라보세요.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://flagcdn.com/w40/${pick.iso}.png`}
          alt=""
          className="h-[18px] w-6 rounded-sm object-cover shadow-sm"
        />
        <span className="font-semibold text-zinc-800">{pick.label}</span>
        <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
          <i className="fa-solid fa-wand-magic-sparkles mr-1" aria-hidden />
          자동선택
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
        <span className="flex items-center gap-1.5 text-zinc-500">
          수신률
          <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${rateColor(pick.rate)}`}>
            {pick.rate}%
          </span>
        </span>
        <span className="text-zinc-500">
          재고 <span className="font-num text-zinc-700">{pick.stock.toLocaleString("ko-KR")}</span>
        </span>
        <span className="ms-auto text-zinc-500">
          차감예정{" "}
          <span className="font-num text-base font-bold text-zinc-900">
            {pick.price.toLocaleString("ko-KR")}P
          </span>
        </span>
      </div>

      <p className="mt-2 text-xs text-zinc-400">
        <i className="fa-solid fa-circle-info mr-1" aria-hidden />
        수신률·재고는 실시간 추정치예요. 발급 직전 가격이 오르면 자동으로 취소돼요.
      </p>
    </div>
  );
}

export default function NumberAuth({ initialPoint }: Props) {
  const [point, setPoint] = useState(initialPoint);
  const [country, setCountry] = useState("");
  const [service, setService] = useState("");

  const [rentalId, setRentalId] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [remain, setRemain] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [needCharge, setNeedCharge] = useState(false);
  // 기본은 국가 탭. 스마트는 5sim 재고 표시가 실제와 맞지 않아 첫 후보가 실패하는 경우가 있어
  // (서버 제외목록이 쌓이면서 정확해진다) 아직 기본 화면으로 두지 않는다.
  const [mode, setMode] = useState<"smart" | "country" | "service">("country");
  const [services, setServices] = useState<Svc[]>([]);
  const [countries, setCountries] = useState<Cnt[]>([]);
  const [smartPick, setSmartPick] = useState<SmartPickT | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [favs, setFavs] = useState<Set<string>>(new Set()); // `${kind}:${value}`
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const pollGenRef = useRef(0); // 폴링 세대 토큰(동시 폴링 방지)

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
        if (r.smsCode) {
          setCode(r.smsCode);
          setStatus("인증코드 수신 완료");
        } else if (deadline - Date.now() > 0) {
          // 폴링 재개 (남은 시간 있으면)
          pollCode(r.id, r.pricePoint ?? SMS_BASE_POINT, deadline);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 스마트 모드: 서비스 선택 → 서버가 "지금 가장 잘 받아지는" 국가·통신사 1건을 골라준다.
  // 고른 국가를 country 에 그대로 넣어두면 이후 발급 흐름(getNumber)이 손댈 것 없이 그대로 돈다.
  useEffect(() => {
    if (mode !== "smart") return;
    if (!service) {
      setSmartPick(null);
      setCountry("");
      return;
    }
    let alive = true;
    setListLoading(true);
    setSmartPick(null);
    setCountry("");
    fetch(`/api/sms/smart?service=${service}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        setSmartPick(j.pick || null);
        if (j.pick) setCountry(j.pick.country);
      })
      .catch(() => alive && setSmartPick(null))
      .finally(() => alive && setListLoading(false));
    return () => {
      alive = false;
    };
  }, [mode, service]);

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
    mode === "smart"
      ? (smartPick ?? undefined)
      : mode === "country"
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

  async function getNumber() {
    if (running) return;
    pollGenRef.current++; // 진행 중 폴링(이어받기 등) 취소
    setCode("");
    setPhone("");
    setRemain(null);
    setExpiresAt(null);
    setStatus("");
    setNeedCharge(false);
    if (!country || !service) {
      setStatus(
        mode !== "smart"
          ? "국가와 서비스를 선택하세요"
          : service
            ? "지금은 추천할 국가가 없어요. 국가로 찾기 탭을 이용해 주세요"
            : "서비스를 선택하세요",
      );
      return;
    }
    // 선택한 서비스 가격을 미리 알고 있으면, 발급 요청 전에 부족 안내
    const need = selected?.price ?? SMS_BASE_POINT;
    if (point < Math.max(need, SMS_BASE_POINT)) {
      setStatus(
        `포인트가 부족합니다 (${need.toLocaleString("ko-KR")}P 필요, 보유 ${point.toLocaleString("ko-KR")}P)`,
      );
      setNeedCharge(true);
      return;
    }

    setStatus("번호 요청 중…");
    setRunning(true);

    let data: {
      rentalId?: number;
      phone?: string;
      expires?: string;
      error?: string;
      message?: string;
      pricePoint?: number;
    };
    try {
      const res = await fetch("/api/sms/number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // maxPoint = 지금 화면에 떠 있는 차감예정 금액. 조회~발급 사이 5sim 가격이 올라도
        // 이 금액을 넘으면 서버가 사지 않고 취소한다(스마트·수동 모드 공통).
        body: JSON.stringify({ country, service, maxPoint: selected?.price }),
      });
      data = await res.json();
    } catch {
      setStatus("일시적인 문제로 발급이 불가능합니다. 다른 국가·서비스를 이용해주세요.");
      setRunning(false);
      return;
    }

    if (data.error || !data.rentalId) {
      if (data.error === "need") setNeedCharge(true);
      const failedLabel = smartPick?.label || "";
      setStatus(
        data.error === "00"
          ? "현재 이용 가능한 번호가 없습니다. 다른 국가를 이용해 주세요."
          : data.error === "need"
            ? data.message || "포인트가 부족합니다"
            : data.message || data.error || "번호 발급 실패",
      );
      setRunning(false);

      // 스마트 모드에서 "번호 없음"이면 방금 실패한 조합은 서버 제외목록에 올라갔다.
      // 다시 조회하면 다음 후보가 내려온다. 국가가 바뀌면 가격도 바뀌므로 자동으로 사지 않고,
      // 새 후보를 보여준 뒤 회원이 직접 다시 누르게 한다.
      if (mode === "smart" && data.error === "00" && service) {
        setListLoading(true);
        try {
          const r = await fetch(`/api/sms/smart?service=${service}`);
          const j = await r.json();
          setSmartPick(j.pick || null);
          setCountry(j.pick?.country || "");
          setStatus(
            j.pick
              ? `${failedLabel || "해당 국가"}는 지금 번호가 없어요. 다음 후보를 찾았으니 가격 확인 후 다시 눌러주세요.`
              : `${failedLabel || "해당 국가"}는 지금 번호가 없어요. 국가로 찾기 탭에서 직접 골라주세요.`,
          );
        } catch {
          /* 재조회 실패는 위에서 세운 안내 문구를 그대로 둔다 */
        }
        setListLoading(false);
      }
      return;
    }

    const charged = data.pricePoint ?? SMS_BASE_POINT;
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
        setStatus("문자가 오지 않아 번호를 자동 취소했어요. 다른 국가·서비스로 다시 받아주세요.");
        setRunning(false);
        setPhone("");
        setExpiresAt(null);
        setRemain(null);
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
    setStatus("번호를 밴 처리했습니다. 다시 번호를 받아주세요.");
    setPhone("");
    setRemain(null);
  }

  return (
    <div className="space-y-5">
      <div className="glass-dark rounded-2xl p-5 text-white">
        <p className="flex items-center gap-2 text-sm text-zinc-400">
          <i className="fa-solid fa-wallet text-emerald-400" aria-hidden /> 보유 포인트
        </p>
        <p className="font-num mt-1 text-2xl font-bold">
          {point.toLocaleString("ko-KR")}P
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          인증코드 수신 성공 시 차감 (번호 발급은 무료) · 서비스별 가격 상이, 최소{" "}
          {SMS_BASE_POINT.toLocaleString("ko-KR")}P
        </p>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="space-y-4">
          {/* 검색 모드 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("smart")}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
                mode === "smart"
                  ? "bg-zinc-900 text-white"
                  : "bg-black/5 text-zinc-600 hover:bg-black/10"
              }`}
            >
              <i className="fa-solid fa-wand-magic-sparkles mr-1.5" aria-hidden /> 스마트
            </button>
            <button
              type="button"
              onClick={() => setMode("country")}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
                mode === "country"
                  ? "bg-zinc-900 text-white"
                  : "bg-black/5 text-zinc-600 hover:bg-black/10"
              }`}
            >
              <i className="fa-solid fa-flag mr-1.5" aria-hidden /> 국가로
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
              <i className="fa-solid fa-grip mr-1.5" aria-hidden /> 서비스로
            </button>
          </div>

          {/* 스마트: 서비스만 고르면 국가는 서버가 자동 선택 */}
          {mode === "smart" && (
            <div>
              <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-zinc-700">
                <i className="fa-solid fa-wand-magic-sparkles text-emerald-600" aria-hidden />
                서비스
                <span className="font-normal text-zinc-400">· 국가는 자동으로 골라드려요</span>
              </p>
              <ImageSelect
                placeholder="서비스 선택"
                value={service}
                onChange={setService}
                imgClass="h-5 w-5 object-contain"
                options={SERVICES.map((s) => ({
                  value: s.value,
                  label: s.label,
                  img: `https://cdn.simpleicons.org/${s.slug}`,
                }))}
              />
            </div>
          )}

          {mode === "smart" && service && <SmartPick loading={listLoading} pick={smartPick} />}

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
                stock: s.stock ?? 0,
                price: s.price ?? 0,
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
              fallback={countries.slice(0, 2)} // 수신률 내림차순 → 상위 2개
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
                stock: c.stock ?? 0,
                price: c.price ?? 0,
              }))}
            />
          )}

          {/* 액션 */}
          <div className="flex gap-2">
            <button
              onClick={getNumber}
              disabled={running || !country || !service}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              <i
                className={`fa-solid ${running ? "fa-spinner fa-spin" : "fa-mobile-screen-button"}`}
                aria-hidden
              />
              {running ? "진행 중…" : "번호 받기"}
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
        창을 닫으면, 이후 인증문자가 도착했을 때 포인트가 차감될 수 있습니다. 인증번호 수신
        후에는 환불이 불가능하며, 합법적인 용도로만 사용하셔야 합니다.
      </p>

    </div>
  );
}
