"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { COUNTRIES, SERVICES, SMS_BASE_POINT } from "@/lib/config";
import { phoneFmt } from "@/lib/format";
import ImageSelect from "@/components/ImageSelect";
import CopyButton from "@/components/CopyButton";

type Props = { initialPoint: number; isAdmin: boolean };
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

function rateColor(rate: number) {
  return rate >= 50
    ? "bg-emerald-100 text-emerald-700"
    : rate >= 20
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-600";
}

type Row = { value: string; label: string; img: string; rate: number; stock: number; price: number };

function CompareTable({
  colLabel,
  loading,
  selected,
  onPick,
  imgClass,
  rows,
}: {
  colLabel: string;
  loading: boolean;
  selected: string;
  onPick: (v: string) => void;
  imgClass: string;
  rows: Row[];
}) {
  return (
    <div>
      <p className="mb-1.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-700">
        <i className="fa-solid fa-list-check text-emerald-600" aria-hidden /> {colLabel} 선택
        <span className="text-xs font-normal text-zinc-400">· 수신률 높은 순</span>
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
          <div className="hidden grid-cols-[1fr_4.5rem_4rem_5rem] gap-1 bg-black/[0.03] px-3 py-2 text-xs font-semibold text-zinc-500 sm:grid">
            <span>{colLabel}</span>
            <span className="text-center">수신률</span>
            <span className="text-center">재고</span>
            <span className="text-right">차감P</span>
          </div>
          <ul className="max-h-72 divide-y divide-black/5 overflow-auto">
            {rows.map((r) => {
              const sel = selected === r.value;
              return (
                <li key={r.value}>
                  <button
                    type="button"
                    onClick={() => onPick(r.value)}
                    className={`grid w-full grid-cols-[1fr_4.5rem_4rem_5rem] items-center gap-1 px-3 py-2.5 text-left text-sm transition ${
                      sel ? "bg-emerald-50" : "hover:bg-black/[0.02]"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.img} alt="" className={`${imgClass} shrink-0`} loading="lazy" />
                      <span className={sel ? "font-semibold" : ""}>{r.label}</span>
                      {sel && <i className="fa-solid fa-check text-emerald-600" aria-hidden />}
                    </span>
                    <span className="text-center">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${rateColor(r.rate)}`}>
                        {r.rate}%
                      </span>
                    </span>
                    <span className="font-num text-center text-xs text-zinc-500">
                      {r.stock.toLocaleString("ko-KR")}
                    </span>
                    <span className="font-num text-right font-semibold">
                      {r.price.toLocaleString("ko-KR")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function NumberAuth({ initialPoint, isAdmin }: Props) {
  const [point, setPoint] = useState(initialPoint);
  const [country, setCountry] = useState("");
  const [service, setService] = useState("");

  const [rentalId, setRentalId] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [remain, setRemain] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [balance, setBalance] = useState("");
  const [needCharge, setNeedCharge] = useState(false);
  const [mode, setMode] = useState<"country" | "service">("country");
  const [services, setServices] = useState<Svc[]>([]);
  const [countries, setCountries] = useState<Cnt[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const stopRef = useRef(false);
  const expiresRef = useRef<number | null>(null);

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

  // 서비스 모드: 서비스 선택 → 잘 받아지는 국가 목록
  useEffect(() => {
    if (mode !== "service" || !service) {
      setCountries([]);
      return;
    }
    let alive = true;
    setListLoading(true);
    setCountries([]);
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

  // 카운트다운
  useEffect(() => {
    if (!running || expiresRef.current == null) return;
    const t = setInterval(() => {
      const left = Math.ceil((expiresRef.current! - Date.now()) / 1000);
      setRemain(left > 0 ? left : 0);
      if (left <= 0) {
        clearInterval(t);
        stopRef.current = true;
        setRunning(false);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  async function getNumber() {
    if (running) return;
    setCode("");
    setPhone("");
    setRemain(null);
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
    stopRef.current = false;
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
      setStatus("오류가 발생했습니다");
      setRunning(false);
      return;
    }

    if (data.error || !data.rentalId) {
      if (data.error === "need") setNeedCharge(true);
      setStatus(
        data.error === "00"
          ? "현재 이용 가능한 번호가 없습니다. 다시 시도해주세요."
          : data.error === "need"
            ? data.message || "포인트가 부족합니다"
            : data.message || data.error || "번호 발급 실패",
      );
      setRunning(false);
      return;
    }

    const charged = data.pricePoint ?? SMS_BASE_POINT;

    setRentalId(data.rentalId);
    setPhone(data.phone || "");
    expiresRef.current = data.expires ? new Date(data.expires).getTime() : null;
    setStatus("SMS 코드 수신 대기 중…");

    // 2.5초 간격 폴링
    while (!stopRef.current) {
      await new Promise((r) => setTimeout(r, 2500));
      if (stopRef.current) break;
      try {
        const res = await fetch(`/api/sms/code?rentalId=${data.rentalId}`);
        const j = await res.json();
        if (j.code) {
          setCode(j.code);
          setStatus("인증코드 수신 완료");
          setPoint((p) => Math.max(0, p - charged));
          setRunning(false);
          stopRef.current = true;
          break;
        }
      } catch {
        /* 폴링 실패는 무시하고 재시도 */
      }
    }
  }

  async function ban() {
    if (!rentalId) return;
    stopRef.current = true;
    setRunning(false);
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

  async function checkBalance() {
    setBalance("조회 중…");
    try {
      const res = await fetch("/api/sms/balance");
      const j = await res.json();
      setBalance(j.error ? j.error : `5sim 잔액: ${j.balance}`);
    } catch {
      setBalance("조회 실패");
    }
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

          {/* 서비스모드: 국가 비교표 */}
          {mode === "service" && service && (
            <CompareTable
              colLabel="국가"
              loading={listLoading}
              selected={country}
              onPick={setCountry}
              imgClass="h-3.5 w-5 rounded-[2px] object-cover shadow-sm"
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
                : /부족|없|오류|실패/.test(status)
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

      {isAdmin && (
        <div className="flex items-center gap-3">
          <button
            onClick={checkBalance}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
          >
            5sim 잔액체크
          </button>
          {balance && <span className="text-sm text-zinc-600">{balance}</span>}
        </div>
      )}
    </div>
  );
}
