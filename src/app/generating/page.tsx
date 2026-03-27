"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

type ProgressEvent = {
  step: string;
  label: string;
  pct: number;
};

type StepStatus = "pending" | "running" | "done" | "error";

const STEPS = [
  { id: "scrape",    label: "URL 스크래핑" },
  { id: "S01",       label: "인트로 카피 생성" },
  { id: "S03",       label: "상품 개요 카피 생성" },
  { id: "S04",       label: "선박 소개 카피 생성" },
  { id: "S07",       label: "기항지 카피 생성" },
  { id: "S08",       label: "마무리 카피 생성" },
  { id: "facilities",label: "시설 요금 태그 파싱" },
  { id: "save",      label: "Supabase 저장" },
];

function GeneratingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pct, setPct] = useState(0);
  const [currentLabel, setCurrentLabel] = useState("시작 중…");
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>(
    Object.fromEntries(STEPS.map((s) => [s.id, "pending"]))
  );
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const shippingLine = searchParams.get("shippingLine") ?? "";
  const shipName     = searchParams.get("shipName") ?? "";
  const region       = searchParams.get("region") ?? "";
  const urlsParam    = searchParams.get("urls") ?? "{}";
  const benefitsParam = searchParams.get("benefits") ?? "[]";

  function setStep(id: string, status: StepStatus) {
    setStepStatuses((prev) => ({ ...prev, [id]: status }));
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function run() {
      try {
        const urls = JSON.parse(decodeURIComponent(urlsParam));
        const benefits = JSON.parse(decodeURIComponent(benefitsParam));

        // 1. 스크래핑
        setStep("scrape", "running");
        setPct(5); setCurrentLabel("URL 스크래핑 중…");
        let scrapedTexts: Record<string, string> = {};
        try {
          const scrapeRes = await fetch("/api/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ urls }),
          });
          scrapedTexts = await scrapeRes.json();
          setStep("scrape", "done");
        } catch {
          setStep("scrape", "error");
          scrapedTexts = {};
        }

        // 2. 시설 요금 파싱
        setStep("facilities", "running");
        let facilities: unknown[] = [];
        if (scrapedTexts.facilityText) {
          try {
            const facRes = await fetch("/api/parse-facilities", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ facilityText: scrapedTexts.facilityText }),
            });
            const facData = await facRes.json();
            facilities = facData.facilities ?? [];
            setStep("facilities", "done");
          } catch {
            setStep("facilities", "error");
          }
        } else {
          setStep("facilities", "done");
        }

        // 3. Claude API SSE 스트리밍
        const generateRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shippingLine, shipName, region,
            scrapedTexts, ports: [],
          }),
        });

        if (!generateRes.body) throw new Error("SSE 응답 없음");

        const reader = generateRes.body.getReader();
        const decoder = new TextDecoder();
        const sectionResults: Record<string, unknown> = {};
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          let event = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) event = line.slice(7).trim();
            if (line.startsWith("data: ")) {
              const data = JSON.parse(line.slice(6));
              if (event === "progress") {
                const p = data as ProgressEvent;
                setPct(p.pct);
                setCurrentLabel(p.label);
                if (p.step !== "done") setStep(p.step, "running");
              } else if (event === "result") {
                sectionResults[data.section] = data.data;
                setStep(data.section, "done");
              } else if (event === "error") {
                throw new Error(data.message);
              }
            }
          }
        }

        // 4. 저장 (향후 Supabase 연동)
        setStep("save", "running");
        setPct(95); setCurrentLabel("저장 중…");
        const productId = `cruise_${Date.now()}`;
        // TODO: Supabase 저장
        setStep("save", "done");
        setPct(100); setCurrentLabel("완료!");

        // 5. 편집 페이지로 이동 (쿼리로 데이터 전달 — 임시)
        const editParams = new URLSearchParams({
          shippingLine, shipName, region,
          sectionResults: encodeURIComponent(JSON.stringify(sectionResults)),
          facilities: encodeURIComponent(JSON.stringify(facilities)),
          benefits: benefitsParam,
        });
        router.push(`/edit/${productId}?${editParams.toString()}`);

      } catch (err) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류");
        setPct(0);
      }
    }

    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-md shadow-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-gray-900 mb-1">자동 생성 중</h1>
          <p className="text-sm text-gray-500">{currentLabel}</p>
        </div>

        {/* 진행 바 */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>진행률</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* 스텝 목록 */}
        <ul className="space-y-2">
          {STEPS.map((step) => {
            const status = stepStatuses[step.id];
            return (
              <li key={step.id} className="flex items-center gap-3 text-sm">
                <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                  {status === "done"    && <span className="text-green-500 font-bold">✓</span>}
                  {status === "running" && <span className="animate-spin text-blue-500">⟳</span>}
                  {status === "error"   && <span className="text-red-500">✕</span>}
                  {status === "pending" && <span className="w-2 h-2 rounded-full bg-gray-200 mx-auto" />}
                </span>
                <span className={
                  status === "done"    ? "text-gray-700" :
                  status === "running" ? "text-blue-600 font-medium" :
                  status === "error"   ? "text-red-500" :
                  "text-gray-400"
                }>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ul>

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm font-medium text-red-800 mb-1">오류 발생</p>
            <p className="text-xs text-red-600">{error}</p>
            <button
              onClick={() => router.back()}
              className="mt-3 text-xs text-red-700 underline"
            >
              ← 돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GeneratingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">로딩 중…</div>}>
      <GeneratingContent />
    </Suspense>
  );
}
