"use client";

import { use, useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { TourData, TourSectionId } from "@/types/tour";
import TourDetailPreview from "@/components/TourDetailPreview";

// ── 공통 UI ─────────────────────────────────────────────────
function SectionCard({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-100 bg-gray-50">
        <span className="text-xs font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-md">{id}</span>
        <span className="text-sm font-semibold text-gray-800">{title}</span>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, rows = 1, placeholder = "" }: {
  label: string; value: string; onChange: (v: string) => void;
  rows?: number; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {rows > 1 ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
          className="w-full rounded-xl px-3.5 py-2.5 text-sm text-gray-800 border border-gray-200 bg-gray-50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full rounded-xl px-3.5 py-2.5 text-sm text-gray-800 border border-gray-200 bg-gray-50 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
      )}
    </div>
  );
}

// ── 섹션 순서 컨트롤 ─────────────────────────────────────────
function SectionOrderPanel({
  order, onChange,
}: {
  order: TourSectionId[];
  onChange: (o: TourSectionId[]) => void;
}) {
  const ALL: TourSectionId[] = ["S01", "S02", "S03", "S04", "S05"];
  const LABELS: Record<TourSectionId, string> = {
    S01: "히어로", S02: "요약", S03: "일정 및 코스", S04: "안내사항", S05: "FAQ",
  };

  function move(idx: number, dir: -1 | 1) {
    const o = [...order];
    const ni = idx + dir;
    if (ni < 0 || ni >= o.length) return;
    [o[idx], o[ni]] = [o[ni], o[idx]];
    onChange(o);
  }
  function toggle(id: TourSectionId) {
    if (id === "S01") return; // S01은 항상 고정
    if (order.includes(id)) {
      onChange(order.filter(s => s !== id));
    } else {
      onChange([...order, id]);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-100 bg-gray-50">
        <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md">섹션</span>
        <span className="text-sm font-semibold text-gray-800">섹션 순서 / 추가·삭제</span>
      </div>
      <div className="p-4 space-y-2">
        {/* 현재 순서 */}
        {order.map((id, idx) => (
          <div key={id} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <span className="text-xs font-bold text-blue-600 w-8">{id}</span>
            <span className="text-sm text-gray-700 flex-1">{LABELS[id]}</span>
            <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-lg leading-none">↑</button>
            <button onClick={() => move(idx, 1)} disabled={idx === order.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-lg leading-none">↓</button>
            {id !== "S01" && (
              <button onClick={() => toggle(id)} className="text-red-400 hover:text-red-600 text-xs ml-1">✕ 삭제</button>
            )}
          </div>
        ))}
        {/* 미사용 섹션 추가 */}
        {ALL.filter(id => !order.includes(id)).map(id => (
          <div key={id} className="flex items-center gap-2 bg-gray-50 border border-dashed border-gray-300 rounded-lg px-3 py-2 opacity-60">
            <span className="text-xs font-bold text-gray-400 w-8">{id}</span>
            <span className="text-sm text-gray-400 flex-1">{LABELS[id]}</span>
            <button onClick={() => toggle(id)} className="text-blue-500 hover:text-blue-700 text-xs ml-1">+ 추가</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 편집 페이지 본체 ─────────────────────────────────────────
function EditTourContent({ productId }: { productId: string }) {
  const sp          = useSearchParams();
  const router      = useRouter();
  const productName = sp.get("productName") ?? "";
  const region      = sp.get("region")      ?? "";
  const duration    = sp.get("duration")    ?? "";
  const fromDB      = sp.get("fromDB")      === "1";

  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [data,     setData]     = useState<TourData | null>(null);
  const [images,   setImages]   = useState<{ s01Hero?: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt,  setSavedAt]  = useState<string | null>(null);
  const [needsReview, setNeedsReview] = useState<string[]>([]);

  // ── 로드 ─────────────────────────────────────────────────
  useEffect(() => {
    if (fromDB) {
      fetch(`/api/products/${productId}`)
        .then(r => r.json())
        .then(res => {
          if (res.ok && res.product?.data) {
            setData(res.product.data as TourData);
            if (res.product.images) setImages(res.product.images);
          } else {
            setError("저장된 데이터를 불러올 수 없습니다");
          }
        })
        .catch(e => setError(String(e)))
        .finally(() => setLoading(false));
    } else {
      const params = new URLSearchParams({ productName, region, duration });
      fetch(`/api/generate-tour?${params.toString()}`)
        .then(r => r.json())
        .then(res => {
          if (res.ok) {
            setData(res.data as TourData);
            if (res.needsReview?.length > 0) setNeedsReview(res.needsReview);
          } else {
            setError(res.error ?? "알 수 없는 오류");
          }
        })
        .catch(e => setError(String(e)))
        .finally(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 저장 ─────────────────────────────────────────────────
  async function saveToDb() {
    if (!data) return;
    setIsSaving(true);
    try {
      await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: productId, productType: "tour", productName, region, duration, data, images }),
      });
      setSavedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
    } catch { /* 무시 */ }
    finally { setIsSaving(false); }
  }

  function goToOutput() {
    saveToDb();
    localStorage.setItem(`tour_output_${productId}`, JSON.stringify({ data, images }));
    const params = new URLSearchParams({ productName, region, duration });
    router.push(`/output-tour/${productId}?${params.toString()}`);
  }

  // ── 데이터 헬퍼 ──────────────────────────────────────────
  function upd<K extends keyof TourData>(key: K, val: TourData[K]) {
    setData(d => d ? { ...d, [key]: val } : d);
  }

  // ── 로딩/에러 ─────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500">AI가 투어 상세페이지를 생성하고 있습니다...</p>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-md text-center space-y-3">
        <p className="text-red-500 font-semibold">생성 중 오류가 발생했습니다</p>
        <p className="text-sm text-gray-500">{error || "알 수 없는 오류"}</p>
        <Link href="/new" className="inline-block mt-2 text-blue-600 text-sm underline">← 다시 시도</Link>
      </div>
    </div>
  );

  const order = data.sectionOrder ?? ["S01", "S02", "S03", "S04", "S05"];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← 홈</Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-gray-900 truncate">✈️ {productName || "투어 상품"}</h1>
            <p className="text-xs text-gray-400">{region} · {duration}</p>
          </div>
          <div className="flex items-center gap-2">
            {needsReview.length > 0 && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-lg font-medium">
                ⚠️ 검수 {needsReview.length}건
              </span>
            )}
            {savedAt && <span className="text-xs text-gray-400">{savedAt} 저장됨</span>}
            <button onClick={saveToDb} disabled={isSaving}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium transition-colors">
              {isSaving ? "저장중..." : "💾 저장"}
            </button>
            <button onClick={goToOutput}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
              상세페이지 보기 →
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        {/* 편집 폼 */}
        <div className="space-y-5">

          {/* 검수 배너 */}
          {needsReview.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
              <p className="text-sm font-semibold text-orange-700 mb-2">⚠️ 검수 필요 항목</p>
              <ul className="space-y-1">
                {needsReview.map((item, i) => (
                  <li key={i} className="text-sm text-orange-600 flex items-start gap-1.5">
                    <span className="mt-0.5 flex-shrink-0">•</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 섹션 순서 패널 */}
          <SectionOrderPanel order={order} onChange={o => upd("sectionOrder", o)} />

          {/* S01 히어로 */}
          {order.includes("S01") && (
            <SectionCard id="S01" title="히어로">
              <div className="space-y-4">
                <Field label="메인 타이틀" value={data.S01.heroTitle} onChange={v => upd("S01", { ...data.S01, heroTitle: v })} placeholder="예: 스위스 융프라우 완전정복" />
                <Field label="서브 타이틀" value={data.S01.heroSubtitle} onChange={v => upd("S01", { ...data.S01, heroSubtitle: v })} placeholder="예: 알프스의 정수를 담은 8일간의 여정" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="기간" value={data.S01.duration} onChange={v => upd("S01", { ...data.S01, duration: v })} placeholder="예: 7박 8일" />
                  <Field label="출발 정보" value={data.S01.departureInfo} onChange={v => upd("S01", { ...data.S01, departureInfo: v })} placeholder="예: 인천 출발" />
                </div>
                {/* 히어로 이미지 */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">히어로 이미지</label>
                  <input type="file" accept="image/*" onChange={e => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => setImages(im => ({ ...im, s01Hero: ev.target?.result as string }));
                    reader.readAsDataURL(file); e.target.value = "";
                  }} className="text-xs text-gray-500" />
                  {images.s01Hero && <img src={images.s01Hero} alt="hero" className="mt-2 w-full h-32 object-cover rounded-lg" />}
                </div>
              </div>
            </SectionCard>
          )}

          {/* S02 요약 */}
          {order.includes("S02") && (
            <SectionCard id="S02" title="요약 (인트로 + 하이라이트 + 꿀팁)">
              <div className="space-y-5">
                <Field label="인트로" value={data.S02.intro} onChange={v => upd("S02", { ...data.S02, intro: v })} rows={3} placeholder="여행의 전체적인 소개 문구" />

                {/* 하이라이트 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-500">하이라이트 콜아웃</label>
                    <button onClick={() => upd("S02", { ...data.S02, highlights: [...data.S02.highlights, { icon: "✨", text: "" }] })}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ 추가</button>
                  </div>
                  <div className="space-y-2">
                    {data.S02.highlights.map((h, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input value={h.icon} onChange={e => {
                          const arr = [...data.S02.highlights]; arr[i] = { ...arr[i], icon: e.target.value };
                          upd("S02", { ...data.S02, highlights: arr });
                        }} className="w-12 rounded-lg px-2 py-2 text-center border border-gray-200 text-sm" />
                        <input value={h.text} onChange={e => {
                          const arr = [...data.S02.highlights]; arr[i] = { ...arr[i], text: e.target.value };
                          upd("S02", { ...data.S02, highlights: arr });
                        }} placeholder={`하이라이트 ${i + 1}`}
                          className="flex-1 rounded-lg px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        <button onClick={() => upd("S02", { ...data.S02, highlights: data.S02.highlights.filter((_, j) => j !== i) })}
                          className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 꿀팁 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-500">꿀팁 섹션</label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={data.S02.showTips} onChange={e => upd("S02", { ...data.S02, showTips: e.target.checked })} className="rounded" />
                      <span className="text-xs text-gray-500">표시</span>
                    </label>
                  </div>
                  {data.S02.showTips && (
                    <div className="space-y-2">
                      {data.S02.tips.map((tip, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input value={tip} onChange={e => {
                            const arr = [...data.S02.tips]; arr[i] = e.target.value;
                            upd("S02", { ...data.S02, tips: arr });
                          }} placeholder={`꿀팁 ${i + 1}`}
                            className="flex-1 rounded-lg px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          <button onClick={() => upd("S02", { ...data.S02, tips: data.S02.tips.filter((_, j) => j !== i) })}
                            className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                        </div>
                      ))}
                      <button onClick={() => upd("S02", { ...data.S02, tips: [...data.S02.tips, ""] })}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ 꿀팁 추가</button>
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>
          )}

          {/* S03 일정 및 코스 */}
          {order.includes("S03") && (
            <SectionCard id="S03" title="일정 및 코스">
              <div className="space-y-4">
                <Field label="일정 소개" value={data.S03.intro} onChange={v => upd("S03", { ...data.S03, intro: v })} rows={2} />
                {data.S03.days.map((day, i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{day.dayNum}</span>
                      <button onClick={() => upd("S03", { ...data.S03, days: data.S03.days.filter((_, j) => j !== i) })}
                        className="text-red-400 hover:text-red-600 text-xs">✕ 삭제</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Day 번호" value={day.dayNum} onChange={v => {
                        const arr = [...data.S03.days]; arr[i] = { ...arr[i], dayNum: v };
                        upd("S03", { ...data.S03, days: arr });
                      }} placeholder="Day 1" />
                      <Field label="제목" value={day.title} onChange={v => {
                        const arr = [...data.S03.days]; arr[i] = { ...arr[i], title: v };
                        upd("S03", { ...data.S03, days: arr });
                      }} placeholder="인천 출발" />
                    </div>
                    <Field label="일정 설명" value={day.desc} onChange={v => {
                      const arr = [...data.S03.days]; arr[i] = { ...arr[i], desc: v };
                      upd("S03", { ...data.S03, days: arr });
                    }} rows={2} />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="식사" value={day.meals} onChange={v => {
                        const arr = [...data.S03.days]; arr[i] = { ...arr[i], meals: v };
                        upd("S03", { ...data.S03, days: arr });
                      }} placeholder="조식·중식·석식" />
                      <Field label="숙박" value={day.accommodation} onChange={v => {
                        const arr = [...data.S03.days]; arr[i] = { ...arr[i], accommodation: v };
                        upd("S03", { ...data.S03, days: arr });
                      }} placeholder="호텔명" />
                    </div>
                  </div>
                ))}
                <button onClick={() => upd("S03", { ...data.S03, days: [...data.S03.days, { dayNum: `Day ${data.S03.days.length + 1}`, title: "", desc: "", meals: "", accommodation: "" }] })}
                  className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
                  + Day 추가
                </button>
              </div>
            </SectionCard>
          )}

          {/* S04 안내사항 */}
          {order.includes("S04") && (
            <SectionCard id="S04" title="안내사항">
              <div className="space-y-4">
                {data.S04.categories.map((cat, ci) => (
                  <div key={ci} className="border border-gray-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <input value={cat.title} onChange={e => {
                        const arr = [...data.S04.categories]; arr[ci] = { ...arr[ci], title: e.target.value };
                        upd("S04", { ...data.S04, categories: arr });
                      }} placeholder="카테고리명"
                        className="flex-1 rounded-lg px-3 py-1.5 border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      <button onClick={() => upd("S04", { ...data.S04, categories: data.S04.categories.filter((_, j) => j !== ci) })}
                        className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </div>
                    {cat.items.map((item, ii) => (
                      <div key={ii} className="flex gap-2 items-center">
                        <input value={item} onChange={e => {
                          const arr = [...data.S04.categories]; arr[ci].items[ii] = e.target.value;
                          upd("S04", { ...data.S04, categories: arr });
                        }} placeholder={`항목 ${ii + 1}`}
                          className="flex-1 rounded-lg px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        <button onClick={() => {
                          const arr = [...data.S04.categories]; arr[ci].items = arr[ci].items.filter((_, j) => j !== ii);
                          upd("S04", { ...data.S04, categories: arr });
                        }} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                      </div>
                    ))}
                    <button onClick={() => {
                      const arr = [...data.S04.categories]; arr[ci].items.push("");
                      upd("S04", { ...data.S04, categories: arr });
                    }} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ 항목 추가</button>
                  </div>
                ))}
                <button onClick={() => upd("S04", { ...data.S04, categories: [...data.S04.categories, { title: "", items: [""] }] })}
                  className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
                  + 카테고리 추가
                </button>
              </div>
            </SectionCard>
          )}

          {/* S05 FAQ */}
          {order.includes("S05") && (
            <SectionCard id="S05" title="FAQ">
              <div className="space-y-3">
                {data.S05.faqs.map((faq, i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded mt-1">Q</span>
                      <input value={faq.question} onChange={e => {
                        const arr = [...data.S05.faqs]; arr[i] = { ...arr[i], question: e.target.value };
                        upd("S05", { ...data.S05, faqs: arr });
                      }} placeholder="질문" className="flex-1 rounded-lg px-3 py-1.5 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      <button onClick={() => upd("S05", { ...data.S05, faqs: data.S05.faqs.filter((_, j) => j !== i) })}
                        className="text-red-400 hover:text-red-600 text-xs mt-1">✕</button>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded mt-1">A</span>
                      <textarea value={faq.answer} onChange={e => {
                        const arr = [...data.S05.faqs]; arr[i] = { ...arr[i], answer: e.target.value };
                        upd("S05", { ...data.S05, faqs: arr });
                      }} rows={2} placeholder="답변"
                        className="flex-1 rounded-lg px-3 py-1.5 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                    </div>
                  </div>
                ))}
                <button onClick={() => upd("S05", { ...data.S05, faqs: [...data.S05.faqs, { question: "", answer: "" }] })}
                  className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
                  + FAQ 추가
                </button>
              </div>
            </SectionCard>
          )}

        </div>

        {/* 미리보기 사이드바 */}
        <div className="hidden xl:block">
          <div className="sticky top-20">
            <p className="text-xs text-gray-400 mb-2 text-center">미리보기 (390px)</p>
            <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-lg w-[390px]">
              <TourDetailPreview data={data} images={images} productName={productName} region={region} duration={duration} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function EditTourPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <EditTourContent productId={productId} />
    </Suspense>
  );
}
