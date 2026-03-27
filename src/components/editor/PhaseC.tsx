"use client";

import { useEffect, useState, useRef } from "react";
import { SectionCard } from "./SectionCard";
import type { GenStatus } from "@/lib/useGenerateSection";

// ── 고정 유의사항 템플릿 ─────────────────────────────────
const FIXED_NOTE_BLOCKS = [
  {
    title: "예약 및 결제",
    items: [
      "예약 확정 후 취소 시 위약금이 발생할 수 있습니다.",
      "결제는 원화 기준으로 진행되며, 환율 변동에 따라 최종 금액이 달라질 수 있습니다.",
      "특가 상품의 경우 예약 후 즉시 결제가 필요합니다.",
    ],
  },
  {
    title: "탑승 및 하선",
    items: [
      "출항 2~3시간 전까지 탑승 수속을 완료해야 합니다.",
      "여권 유효기간은 귀국일 기준 6개월 이상 남아 있어야 합니다.",
      "기항지 관광 시 크루즈 일정에 맞춰 귀선하지 않을 경우 크루즈사에서 책임을 지지 않습니다.",
    ],
  },
  {
    title: "선내 이용",
    items: [
      "선내 식당, 바, 일부 시설은 별도 요금이 부과될 수 있습니다.",
      "드레스 코드가 있는 레스토랑의 경우 포멀 복장이 필요할 수 있습니다.",
      "선내 와이파이는 제공되는 경우 분량 제한이 있을 수 있습니다.",
    ],
  },
  {
    title: "기타",
    items: [
      "크루즈 일정 및 기항지는 기상·항만 상황에 따라 변경될 수 있습니다.",
      "크루즈 상품 특성상 해외 결제 수수료가 발생할 수 있습니다.",
      "상기 상품 내용은 현지 사정에 따라 변경될 수 있으며, 변경 시 사전 안내드립니다.",
    ],
  },
];

type NoteBlock = { title: string; items: string[] };

export type PhaseCData = {
  S08: { noteBlocks: NoteBlock[]; closingCopy: string };
};

type Props = {
  region: string;
  headCopyMain: string;         // S01에서 생성된 메인 카피
  onComplete: (data: PhaseCData) => void;
};

export function PhaseC({ region, headCopyMain, onComplete }: Props) {
  const started = useRef(false);
  const [status, setStatus] = useState<GenStatus>("idle");
  const [closingCopy, setClosingCopy] = useState("");
  const [noteBlocks, setNoteBlocks] = useState<NoteBlock[]>(FIXED_NOTE_BLOCKS);
  const [done, setDone] = useState(false);

  // 마운트 시 클로징 카피 자동 생성
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    generateClosing();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function generateClosing() {
    setStatus("generating");
    try {
      // GET + URLSearchParams — ByteString 에러 우회
      const params = new URLSearchParams({
        section: "S08",
        region,
        headCopyMain,
      });
      const res = await fetch(`/api/generate-section?${params.toString()}`);
      if (!res.body) throw new Error("No stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = ""; let eventName = "";

      while (true) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("event: ")) { eventName = line.slice(7).trim(); continue; }
          if (line.startsWith("data: ")) {
            const payload = JSON.parse(line.slice(6)) as { data?: { closingCopy: string }; message?: string };
            if (eventName === "result" && payload.data) {
              setClosingCopy(payload.data.closingCopy);
              setStatus("done");
            }
            if (eventName === "error") throw new Error(payload.message);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
      setClosingCopy("함께하는 모든 순간이 특별한 추억이 됩니다");
    }
  }

  function handleFinish() {
    onComplete({ S08: { noteBlocks, closingCopy } });
    setDone(true);
  }

  return (
    <div className="space-y-5">
      <SectionCard id="S08" label="유의사항 & 클로징" status={status}>
        <div className="space-y-6">

          {/* 유의사항 블록 (편집 가능) */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-3">유의사항 <span className="text-gray-400">(내용 편집 가능)</span></p>
            <div className="space-y-4">
              {noteBlocks.map((block, bi) => (
                <div key={bi} className="border border-gray-200 rounded-xl p-4">
                  <input
                    value={block.title}
                    onChange={e => setNoteBlocks(prev =>
                      prev.map((b, i) => i === bi ? { ...b, title: e.target.value } : b)
                    )}
                    className="text-sm font-semibold text-gray-800 border-0 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1 w-full mb-2 bg-transparent"
                  />
                  <ul className="space-y-1.5">
                    {block.items.map((item, ii) => (
                      <li key={ii} className="flex items-start gap-2">
                        <span className="text-gray-400 mt-1 text-xs flex-shrink-0">•</span>
                        <textarea
                          value={item}
                          onChange={e => setNoteBlocks(prev =>
                            prev.map((b, bi2) => bi2 === bi
                              ? { ...b, items: b.items.map((it, i) => i === ii ? e.target.value : it) }
                              : b
                            )
                          )}
                          rows={1}
                          className="flex-1 text-xs text-gray-600 border-0 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1 resize-none bg-transparent hover:bg-gray-50 transition-colors"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* 클로징 카피 */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">마무리 감성 카피</p>
            {status === "generating" ? (
              <div className="flex items-center gap-2 text-blue-500 text-sm py-3">
                <span className="animate-spin">⟳</span> AI가 마무리 카피를 작성 중…
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  value={closingCopy}
                  onChange={e => setClosingCopy(e.target.value)}
                  placeholder="예: 그 바다에서, 당신만의 이야기가 시작됩니다"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
                />
                <div className="bg-gray-900 text-white rounded-xl px-6 py-4 text-center">
                  <p className="text-base font-bold">{closingCopy || "마무리 카피 미리보기"}</p>
                </div>
                {status === "error" && (
                  <button
                    type="button"
                    onClick={generateClosing}
                    className="text-xs text-blue-600 underline"
                  >
                    다시 생성하기
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* 완료 버튼 */}
      {!done ? (
        <div className="pt-4">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 text-center">
            <p className="text-sm font-semibold text-gray-700 mb-1">모든 섹션 완료! 🎉</p>
            <p className="text-xs text-gray-500 mb-4">내용을 최종 확인한 뒤 저장하고 출력 화면으로 이동하세요</p>
            <button
              onClick={handleFinish}
              disabled={status === "generating"}
              className="bg-green-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-green-700 transition-colors shadow-sm text-sm disabled:opacity-40"
            >
              저장 & 출력 화면으로 →
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
          <p className="text-sm font-semibold text-green-700">✓ 저장 완료 — 출력 화면으로 이동합니다</p>
        </div>
      )}
    </div>
  );
}
