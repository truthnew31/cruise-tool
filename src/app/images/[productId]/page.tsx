"use client";

import { use, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ImageStore } from "@/types/images";

// ── 섹션 슬롯 정의 ───────────────────────────────────────────
type SlotDef = { key: string; label: string; section: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSlots(data: any): SlotDef[] {
  const slots: SlotDef[] = [
    { key: "s01Hero",    label: "S01 — 배경 이미지",   section: "S01" },
    { key: "s03_0",      label: "S03 — 하이라이트 ①", section: "S03" },
    { key: "s03_1",      label: "S03 — 하이라이트 ②", section: "S03" },
    { key: "s03_2",      label: "S03 — 하이라이트 ③", section: "S03" },
    { key: "s03_3",      label: "S03 — 하이라이트 ④", section: "S03" },
    { key: "s04Ship",    label: "S04 — 선박 사진",     section: "S04" },
  ];
  (data?.S05?.cabinTypes ?? []).forEach((c: { name: string }, i: number) => {
    slots.push({ key: `s05_${i}`, label: `S05 — ${c.name}`, section: "S05" });
  });
  (data?.S06?.mainFacilities ?? []).forEach((f: { name: string }, i: number) => {
    slots.push({ key: `s06m_${i}`, label: `S06 — ${f.name || `주요시설 ${i+1}`}`, section: "S06" });
  });
  (data?.S06?.kidsFacilities ?? []).forEach((f: { name: string }, i: number) => {
    slots.push({ key: `s06k_${i}`, label: `S06 — ${f.name || `어린이시설 ${i+1}`}`, section: "S06" });
  });
  (data?.S06?.dining ?? []).forEach((f: { name: string }, i: number) => {
    slots.push({ key: `s06d_${i}`, label: `S06 — ${f.name || `다이닝 ${i+1}`}`, section: "S06" });
  });
  (data?.S07?.ports ?? []).forEach((p: { name: string }, i: number) => {
    slots.push({ key: `s07_${i}`, label: `S07 — ${p.name || `기항지 ${i+1}`}`, section: "S07" });
  });
  slots.push({ key: "s08Closing", label: "S08 — 클로징 이미지", section: "S08" });
  return slots;
}

// slotKey → ImageStore에 실제 값 읽기/쓰기
function getSlotValue(images: ImageStore, key: string): string | undefined {
  if (key === "s01Hero")   return images.s01Hero;
  if (key === "s04Ship")   return images.s04Ship;
  if (key === "s08Closing") return images.s08Closing;
  if (key.startsWith("s03_")) return images.s03Highlights?.[+key.slice(4)];
  if (key.startsWith("s05_")) return images.s05Cabins?.[+key.slice(4)]?.photo;
  if (key.startsWith("s06m_")) return images.s06Main?.[+key.slice(5)];
  if (key.startsWith("s06k_")) return images.s06Kids?.[+key.slice(5)];
  if (key.startsWith("s06d_")) return images.s06Dining?.[+key.slice(5)];
  if (key.startsWith("s07_")) return images.s07Ports?.[+key.slice(4)];
  return undefined;
}

function setSlotValue(images: ImageStore, key: string, url: string): ImageStore {
  const im = { ...images };
  if (key === "s01Hero")   { im.s01Hero = url; return im; }
  if (key === "s04Ship")   { im.s04Ship = url; return im; }
  if (key === "s08Closing") { im.s08Closing = url; return im; }
  if (key.startsWith("s03_")) {
    const arr = [...(im.s03Highlights ?? [])]; arr[+key.slice(4)] = url;
    im.s03Highlights = arr; return im;
  }
  if (key.startsWith("s05_")) {
    const arr = [...(im.s05Cabins ?? [])]; const i = +key.slice(4);
    arr[i] = { ...(arr[i] ?? {}), photo: url }; im.s05Cabins = arr; return im;
  }
  if (key.startsWith("s06m_")) {
    const arr = [...(im.s06Main ?? [])]; arr[+key.slice(5)] = url; im.s06Main = arr; return im;
  }
  if (key.startsWith("s06k_")) {
    const arr = [...(im.s06Kids ?? [])]; arr[+key.slice(5)] = url; im.s06Kids = arr; return im;
  }
  if (key.startsWith("s06d_")) {
    const arr = [...(im.s06Dining ?? [])]; arr[+key.slice(5)] = url; im.s06Dining = arr; return im;
  }
  if (key.startsWith("s07_")) {
    const arr = [...(im.s07Ports ?? [])]; arr[+key.slice(4)] = url; im.s07Ports = arr; return im;
  }
  return im;
}

// ── 이미지 삽입 페이지 ────────────────────────────────────────
function ImagesContent({ productId }: { productId: string }) {
  const sp           = useSearchParams();
  const router       = useRouter();
  const shippingLine = sp.get("shippingLine") ?? "";
  const shipName     = sp.get("shipName")     ?? "";
  const region       = sp.get("region")       ?? "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data,   setData]   = useState<any>(null);
  const [images, setImages] = useState<ImageStore>({});
  const [pool,   setPool]   = useState<string[]>([]); // 업로드된 이미지 풀
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  // localStorage에서 데이터 로드
  useEffect(() => {
    const saved = localStorage.getItem(`cruise_output_${productId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.data)   setData(parsed.data);
      if (parsed.images) setImages(parsed.images);
    }
  }, [productId]);

  const slots = buildSlots(data);

  // 파일 업로드 → 풀에 추가
  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const url = e.target?.result as string;
        setPool(prev => (prev.includes(url) ? prev : [...prev, url]));
      };
      reader.readAsDataURL(file);
    });
  }

  // 드래그 앤 드롭 — 풀 이미지 → 슬롯
  function handleDrop(slotKey: string, e: React.DragEvent) {
    e.preventDefault();
    const url = e.dataTransfer.getData("text/plain");
    if (url) setImages(im => setSlotValue(im, slotKey, url));
    setDragOver(null);
  }

  // 드롭존 이벤트 (외부 파일 드롭)
  function handlePoolDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  // 저장 후 출력 이동
  async function handleFinish() {
    setSaving(true);
    const stored = localStorage.getItem(`cruise_output_${productId}`);
    const parsed = stored ? JSON.parse(stored) : {};
    const updated = { ...parsed, images };
    localStorage.setItem(`cruise_output_${productId}`, JSON.stringify(updated));
    // DB 저장
    await fetch(`/api/products/${productId}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: productId, shippingLine, shipName, region, ...updated }),
    }).catch(() => {});
    setSaving(false);
    const params = new URLSearchParams({ shippingLine, shipName, region });
    router.push(`/output/${productId}?${params.toString()}`);
  }

  const SECTION_COLORS: Record<string, string> = {
    S01: "bg-blue-50 border-blue-200",
    S03: "bg-emerald-50 border-emerald-200",
    S04: "bg-violet-50 border-violet-200",
    S05: "bg-orange-50 border-orange-200",
    S06: "bg-pink-50 border-pink-200",
    S07: "bg-cyan-50 border-cyan-200",
    S08: "bg-rose-50 border-rose-200",
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/edit/${productId}?shippingLine=${encodeURIComponent(shippingLine)}&shipName=${encodeURIComponent(shipName)}&region=${encodeURIComponent(region)}&fromDB=1`}
              className="text-gray-400 hover:text-gray-600 text-sm">← 편집으로</Link>
            <span className="text-gray-300">/</span>
            <p className="text-sm font-semibold text-gray-900">이미지 삽입 — {shippingLine} · {shipName}</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-400">이미지를 업로드하고 각 섹션 슬롯에 드래그하세요</p>
            <button onClick={handleFinish} disabled={saving}
              className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? "저장 중…" : "출력 화면으로 →"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── 좌: 이미지 업로드 풀 ── */}
        <div className="w-64 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-600 mb-3">이미지 업로드</p>
            {/* 드롭존 */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handlePoolDrop}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors">
              <p className="text-2xl mb-1">📁</p>
              <p className="text-xs text-gray-400">클릭하거나 파일을 드롭</p>
              <p className="text-[10px] text-gray-300 mt-0.5">여러 장 동시 선택 가능</p>
            </div>
            <input ref={fileRef} type="file" multiple accept="image/*" className="hidden"
              onChange={e => handleFiles(e.target.files)} />
          </div>

          {/* 업로드된 이미지 목록 */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {pool.length === 0 && (
              <p className="text-xs text-gray-300 text-center mt-8">업로드된 이미지가 없습니다</p>
            )}
            {pool.map((url, i) => (
              <div key={i}
                draggable
                onDragStart={e => { e.dataTransfer.setData("text/plain", url); setDragging(url); }}
                onDragEnd={() => setDragging(null)}
                className={`relative rounded-xl overflow-hidden cursor-grab active:cursor-grabbing border-2 transition-all ${dragging === url ? "border-blue-400 opacity-60 scale-95" : "border-transparent hover:border-gray-300"}`}>
                <img src={url} alt="" className="w-full h-24 object-cover" />
                <button
                  onClick={e => { e.stopPropagation(); setPool(p => p.filter((_, j) => j !== i)); }}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/50 hover:bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center">
                  ×
                </button>
                <p className="text-[10px] text-gray-400 px-1.5 py-1 bg-white">드래그하여 배정</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 우: 섹션 슬롯 그리드 ── */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-3 gap-4">
            {slots.map(slot => {
              const current = getSlotValue(images, slot.key);
              const isOver  = dragOver === slot.key;
              return (
                <div key={slot.key}
                  onDragOver={e => { e.preventDefault(); setDragOver(slot.key); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => handleDrop(slot.key, e)}
                  className={`rounded-2xl border-2 overflow-hidden transition-all ${
                    isOver
                      ? "border-blue-400 bg-blue-50 scale-[1.02] shadow-lg"
                      : SECTION_COLORS[slot.section] ?? "bg-gray-50 border-gray-200"
                  }`}>
                  {/* 슬롯 레이블 */}
                  <div className="px-3 py-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-600 truncate">{slot.label}</p>
                    {current && (
                      <button onClick={() => setImages(im => setSlotValue(im, slot.key, ""))}
                        className="text-[10px] text-gray-300 hover:text-red-400 ml-1 flex-shrink-0">×</button>
                    )}
                  </div>
                  {/* 이미지 영역 */}
                  <div className="relative h-32 bg-white/60 mx-2 mb-2 rounded-xl overflow-hidden border border-white">
                    {current ? (
                      <img src={current} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                        <p className="text-xl opacity-30">🖼️</p>
                        <p className="text-[10px] text-gray-300">이미지를 드래그하거나</p>
                        <label className="text-[10px] text-blue-400 cursor-pointer hover:underline">
                          클릭하여 업로드
                          <input type="file" accept="image/*" className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = ev => {
                                const url = ev.target?.result as string;
                                setImages(im => setSlotValue(im, slot.key, url));
                              };
                              reader.readAsDataURL(file);
                              e.target.value = "";
                            }} />
                        </label>
                      </div>
                    )}
                    {isOver && !current && (
                      <div className="absolute inset-0 bg-blue-100/80 flex items-center justify-center">
                        <p className="text-sm font-bold text-blue-500">여기에 놓으세요</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── 진입점 ───────────────────────────────────────────────────
export default function ImagesPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params);
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ImagesContent productId={productId} />
    </Suspense>
  );
}
