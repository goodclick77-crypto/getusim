"use client";

import { useRef } from "react";
import { answerInquiry } from "../actions";

type Template = { id: number; title: string; content: string };

/** 관리자 문의 답변 입력. 자주 쓰는 답변(템플릿) 선택 시 내용칸을 채운다(교체). */
export default function AnswerForm({
  parentId,
  answered,
  templates,
}: {
  parentId: number;
  answered: boolean;
  templates: Template[];
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  return (
    <form action={answerInquiry} className="mt-3 space-y-2">
      <input type="hidden" name="parentId" value={parentId} />

      {templates.length > 0 && (
        <select
          aria-label="자주 쓰는 답변 선택"
          defaultValue=""
          onChange={(e) => {
            const t = templates.find((x) => x.id === Number(e.target.value));
            if (t && ref.current) ref.current.value = t.content;
            e.currentTarget.value = ""; // 다시 같은 항목도 고를 수 있게 초기화
          }}
          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-zinc-600 outline-none focus:border-emerald-500"
        >
          <option value="" disabled>
            자주 쓰는 답변 선택…
          </option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      )}

      <textarea
        ref={ref}
        name="content"
        rows={3}
        placeholder={answered ? "추가 답변 입력 (엔터로 줄바꿈)" : "답변 입력 (엔터로 줄바꿈)"}
        aria-label="답변"
        className="w-full rounded-xl border border-black/10 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
      />
      <div className="flex justify-end">
        <button className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-700">
          <i className="fa-solid fa-paper-plane" aria-hidden /> 답변 등록
        </button>
      </div>
    </form>
  );
}
