"use client";

import { useEffect, useRef, useState } from "react";
import { COUNTRIES, SMS_BASE_POINT } from "@/lib/config";
import { phoneFmt } from "@/lib/format";
import ImageSelect from "@/components/ImageSelect";
import CopyButton from "@/components/CopyButton";

type Props = { initialPoint: number; isAdmin: boolean };
type Svc = {
  value: string;
  label: string;
  slug: string;
  available: boolean;
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
  const [services, setServices] = useState<Svc[]>([]);
  const [svcLoading, setSvcLoading] = useState(false);

  const stopRef = useRef(false);
  const expiresRef = useRef<number | null>(null);

  // 국가 선택 시 전체 서비스 수신률·재고·가격 조회
  useEffect(() => {
    if (!country) {
      setServices([]);
      return;
    }
    let alive = true;
    setSvcLoading(true);
    setServices([]);
    fetch(`/api/sms/services?country=${country}`)
      .then((r) => r.json())
      .then((j) => alive && setServices(j.services || []))
      .catch(() => alive && setServices([]))
      .finally(() => alive && setSvcLoading(false));
    return () => {
      alive = false;
    };
  }, [country]);

  const selected = services.find((s) => s.value === service);

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
    if (!country || !service) {
      setStatus("국가와 서비스를 선택하세요");
      return;
    }
    if (point < SMS_BASE_POINT) {
      setStatus("포인트가 부족합니다");
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
          {/* 국가 */}
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

          {/* 서비스 비교표 (수신률·재고·가격) */}
          {country && (
            <div>
              <p className="mb-1.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-zinc-700">
                <i className="fa-solid fa-grip text-emerald-600" aria-hidden /> 서비스 선택
                <span className="text-xs font-normal text-zinc-400">· 수신률 높은 순</span>
              </p>
              {svcLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="skeleton h-11 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-black/10">
                  <div className="hidden grid-cols-[1fr_4.5rem_4rem_5rem] gap-1 bg-black/[0.03] px-3 py-2 text-xs font-semibold text-zinc-500 sm:grid">
                    <span>서비스</span>
                    <span className="text-center">수신률</span>
                    <span className="text-center">재고</span>
                    <span className="text-right">차감P</span>
                  </div>
                  <ul className="divide-y divide-black/5">
                    {services.map((s) => {
                      const sel = service === s.value;
                      return (
                        <li key={s.value}>
                          <button
                            type="button"
                            disabled={!s.available}
                            onClick={() => setService(s.value)}
                            className={`grid w-full grid-cols-[1fr_4.5rem_4rem_5rem] items-center gap-1 px-3 py-2.5 text-left text-sm transition ${
                              sel
                                ? "bg-emerald-50"
                                : s.available
                                  ? "hover:bg-black/[0.02]"
                                  : "opacity-50"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`https://cdn.simpleicons.org/${s.slug}`}
                                alt=""
                                className="h-4 w-4 shrink-0"
                                loading="lazy"
                              />
                              <span className={sel ? "font-semibold" : ""}>{s.label}</span>
                              {sel && (
                                <i className="fa-solid fa-check text-emerald-600" aria-hidden />
                              )}
                            </span>
                            {s.available ? (
                              <>
                                <span className="text-center">
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-xs font-semibold ${rateColor(s.rate ?? 0)}`}
                                  >
                                    {s.rate}%
                                  </span>
                                </span>
                                <span className="font-num text-center text-xs text-zinc-500">
                                  {(s.stock ?? 0).toLocaleString("ko-KR")}
                                </span>
                                <span className="font-num text-right font-semibold">
                                  {(s.price ?? 0).toLocaleString("ko-KR")}
                                </span>
                              </>
                            ) : (
                              <span className="col-span-3 text-right text-xs text-zinc-400">
                                번호 없음
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 낮은 수신률 경고 */}
          {selected && selected.available && (selected.rate ?? 0) < 20 && (
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
              disabled={running || (!!service && !selected?.available)}
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
