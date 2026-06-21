"use client";

import { useEffect, useState } from "react";
import { COUNTRIES, SERVICES } from "@/lib/config";
import ImageSelect from "@/components/ImageSelect";

type Row = { value: string; label: string; img: string; rate: number; stock: number; price: number };

function rateColor(rate: number) {
  return rate >= 50
    ? "bg-emerald-100 text-emerald-700"
    : rate >= 20
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-600";
}

export default function PriceBrowser() {
  const [mode, setMode] = useState<"country" | "service">("country");
  const [country, setCountry] = useState("");
  const [service, setService] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode === "country" && country) {
      let alive = true;
      setLoading(true);
      setRows([]);
      fetch(`/api/sms/services?country=${country}`)
        .then((r) => r.json())
        .then((j) => {
          if (!alive) return;
          setRows(
            (j.services || []).map((s: { value: string; label: string; slug: string; rate?: number; stock?: number; price?: number }) => ({
              value: s.value,
              label: s.label,
              img: `https://cdn.simpleicons.org/${s.slug}`,
              rate: s.rate ?? 0,
              stock: s.stock ?? 0,
              price: s.price ?? 0,
            })),
          );
        })
        .catch(() => alive && setRows([]))
        .finally(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
    }
    if (mode === "service" && service) {
      let alive = true;
      setLoading(true);
      setRows([]);
      fetch(`/api/sms/countries?service=${service}`)
        .then((r) => r.json())
        .then((j) => {
          if (!alive) return;
          setRows(
            (j.countries || []).map((c: { value: string; label: string; iso: string; rate?: number; stock?: number; price?: number }) => ({
              value: c.value,
              label: c.label,
              img: `https://flagcdn.com/w40/${c.iso}.png`,
              rate: c.rate ?? 0,
              stock: c.stock ?? 0,
              price: c.price ?? 0,
            })),
          );
        })
        .catch(() => alive && setRows([]))
        .finally(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
    }
    setRows([]);
  }, [mode, country, service]);

  const imgClass = mode === "country" ? "h-4 w-4" : "h-3.5 w-5 rounded-[2px] object-cover shadow-sm";
  const colLabel = mode === "country" ? "서비스" : "국가";

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("country");
            setService("");
            setRows([]);
          }}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
            mode === "country" ? "bg-zinc-900 text-white" : "bg-black/5 text-zinc-600 hover:bg-black/10"
          }`}
        >
          <i className="fa-solid fa-flag mr-1.5" aria-hidden /> 국가로 보기
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("service");
            setCountry("");
            setRows([]);
          }}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
            mode === "service" ? "bg-zinc-900 text-white" : "bg-black/5 text-zinc-600 hover:bg-black/10"
          }`}
        >
          <i className="fa-solid fa-grip mr-1.5" aria-hidden /> 서비스로 보기
        </button>
      </div>

      {mode === "country" ? (
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
      ) : (
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
      )}

      <div className="mt-4">
        {!country && !service ? (
          <p className="rounded-xl bg-black/[0.03] px-4 py-6 text-center text-sm text-zinc-400">
            {mode === "country" ? "국가" : "서비스"}를 선택하면 가격이 표시됩니다.
          </p>
        ) : loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-14 rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            현재 이용 가능한 {colLabel}가 없습니다.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-black/10">
            <ul className="max-h-96 divide-y divide-black/5 overflow-auto">
              {rows.map((r) => (
                <li key={r.value} className="px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.img} alt="" className={`${imgClass} shrink-0`} loading="lazy" />
                      <span className="truncate text-sm font-medium">{r.label}</span>
                    </span>
                    <span className="font-num shrink-0 text-base font-bold">
                      {r.price.toLocaleString("ko-KR")}
                      <span className="text-xs font-normal text-zinc-400">P</span>
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className={`rounded px-1.5 py-0.5 font-semibold ${rateColor(r.rate)}`}>
                      수신률 {r.rate}%
                    </span>
                    <span className="text-zinc-400">재고 {r.stock.toLocaleString("ko-KR")}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-zinc-400">
        ※ 표시 금액(P)은 인증코드 수신 성공 시 차감되는 포인트입니다. 1P = 1원 가치이며, 충전은 결제금액의
        약 91%가 포인트로 적립됩니다(10% 수수료).
      </p>
    </div>
  );
}
