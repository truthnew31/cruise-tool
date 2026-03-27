"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewProductPage() {
  const router = useRouter();

  // state: 버튼 활성화 여부 표시용
  const [shippingLine, setShippingLine] = useState("");
  const [shipName,     setShipName]     = useState("");
  const [region,       setRegion]       = useState("");

  // ref: 실제 제출 시 DOM에서 직접 읽음 (한국어 IME 이슈 우회)
  const refLine   = useRef<HTMLInputElement>(null);
  const refShip   = useRef<HTMLInputElement>(null);
  const refRegion = useRef<HTMLInputElement>(null);

  const isReady = shippingLine.trim() && shipName.trim() && region.trim();

  function handleGo() {
    // DOM에서 직접 읽어 IME 미완성 문자도 반영
    const sl = refLine.current?.value.trim()   || shippingLine.trim();
    const sn = refShip.current?.value.trim()   || shipName.trim();
    const r  = refRegion.current?.value.trim() || region.trim();
    if (!sl || !sn || !r) return;
    const id = `cruise_${Date.now()}`;
    const params = new URLSearchParams({ shippingLine: sl, shipName: sn, region: r });
    router.push(`/edit/${id}?${params.toString()}`);
  }

  const inputClass = "w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const syncState  = (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) =>
      setter((e.target as HTMLInputElement).value);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← 홈</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-1">크루즈 상세페이지 자동화</h1>
          <p className="text-sm text-gray-500">선사·선박·항로를 입력하면 AI가 전체 섹션을 자동으로 작성합니다</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">선사명</label>
            <input
              ref={refLine}
              type="text"
              value={shippingLine}
              onChange={syncState(setShippingLine)}
              onInput={syncState(setShippingLine)}
              onCompositionEnd={syncState(setShippingLine)}
              placeholder="예: Norwegian Cruise Line"
              className={inputClass}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">선박명</label>
            <input
              ref={refShip}
              type="text"
              value={shipName}
              onChange={syncState(setShipName)}
              onInput={syncState(setShipName)}
              onCompositionEnd={syncState(setShipName)}
              placeholder="예: Norwegian Encore"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">항로 / 코스</label>
            <input
              ref={refRegion}
              type="text"
              value={region}
              onChange={syncState(setRegion)}
              onInput={syncState(setRegion)}
              onCompositionEnd={syncState(setRegion)}
              placeholder="예: 알래스카 7박 8일 (시애틀 출발)"
              className={inputClass}
            />
          </div>

          <button
            type="button"
            onClick={handleGo}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all mt-2 ${
              isReady
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm cursor-pointer"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {isReady ? "AI 자동 생성 시작 →" : "선사·선박·항로를 모두 입력하세요"}
          </button>
        </div>
      </div>
    </div>
  );
}
