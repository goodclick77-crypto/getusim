"use client";

import { useEffect, useRef, useState } from "react";
import { COUNTRIES, SERVICES, SMS_COST_POINT } from "@/lib/config";

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
      <div className="rounded-2xl bg-zinc-900 p-5 text-white">
        <p className="text-sm text-zinc-400">보유 포인트</p>
        <p className="mt-1 text-2xl font-bold">{point.toLocaleString("ko-KR")}P</p>
        <p className="mt-1 text-xs text-zinc-400">
          인증코드 수신 성공 시 {SMS_COST_POINT.toLocaleString("ko-KR")}P 차감 (번호
          발급은 무료)
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap gap-2">
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2.5"
          >
            <option value="">국가 선택</option>
            {COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2.5"
          >
            <option value="">서비스 선택</option>
            {SERVICES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={getNumber}
            disabled={running}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {running ? "진행 중…" : "번호 받기"}
          </button>
          {running && (
            <button
              onClick={ban}
              className="rounded-lg bg-red-600 px-4 py-2.5 font-medium text-white hover:bg-red-500"
            >
              밴넘버
            </button>
          )}
        </div>

        <dl className="mt-5 divide-y divide-zinc-100 text-sm">
          <Row label="번호" value={phone || "-"} mono />
          <Row label="남은 시간" value={remain != null ? `${remain}초` : "-"} />
          <Row
            label="SMS 코드"
            value={code || (running ? "대기중…" : "-")}
            highlight={!!code}
          />
          <Row label="상태" value={status || "-"} />
        </dl>
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

function Row({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-zinc-500">{label}</dt>
      <dd
        className={[
          mono ? "font-mono" : "",
          highlight ? "text-lg font-bold text-emerald-600" : "",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}
