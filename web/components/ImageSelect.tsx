"use client";

import { useEffect, useRef, useState } from "react";

export type ImageOption = { value: string; label: string; img: string };

/** 이미지(국기/로고)를 표시하는 커스텀 드롭다운 셀렉트 */
export default function ImageSelect({
  options,
  value,
  onChange,
  placeholder,
  imgClass = "h-5 w-5 object-contain",
}: {
  options: ImageOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  imgClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-xl border border-black/10 bg-white/60 px-3.5 py-3 text-left transition hover:bg-white"
      >
        {selected ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.img} alt="" className={`${imgClass} shrink-0`} loading="lazy" />
            <span className="truncate font-medium">{selected.label}</span>
          </>
        ) : (
          <span className="text-zinc-400">{placeholder}</span>
        )}
        <i
          className={`fa-solid fa-chevron-down ml-auto shrink-0 text-xs text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-black/10 bg-white p-1 shadow-2xl"
        >
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-black/5 ${
                  o.value === value ? "bg-emerald-50 font-semibold" : ""
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.img} alt="" className={`${imgClass} shrink-0`} loading="lazy" />
                <span className="truncate">{o.label}</span>
                {o.value === value && (
                  <i className="fa-solid fa-check ml-auto text-emerald-600" aria-hidden />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
