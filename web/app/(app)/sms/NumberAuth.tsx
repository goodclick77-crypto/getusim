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
 * 최근 24시간 내 수신 성공한 국가를 최신순으로 보여주고, 없으면 수신률 상위 국가로 대체한다.
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
  return (
    <div>
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-700">
        <i className="fa-solid fa-list-check text-emerald-600" aria-hidden /> {colLabel} 선택
        <span className="text-xs font-normal text-zinc-400">· 참고용 추정치 · 수신률 높은 순</span>
      </p>
      <p className="mb-1.5 text-xs text-zinc-400">
        수신률은 네트워크 환경에 따라 달라질 수 있습니다.
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
          <ul className="max-h-80 divide-y divide-black/5 overflow-auto">
            {sorted.map((r) => {
              const sel = selected === r.value;
              const fav = favValues.has(r.value);
              return (
                <li key={r.value} className={`flex items-stretch ${sel ? "bg-emerald-50" : ""}`}>
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
  const [mode, setMode] = useState<"country" | "service">("country");
  const [services, setServices] = useState<Svc[]>([]);
  const [countries, setCountries] = useState<Cnt[]>([]);
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

  const selected =
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
      setStatus("국가와 서비스를 선택하세요");
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
        body: JSON.stringify({ country, service }),
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
          ? "현재 이용 가능한 번호가 없습니다. 다른 국가를 이용해 주세요."
          : data.error === "need"
            ? data.message || "포인트가 부족합니다"
            : data.message || data.error || "번호 발급 실패",
      );
      setRunning(false);
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
        // 문자 미수신 → 폴링 종료 + 5sim 번호 즉시 취소(잔액 반환).
        pollGenRef.current++;
        fetch("/api/sms/ban", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rentalId: id }),
        }).catch(() => {});
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
    try {
      await fetch("/api/sms/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rentalId }),
      });
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
                stock: s.stock ?? 0,
                price: s.price ?? 0,
              }))}
            />
          )}

          {/* 서비스모드: 최근 성공 국가(참고용) */}
          {mode === "service" && service && (
            <ReferenceRow
              loading={listLoading}
              recent={recent}
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

          {/* 낮은 수신률 경고 */}
          {selected && (selected.rate ?? 0) < 20 && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <i className="fa-solid fa-triangle-exclamation mt-0.5" aria-hidden />
              <span>
                이 조합은 수신률이 낮습니다({selected.rate}%). 수신률이 더 높은 다른
                국가/서비스를 추천합니다.
              </span>
            </div>
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

      <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-700">
        수신번호가 오지 않거나 응답 실패 시 “밴넘버”를 눌러주세요. 인증번호 수신 후에는
        환불이 불가능합니다. 현지 법률·규정을 준수하여 합법적인 용도로만 사용하세요.
      </p>

    </div>
  );
}
