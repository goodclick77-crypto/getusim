"use client";

import { useEffect, useRef, useState } from "react";
import { COUNTRIES, SERVICES, SMS_COST_POINT } from "@/lib/config";
import { phoneFmt } from "@/lib/format";
import ImageSelect from "@/components/ImageSelect";
import CopyButton from "@/components/CopyButton";

type Props = { initialPoint: number; isAdmin: boolean };

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

  const stopRef = useRef(false);
  const expiresRef = useRef<number | null>(null);

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
    if (point < SMS_COST_POINT) {
      setStatus("포인트가 부족합니다");
      return;
    }

    setStatus("번호 요청 중…");
    stopRef.current = false;
    setRunning(true);

    let data: { rentalId?: number; phone?: string; expires?: string; error?: string };
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
          : data.error || "번호 발급 실패",
      );
      setRunning(false);
      return;
    }

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
          setPoint((p) => Math.max(0, p - SMS_COST_POINT));
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
          인증코드 수신 성공 시 {SMS_COST_POINT.toLocaleString("ko-KR")}P 차감 (번호
          발급은 무료)
        </p>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-zinc-700">
                <i className="fa-solid fa-flag text-emerald-600" aria-hidden /> 국가
              </p>
              <ImageSelect
                placeholder="국가 선택"
                value={country}
                onChange={setCountry}
                imgClass="h-[18px] w-6 rounded-sm object-cover shadow-sm"
                options={COUNTRIES.map((c) => ({
                  value: c.value,
                  label: c.label,
                  img: `https://flagcdn.com/w40/${c.iso}.png`,
                }))}
              />
            </div>
            <div>
              <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-zinc-700">
                <i className="fa-solid fa-grip text-emerald-600" aria-hidden /> 서비스
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
          </div>

          {/* 액션 */}
          <div className="flex gap-2">
            <button
              onClick={getNumber}
              disabled={running}
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
