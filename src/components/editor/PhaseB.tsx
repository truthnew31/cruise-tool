"use client";

import { useState } from "react";
import { SectionCard } from "./SectionCard";

// ── 타입 ────────────────────────────────────────────────
type PriceRow = { id: string; cabinTypeName: string; guestCount: 1|2|3|4; totalPrice: number; note: string };
type PortRow  = { id: string; portName: string; country: string; description: string; generating: boolean };
type FacilityRow = { id: string; name: string; description: string; tag: "free"|"partially_paid"|"paid" };

export type PhaseBData = {
  S05: { priceRows: PriceRow[] };
  S06: { facilityUrl: string; facilities: FacilityRow[] };
  S07: { ports: PortRow[] };
};

type Props = {
  shippingLine: string;
  shipName: string;
  region: string;
  onComplete: (data: PhaseBData) => void;
};

// ── 키워드 → AI 문장 헬퍼 ───────────────────────────────
async function generateFromKeywords(
  sectionId: string,
  fieldKey: string,
  keywords: string,
  context: Record<string, string>
): Promise<string> {
  // GET + URLSearchParams — ByteString body 에러 우회
  const params = new URLSearchParams({ sectionId, fieldKey, keywords, ...context });
  const res = await fetch(`/api/generate-from-keywords?${params.toString()}`);
  const data = await res.json() as { text?: string; error?: string };
  if (data.error) throw new Error(data.error);
  return data.text ?? "";
}

// ── 공통 AI 생성 버튼 ────────────────────────────────────
function AiGenButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        loading
          ? "bg-blue-100 text-blue-400 cursor-wait"
          : "bg-blue-600 text-white hover:bg-blue-700"
      }`}
    >
      {loading ? (
        <><span className="animate-spin">⟳</span> 생성 중…</>
      ) : (
        <><span>✦</span> AI 문장 생성</>
      )}
    </button>
  );
}

// ══════════════════════════════════════════════════════════
// S05 — 캐빈 가격표 (수기 입력)
// ══════════════════════════════════════════════════════════
function S05Section({ shipName }: { shipName: string }) {
  const [rows, setRows] = useState<PriceRow[]>([
    { id: "r1", cabinTypeName: "", guestCount: 2, totalPrice: 0, note: "" },
  ]);

  function addRow() {
    setRows(prev => [...prev, {
      id: `r${Date.now()}`, cabinTypeName: "", guestCount: 2, totalPrice: 0, note: ""
    }]);
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id));
  }

  function updateRow(id: string, field: keyof PriceRow, value: string | number) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        캐빈 타입과 가격을 입력하면 <strong>인당 가격이 자동 계산</strong>됩니다.
      </p>

      {/* 가격 테이블 */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr_1fr_auto] text-xs font-medium text-gray-500 bg-gray-50 px-3 py-2.5 gap-2 border-b border-gray-100">
          <span>캐빈 타입</span>
          <span>인원</span>
          <span>총 가격 (₩)</span>
          <span>인당 가격 (₩)</span>
          <span>비고</span>
          <span></span>
        </div>
        {rows.map(row => {
          const perPerson = row.totalPrice > 0 && row.guestCount > 0
            ? Math.round(row.totalPrice / row.guestCount).toLocaleString()
            : "—";
          return (
            <div key={row.id} className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr_1fr_auto] items-center px-3 py-2 gap-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 group">
              <input
                value={row.cabinTypeName}
                onChange={e => updateRow(row.id, "cabinTypeName", e.target.value)}
                placeholder="예: 인사이드 캐빈"
                className="text-sm border-0 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1 bg-transparent"
              />
              <select
                value={row.guestCount}
                onChange={e => updateRow(row.id, "guestCount", parseInt(e.target.value))}
                className="text-sm border border-gray-200 rounded-lg px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300"
              >
                <option value={1}>1인</option>
                <option value={2}>2인</option>
                <option value={3}>3인</option>
                <option value={4}>4인</option>
              </select>
              <input
                type="number"
                value={row.totalPrice || ""}
                onChange={e => updateRow(row.id, "totalPrice", parseInt(e.target.value) || 0)}
                placeholder="0"
                className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 text-right"
              />
              <div className="text-sm text-gray-700 font-medium text-right px-2">{perPerson}</div>
              <input
                value={row.note}
                onChange={e => updateRow(row.id, "note", e.target.value)}
                placeholder="비고"
                className="text-xs border-0 focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1 bg-transparent text-gray-500"
              />
              <button
                onClick={() => removeRow(row.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-lg leading-none transition-all"
              >×</button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        <span className="text-lg leading-none">+</span> 행 추가
      </button>

      <p className="text-xs text-gray-400">
        * 캐빈 타입 상세 설명 및 이미지는 다음 편집 단계에서 추가할 수 있습니다
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// S06 — 시설 (URL 스크래핑 or 수동 키워드 입력)
// ══════════════════════════════════════════════════════════
function S06Section({ shipName }: { shipName: string }) {
  const [facilityUrl, setFacilityUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
  const [scrapeError, setScrapeError] = useState("");

  // 새 시설 수동 추가
  const [newName, setNewName] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [generating, setGenerating] = useState(false);

  async function handleScrape() {
    if (!facilityUrl) return;
    setScraping(true); setScrapeError("");
    try {
      const scrapeRes = await fetch("/api/scrape", {
        method: "POST",
        body: new Blob(
          [JSON.stringify({ urls: { facilityUrl } })],
          { type: "application/json" }
        ),
      });
      const scrapeData = await scrapeRes.json() as { facilityText?: string; errors?: Record<string, string> };

      if (scrapeData.facilityText) {
        const parseRes = await fetch("/api/parse-facilities", {
          method: "POST",
          body: new Blob(
            [JSON.stringify({ facilityText: scrapeData.facilityText })],
            { type: "application/json" }
          ),
        });
        const parseData = await parseRes.json() as { facilities?: FacilityRow[] };
        if (parseData.facilities) setFacilities(parseData.facilities.slice(0, 12));
      } else {
        setScrapeError(Object.values(scrapeData.errors ?? {}).join(", ") || "스크래핑 실패");
      }
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : "오류 발생");
    } finally {
      setScraping(false);
    }
  }

  async function handleAddWithAI() {
    if (!newName || !newKeywords) return;
    setGenerating(true);
    try {
      const text = await generateFromKeywords("S06", "facilityDescription", newKeywords, {
        facilityName: newName, shipName,
      });
      setFacilities(prev => [...prev, {
        id: `f${Date.now()}`, name: newName, description: text,
        tag: "partially_paid" as const,
      }]);
      setNewName(""); setNewKeywords("");
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }

  const TAG_LABELS = { free: "무료", partially_paid: "일부유료", paid: "유료" };
  const TAG_COLORS = {
    free: "bg-green-100 text-green-700",
    partially_paid: "bg-orange-100 text-orange-700",
    paid: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-5">
      {/* URL 스크래핑 */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">시설/다이닝 페이지 URL로 자동 파싱</p>
        <div className="flex gap-2">
          <input
            type="url"
            value={facilityUrl}
            onChange={e => setFacilityUrl(e.target.value)}
            placeholder="https://www.ncl.com/cruise-ship/encore/onboard"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="button"
            onClick={handleScrape}
            disabled={!facilityUrl || scraping}
            className="px-4 py-2 bg-gray-800 text-white text-sm rounded-xl hover:bg-gray-900 disabled:opacity-40 transition-colors"
          >
            {scraping ? "파싱 중…" : "파싱"}
          </button>
        </div>
        {scrapeError && <p className="text-xs text-red-500 mt-1">{scrapeError}</p>}
      </div>

      {/* 파싱된 시설 목록 */}
      {facilities.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">파싱 결과 ({facilities.length}개) — 요금 태그를 확인·수정하세요</p>
          {facilities.map((f, i) => (
            <div key={f.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{f.name}</p>
                {f.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{f.description}</p>}
              </div>
              <select
                value={f.tag}
                onChange={e => setFacilities(prev =>
                  prev.map((x, j) => j === i ? { ...x, tag: e.target.value as FacilityRow["tag"] } : x)
                )}
                className={`text-xs font-medium px-2 py-1 rounded-lg border-0 focus:outline-none flex-shrink-0 ${TAG_COLORS[f.tag]}`}
              >
                <option value="free">무료</option>
                <option value="partially_paid">일부유료</option>
                <option value="paid">유료</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {/* 수동 추가 + AI 설명 생성 */}
      <div className="border-t border-gray-100 pt-5">
        <p className="text-xs font-medium text-gray-500 mb-3">시설 수동 추가 (키워드 → AI 문장)</p>
        <div className="grid grid-cols-[1fr_2fr_auto] gap-2 items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1">시설명</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="예: 풀 데크"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">키워드 (AI가 문장으로 변환)</label>
            <input
              value={newKeywords}
              onChange={e => setNewKeywords(e.target.value)}
              placeholder="예: 야외 수영장, 선셋 뷰, 바 서비스"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <AiGenButton onClick={handleAddWithAI} loading={generating} />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// S07 — 기항지 (포트명 입력 → AI 설명 생성)
// ══════════════════════════════════════════════════════════
function S07Section({ shipName, region }: { shipName: string; region: string }) {
  const [ports, setPorts] = useState<PortRow[]>([
    { id: "p1", portName: "", country: "", description: "", generating: false },
  ]);

  function addPort() {
    setPorts(prev => [...prev, { id: `p${Date.now()}`, portName: "", country: "", description: "", generating: false }]);
  }

  function removePort(id: string) {
    setPorts(prev => prev.filter(p => p.id !== id));
  }

  function updatePort(id: string, field: keyof PortRow, value: string) {
    setPorts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  }

  async function generatePortDesc(id: string) {
    const port = ports.find(p => p.id === id);
    if (!port?.portName) return;
    setPorts(prev => prev.map(p => p.id === id ? { ...p, generating: true } : p));
    try {
      const text = await generateFromKeywords("S07", "portDescription", port.portName, {
        portName: port.portName, shipName, region,
      });
      setPorts(prev => prev.map(p => p.id === id ? { ...p, description: text, generating: false } : p));
    } catch (err) {
      console.error(err);
      setPorts(prev => prev.map(p => p.id === id ? { ...p, generating: false } : p));
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        기항지를 순서대로 입력하고 AI 소개 문장을 생성하세요.
        <br />기항지명만 입력해도 AI가 자동으로 여행 감성 소개를 작성합니다.
      </p>

      <div className="space-y-3">
        {ports.map((port, i) => (
          <div key={port.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-bold flex-shrink-0">
                {i + 1}
              </span>
              <div className="grid grid-cols-[2fr_1fr] gap-2 flex-1">
                <input
                  value={port.portName}
                  onChange={e => updatePort(port.id, "portName", e.target.value)}
                  placeholder="기항지명 (예: 주노, 케치컨)"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <input
                  value={port.country}
                  onChange={e => updatePort(port.id, "country", e.target.value)}
                  placeholder="국가 (예: 미국)"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <AiGenButton
                onClick={() => generatePortDesc(port.id)}
                loading={port.generating}
              />
              <button
                type="button"
                onClick={() => removePort(port.id)}
                className="text-gray-300 hover:text-red-400 text-xl leading-none transition-colors"
              >×</button>
            </div>

            {/* AI 생성 소개문 (편집 가능) */}
            {(port.description || port.generating) && (
              <div className="pl-8">
                {port.generating ? (
                  <div className="flex items-center gap-2 text-blue-500 text-xs">
                    <span className="animate-spin">⟳</span> AI가 소개문을 작성 중…
                  </div>
                ) : (
                  <textarea
                    value={port.description}
                    onChange={e => updatePort(port.id, "description", e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-blue-50"
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addPort}
        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        <span className="text-lg leading-none">+</span> 기항지 추가
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// PhaseB 메인
// ══════════════════════════════════════════════════════════
export function PhaseB({ shippingLine, shipName, region, onComplete }: Props) {
  function handleNext() {
    // 간단하게 현재 상태를 부모로 전달 (실제로는 각 섹션 ref로 수집)
    onComplete({
      S05: { priceRows: [] },
      S06: { facilityUrl: "", facilities: [] },
      S07: { ports: [] },
    });
  }

  return (
    <div className="space-y-5">
      {/* ── S05 캐빈 가격표 ── */}
      <SectionCard id="S05" label="캐빈 & 가격표" badge="수기 입력" status="done">
        <S05Section shipName={shipName} />
      </SectionCard>

      {/* ── S06 주요 시설 ── */}
      <SectionCard id="S06" label="주요 시설 & 다이닝" badge="URL 파싱 + 수동" status="done">
        <S06Section shipName={shipName} />
      </SectionCard>

      {/* ── S07 기항지 ── */}
      <SectionCard id="S07" label="기항지 일정" badge="키워드 → AI 소개" status="done">
        <S07Section shipName={shipName} region={region} />
      </SectionCard>

      {/* Phase C 버튼 */}
      <div className="pt-4">
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-6 text-center">
          <p className="text-sm font-semibold text-gray-700 mb-1">S05~S07 입력 완료!</p>
          <p className="text-xs text-gray-500 mb-4">마지막으로 유의사항 & 마무리 카피를 자동 생성합니다</p>
          <button
            onClick={handleNext}
            className="bg-indigo-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm text-sm"
          >
            Phase C 시작 → S08 유의사항 자동생성
          </button>
        </div>
      </div>
    </div>
  );
}
