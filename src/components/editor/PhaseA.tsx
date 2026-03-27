"use client";

import { useEffect, useState, useRef } from "react";
import { SectionCard } from "./SectionCard";
import type { GenStatus } from "@/lib/useGenerateSection";
import { FIXED_BENEFITS } from "@/constants/benefits";
import type { BenefitKey } from "@/types/cruise";

// ── 타입 정의 ──────────────────────────────────────────────
type S01Data = { sub: string; main: string };
type S02Data = { key: BenefitKey; enabled: boolean }[];
type S03Data = { sectionTag: string; sectionTitle: string; subCopy: string };
type S04Data = { shipDescription: string };

export type PhaseAData = {
  S01: S01Data;
  S02: S02Data;
  S03: S03Data;
  S04: S04Data;
};

type Props = {
  shippingLine: string;
  shipName: string;
  region: string;
  initialBenefits: S02Data;
  onComplete: (data: PhaseAData) => void;
};

// ── SSE 헬퍼 ──────────────────────────────────────────────
async function generateSection<T>(
  section: string,
  context: Record<string, unknown>,
  onResult: (d: T) => void,
  onStatusChange: (s: GenStatus) => void
) {
  onStatusChange("generating");
  try {
    // GET + URLSearchParams — body ByteString 문제 완전 우회
    // URLSearchParams가 한글을 퍼센트인코딩(ASCII)으로 변환
    const params = new URLSearchParams({ section });
    Object.entries(context).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        params.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
      }
    });
    const res = await fetch(`/api/generate-section?${params.toString()}`);
    if (!res.body) throw new Error("No stream");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let eventName = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("event: ")) { eventName = line.slice(7).trim(); continue; }
        if (line.startsWith("data: ")) {
          const payload = JSON.parse(line.slice(6));
          if (eventName === "result") { onResult(payload.data as T); onStatusChange("done"); }
          if (eventName === "error") throw new Error(payload.message);
        }
      }
    }
  } catch (err) {
    onStatusChange("error");
    console.error(`[generate-section:${section}]`, err);
  }
}

// ── 인라인 편집 input ──────────────────────────────────────
function EditField({
  label, value, onChange, multiline = false, placeholder = ""
}: {
  label: string; value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-gray-50 hover:bg-white transition-colors"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 hover:bg-white transition-colors"
        />
      )}
    </div>
  );
}

// ── PhaseA 메인 컴포넌트 ───────────────────────────────────
export function PhaseA({ shippingLine, shipName, region, initialBenefits, onComplete }: Props) {
  const started = useRef(false);

  // 각 섹션 상태
  const [s01Status, setS01Status] = useState<GenStatus>("idle");
  const [s03Status, setS03Status] = useState<GenStatus>("idle");
  const [s04Status, setS04Status] = useState<GenStatus>("idle");

  // 섹션 데이터 (생성 후 편집 가능)
  const [s01, setS01] = useState<S01Data>({ sub: "", main: "" });
  const [s02, setS02] = useState<S02Data>(initialBenefits);
  const [s03, setS03] = useState<S03Data>({ sectionTag: "", sectionTitle: "", subCopy: "" });
  const [s04, setS04] = useState<S04Data>({ shipDescription: "" });

  const ctx = { shippingLine, shipName, region };

  // S01 → S03 → S04 순차 생성
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      // S01
      await generateSection<S01Data>("S01", ctx, setS01, setS01Status);
      // S03 (S01 완료 후)
      await generateSection<S03Data>("S03", ctx, setS03, setS03Status);
      // S04 (S03 완료 후)
      await generateSection<S04Data>("S04", ctx, setS04, setS04Status);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const allDone = s01Status === "done" && s03Status === "done" && s04Status === "done";

  function handleNext() {
    onComplete({ S01: s01, S02: s02, S03: s03, S04: s04 });
  }

  return (
    <div className="space-y-5">

      {/* ── S01 인트로 헤드카피 ── */}
      <SectionCard id="S01" label="인트로 헤드카피" badge="Hero" status={s01Status}>
        {s01Status === "idle" && (
          <p className="text-sm text-gray-400 text-center py-4">생성 대기 중…</p>
        )}
        {s01Status === "generating" && (
          <div className="py-6 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-blue-600">AI가 카피를 작성하고 있습니다…</p>
          </div>
        )}
        {(s01Status === "done" || s01Status === "error") && (
          <div className="space-y-4">
            <EditField
              label="서브 카피 (15자 이내)"
              value={s01.sub}
              onChange={v => setS01(p => ({ ...p, sub: v }))}
              placeholder="예: 특별한 알래스카 여정"
            />
            <EditField
              label="메인 카피 (20자 이내)"
              value={s01.main}
              onChange={v => setS01(p => ({ ...p, main: v }))}
              placeholder="예: 지금 떠나야 할 이유가 여기 있습니다"
            />
            {s01Status === "done" && s01.main && (
              <div className="mt-3 bg-gray-900 text-white rounded-xl px-5 py-4 text-center">
                <p className="text-xs text-gray-400 mb-1">{s01.sub}</p>
                <p className="text-lg font-bold">{s01.main}</p>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* ── S02 단독 혜택 ── */}
      <SectionCard id="S02" label="마이리얼트립 단독 혜택" badge="고정" status="done">
        <div className="space-y-2">
          {s02.map(b => {
            const info = FIXED_BENEFITS[b.key];
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setS02(prev => prev.map(x => x.key === b.key ? { ...x, enabled: !x.enabled } : x))}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                  b.enabled ? "border-blue-400 bg-blue-50" : "border-gray-200 opacity-50"
                }`}
              >
                <span className={`w-4 h-4 rounded text-xs flex items-center justify-center font-bold flex-shrink-0 ${b.enabled ? "bg-blue-600 text-white" : "bg-gray-300 text-white"}`}>
                  {b.enabled ? "✓" : "—"}
                </span>
                <span className="text-sm font-medium text-gray-800 flex-1">
                  {info.title}
                  {info.valueLabel && <span className="ml-2 text-blue-600 font-bold text-xs">{info.valueLabel}</span>}
                </span>
                <span className="text-xs text-gray-400">{info.description}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-3">* S02는 편집 화면에서 토글만 가능, 내용 수정 불가</p>
      </SectionCard>

      {/* ── S03 상품 개요 ── */}
      <SectionCard id="S03" label="상품 개요" status={s03Status}>
        {s03Status === "idle" && (
          <p className="text-sm text-gray-400 text-center py-4">S01 완료 후 자동 시작됩니다</p>
        )}
        {s03Status === "generating" && (
          <div className="py-6 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-blue-600">상품 개요 카피를 작성하고 있습니다…</p>
          </div>
        )}
        {(s03Status === "done" || s03Status === "error") && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <EditField
                label="섹션 태그 (10자 이내)"
                value={s03.sectionTag}
                onChange={v => setS03(p => ({ ...p, sectionTag: v }))}
                placeholder="예: 이런 크루즈"
              />
              <EditField
                label="섹션 제목 (20자 이내)"
                value={s03.sectionTitle}
                onChange={v => setS03(p => ({ ...p, sectionTitle: v }))}
                placeholder="예: 알래스카의 진짜 매력"
              />
            </div>
            <EditField
              label="서브 카피 (40자 이내)"
              value={s03.subCopy}
              onChange={v => setS03(p => ({ ...p, subCopy: v }))}
              placeholder="예: 빙하와 야생, 자연이 살아있는 크루즈 여행"
            />
          </div>
        )}
      </SectionCard>

      {/* ── S04 선박 스펙 ── */}
      <SectionCard id="S04" label="선박 스펙 & 소개" status={s04Status}>
        {s04Status === "idle" && (
          <p className="text-sm text-gray-400 text-center py-4">S03 완료 후 자동 시작됩니다</p>
        )}
        {s04Status === "generating" && (
          <div className="py-6 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-blue-600">선박 소개문을 작성하고 있습니다…</p>
          </div>
        )}
        {(s04Status === "done" || s04Status === "error") && (
          <div className="space-y-5">
            <EditField
              label="선박 소개 (두 단락)"
              value={s04.shipDescription}
              onChange={v => setS04({ shipDescription: v })}
              multiline
              placeholder="선사 소개 단락&#10;&#10;선박 소개 단락"
            />
            {/* 스펙 테이블 — 수기 입력 */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">선박 스펙 테이블 <span className="text-gray-400">(직접 입력)</span></p>
              <SpecTableInput />
            </div>
          </div>
        )}
      </SectionCard>

      {/* Phase B 시작 버튼 */}
      <div className={`pt-4 transition-opacity ${allDone ? "opacity-100" : "opacity-30 pointer-events-none"}`}>
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-gray-700 mb-1">S01~S04 생성 완료!</p>
          <p className="text-xs text-gray-500 mb-4">
            내용을 확인하고 수정한 뒤, S05~S07 (캐빈·시설·기항지) 입력을 시작하세요
          </p>
          <button
            onClick={handleNext}
            disabled={!allDone}
            className="bg-blue-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-sm text-sm"
          >
            Phase B 시작 → 캐빈 · 시설 · 기항지 입력
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 선박 스펙 테이블 (수기 입력) ──────────────────────────────
type SpecRow = { label: string; value: string };

const DEFAULT_SPECS: SpecRow[] = [
  { label: "취항 연도",   value: "" },
  { label: "총 톤수",     value: "" },
  { label: "전장",        value: "" },
  { label: "승객 정원",   value: "" },
  { label: "승무원 수",   value: "" },
  { label: "갑판 수",     value: "" },
];

function SpecTableInput() {
  const [specs, setSpecs] = useState<SpecRow[]>(DEFAULT_SPECS);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {specs.map((row, i) => (
        <div key={i} className={`flex items-center ${i < specs.length - 1 ? "border-b border-gray-100" : ""}`}>
          <span className="w-28 flex-shrink-0 px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 border-r border-gray-100">
            {row.label}
          </span>
          <input
            type="text"
            value={row.value}
            onChange={e => setSpecs(prev => prev.map((r, j) => j === i ? { ...r, value: e.target.value } : r))}
            placeholder="직접 입력"
            className="flex-1 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:bg-blue-50 transition-colors"
          />
        </div>
      ))}
    </div>
  );
}
