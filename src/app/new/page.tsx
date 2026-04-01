"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ProductType = "cruise" | "tour";

export default function NewProductPage() {
  const router = useRouter();

  const [productType, setProductType] = useState<ProductType>("cruise");

  // 크루즈 fields
  const [shippingLine, setShippingLine] = useState("");
  const [shipName,     setShipName]     = useState("");
  const [region,       setRegion]       = useState("");

  // 투어 fields
  const [productName, setProductName] = useState("");
  const [tourRegion,  setTourRegion]  = useState("");
  const [duration,    setDuration]    = useState("");

  const refLine        = useRef<HTMLInputElement>(null);
  const refShip        = useRef<HTMLInputElement>(null);
  const refRegion      = useRef<HTMLInputElement>(null);
  const refProductName = useRef<HTMLInputElement>(null);
  const refTourRegion  = useRef<HTMLInputElement>(null);
  const refDuration    = useRef<HTMLInputElement>(null);

  const isCruiseReady = productType === "cruise" && shippingLine.trim() && shipName.trim() && region.trim();
  const isTourReady   = productType === "tour"   && productName.trim() && tourRegion.trim() && duration.trim();
  const isReady       = isCruiseReady || isTourReady;

  function handleGo() {
    if (productType === "cruise") {
      const sl = refLine.current?.value.trim()   || shippingLine.trim();
      const sn = refShip.current?.value.trim()   || shipName.trim();
      const r  = refRegion.current?.value.trim() || region.trim();
      if (!sl || !sn || !r) return;
      const id = `cruise_${Date.now()}`;
      const params = new URLSearchParams({ shippingLine: sl, shipName: sn, region: r });
      router.push(`/edit/${id}?${params.toString()}`);
    } else {
      const pn = refProductName.current?.value.trim() || productName.trim();
      const tr = refTourRegion.current?.value.trim()  || tourRegion.trim();
      const du = refDuration.current?.value.trim()    || duration.trim();
      if (!pn || !tr || !du) return;
      const id = `tour_${Date.now()}`;
      const params = new URLSearchParams({ productName: pn, region: tr, duration: du });
      router.push(`/edit-tour/${id}?${params.toString()}`);
    }
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
          <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-1">상세페이지 자동화</h1>
          <p className="text-sm text-gray-500">상품 유형을 선택하고 정보를 입력하면 AI가 자동으로 작성합니다</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-6">

          {/* 상품 유형 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2.5">상품 유형</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setProductType("cruise")}
                className={`flex flex-col items-center gap-1.5 py-4 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  productType === "cruise"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                }`}
              >
                <span className="text-2xl">🚢</span>
                <span>크루즈 상품</span>
              </button>
              <button
                type="button"
                onClick={() => setProductType("tour")}
                className={`flex flex-col items-center gap-1.5 py-4 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  productType === "tour"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                }`}
              >
                <span className="text-2xl">✈️</span>
                <span>일반 투어 상품</span>
              </button>
            </div>
          </div>

          {/* 크루즈 입력 폼 */}
          {productType === "cruise" && (
            <div className="space-y-4">
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
            </div>
          )}

          {/* 투어 입력 폼 */}
          {productType === "tour" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">상품명</label>
                <input
                  ref={refProductName}
                  type="text"
                  value={productName}
                  onChange={syncState(setProductName)}
                  onInput={syncState(setProductName)}
                  onCompositionEnd={syncState(setProductName)}
                  placeholder="예: 스위스 융프라우 완전정복 패키지"
                  className={inputClass}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">여행지 / 지역</label>
                <input
                  ref={refTourRegion}
                  type="text"
                  value={tourRegion}
                  onChange={syncState(setTourRegion)}
                  onInput={syncState(setTourRegion)}
                  onCompositionEnd={syncState(setTourRegion)}
                  placeholder="예: 스위스 (취리히·루체른·인터라켄)"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">기간</label>
                <input
                  ref={refDuration}
                  type="text"
                  value={duration}
                  onChange={syncState(setDuration)}
                  onInput={syncState(setDuration)}
                  onCompositionEnd={syncState(setDuration)}
                  placeholder="예: 7박 8일"
                  className={inputClass}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleGo}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
              isReady
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm cursor-pointer"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {isReady ? "AI 자동 생성 시작 →" : "정보를 모두 입력하세요"}
          </button>
        </div>
      </div>
    </div>
  );
}
