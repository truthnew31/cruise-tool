"use client";

import { use, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FIXED_BENEFITS } from "@/constants/benefits";
import type { BenefitKey } from "@/types/cruise";
import type { ImageStore } from "@/types/images";
import CruiseDetailPreview, { type ConsultingInfo } from "@/components/CruiseDetailPreview";

// ── 타입 ────────────────────────────────────────────────────
type Tag = "free" | "partially_paid" | "paid";
type BenefitSel = { key: BenefitKey; enabled: boolean };
type PriceRow = { id: string; cabin: string; guests: number; total: number; note: string };

type AllData = {
  S01: { sub: string; main: string };
  S02: { note: string };
  S03: { sectionTag: string; sectionTitle: string; subCopy: string; highlights: string[] };
  S04: {
    shippingLineDesc: string; shipDesc: string;
    specs: { builtYear: string; tonnage: string; length: string; width: string; passengers: string; crew: string };
  };
  S05: { intro: string; cabinTypes: { name: string; desc: string; subDesc: string }[] };
  S06: {
    intro: string;
    mainFacilities: { name: string; desc: string; tag: Tag }[];
    kidsSubDesc: string;
    kidsFacilities: { name: string; desc: string; tag: Tag }[];
    diningSubDesc: string;
    dining: { name: string; desc: string; tag: Tag }[];
    notIncluded: { name: string; desc: string }[];
  };
  S07: { intro: string; ports: { name: string; country: string; desc: string }[] };
  S08: { closingCopy: string };
};

// ── 이미지 업로드 ────────────────────────────────────────────
function ImgUpload({ label, src, onChange, compact = false }: {
  label: string; src?: string; onChange: (v: string) => void; compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onChange(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }
  return (
    <div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {src ? (
        <div className="relative group rounded-lg overflow-hidden">
          <img src={src} alt={label} className={`w-full object-cover ${compact ? "h-14" : "h-20"}`} />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
            <button type="button" onClick={() => ref.current?.click()}
              className="text-white text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-md">변경</button>
            <button type="button" onClick={() => onChange("")}
              className="text-white text-xs bg-red-500/80 hover:bg-red-500 px-2.5 py-1 rounded-md">삭제</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()}
          className={`w-full border-2 border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:border-blue-300 hover:text-blue-500 flex items-center justify-center gap-1.5 transition-colors ${compact ? "py-2" : "py-3"}`}>
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {label}
        </button>
      )}
    </div>
  );
}

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

function Field({ label, value, onChange, rows = 1, placeholder = "", required = false }: {
  label: string; value: string; onChange: (v: string) => void;
  rows?: number; placeholder?: string; required?: boolean;
}) {
  const isEmpty = required && !value.trim();
  const base = "w-full rounded-xl px-3.5 py-2.5 text-sm text-gray-800 focus:outline-none transition-colors resize-none";
  const borderClass = isEmpty
    ? "border-2 border-orange-300 bg-orange-50 focus:ring-2 focus:ring-orange-400"
    : "border border-gray-200 bg-gray-50 hover:bg-white focus:ring-2 focus:ring-blue-400";
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="block text-xs font-medium text-gray-500">{label}</label>
        {isEmpty && (
          <span className="text-[10px] font-semibold text-orange-500 bg-orange-100 px-1.5 py-0.5 rounded-md">
            직접 입력 필요
          </span>
        )}
      </div>
      {rows > 1 ? (
        <textarea
          value={value} onChange={e => onChange(e.target.value)}
          rows={rows} placeholder={placeholder || (isEmpty ? "확인 후 직접 입력해주세요" : "")}
          className={`${base} ${borderClass}`}
        />
      ) : (
        <input
          type="text" value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder || (isEmpty ? "확인 후 직접 입력해주세요" : "")}
          className={`${base} ${borderClass}`}
        />
      )}
    </div>
  );
}

// ── 편집 페이지 본체 ─────────────────────────────────────────
function EditContent({ productId }: { productId: string }) {
  const sp           = useSearchParams();
  const router       = useRouter();
  const shippingLine = sp.get("shippingLine") ?? "";
  const shipName     = sp.get("shipName")     ?? "";
  const region       = sp.get("region")       ?? "";
  const fromDB       = sp.get("fromDB")       === "1";

  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState("");
  const [data,    setData]      = useState<AllData | null>(null);
  const [images,  setImages]    = useState<ImageStore>({});
  const [benefits, setBenefits] = useState<BenefitSel[]>([
    { key: "wifi", enabled: true },
    { key: "port_voucher", enabled: true },
    { key: "onboard_credit", enabled: true },
  ]);
  const [priceRows, setPriceRows] = useState<PriceRow[]>([
    { id: "1", cabin: "", guests: 2, total: 0, note: "" },
  ]);

  // 실시간 상담 박스
  const [consulting, setConsulting] = useState<ConsultingInfo>({
    enabled:      true,
    phone:        "02-733-9034",
    weekdayHours: "평일 10시 ~ 17시",
    chatHours:    "오전 10:00 ~ 11:00 / 오후 3:00 ~ 4:00",
  });

  // 기항지 자동완성 상태
  const [portLoading,      setPortLoading]      = useState<Set<number>>(new Set());
  const [portImageOptions, setPortImageOptions] = useState<Record<number, Array<{ url: string; thumb: string; credit: string }>>>({});

  // NCL 자동 매칭 상태
  const [nclMatching, setNclMatching] = useState(false);
  const isNcl = shippingLine.toLowerCase().includes("norwegian")
    || shippingLine.includes("노르웨지안")
    || shippingLine.toUpperCase().includes("NCL");

  // 이미지 자동화 상태
  const [imgAutoLoading, setImgAutoLoading] = useState(false);
  const [mediaOpen,      setMediaOpen]      = useState(false);
  const [mediaUrl,       setMediaUrl]       = useState("");
  const [mediaImages,    setMediaImages]    = useState<string[]>([]);
  const [scrapeLoading,  setScrapeLoading]  = useState(false);
  const [scrapeError,    setScrapeError]    = useState("");
  const [pickerImg,      setPickerImg]      = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [savedAt,  setSavedAt]  = useState<string | null>(null);

  // S06 이미지 드래그 상태
  const [dragImg, setDragImg] = useState<{ key: string; idx: number } | null>(null);

  // AI 생성 후 검수 필요 항목
  const [needsReview, setNeedsReview] = useState<string[]>([]);

  // DB에 저장
  async function saveToDb(d = data, im = images) {
    if (!d) return;
    setIsSaving(true);
    try {
      await fetch(`/api/products/${productId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: productId, shippingLine, shipName, region, data: d, images: im, benefits, priceRows, consulting }),
      });
      setSavedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
    } catch { /* 저장 실패는 무시 */ }
    finally { setIsSaving(false); }
  }

  function goToOutput() {
    localStorage.setItem(`cruise_output_${productId}`, JSON.stringify({ data, benefits, priceRows, images, consulting }));
    const params = new URLSearchParams({ shippingLine, shipName, region });
    router.push(`/output/${productId}?${params.toString()}`);
  }

  function goToImages() {
    saveToDb();
    localStorage.setItem(`cruise_output_${productId}`, JSON.stringify({ data, benefits, priceRows, images, consulting }));
    const params = new URLSearchParams({ shippingLine, shipName, region });
    router.push(`/images/${productId}?${params.toString()}`);
  }

  // 이미지 헬퍼
  function setArr<K extends keyof ImageStore>(key: K, i: number, val: string) {
    setImages(im => {
      const arr = [...((im[key] as string[] | undefined) ?? [])];
      arr[i] = val;
      return { ...im, [key]: arr };
    });
  }
  function setCabinImg(i: number, field: "photo" | "floorplan", val: string) {
    setImages(im => {
      const cabins = [...(im.s05Cabins ?? [])];
      if (!cabins[i]) cabins[i] = {};
      cabins[i] = { ...cabins[i], [field]: val };
      return { ...im, s05Cabins: cabins };
    });
  }

  // ── S06 이미지 드래그&드롭 순서 변경 ─────────────────────────
  function handleImgDrop(key: keyof ImageStore, dropIdx: number) {
    if (!dragImg || dragImg.key !== key || dragImg.idx === dropIdx) { setDragImg(null); return; }
    setImages(im => {
      const arr: (string | undefined)[] = [0, 1, 2].map(i => (im[key] as string[] | undefined)?.[i]);
      [arr[dragImg.idx], arr[dropIdx]] = [arr[dropIdx], arr[dragImg.idx]];
      return { ...im, [key]: arr };
    });
    setDragImg(null);
  }

  // ── S06 이미지 일괄 업로드 ────────────────────────────────────
  function handleBulkUpload(key: keyof ImageStore, e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 3);
    files.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = ev => setArr(key as "s06Main" | "s06Kids" | "s06Dining", idx, ev.target?.result as string);
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  // ── S06 시설 태그 변경 시 무료→상단, 유료→하단 자동 정렬 ──────
  const TAG_ORDER: Record<string, number> = { free: 0, partially_paid: 1, paid: 2 };
  function sortByTag<T extends { tag: Tag }>(arr: T[]): T[] {
    return [...arr].sort((a, b) => (TAG_ORDER[a.tag] ?? 9) - (TAG_ORDER[b.tag] ?? 9));
  }

  // 기항지 이름 → AI로 국가 + 설명 자동완성 + Unsplash 이미지 검색
  async function autoCompletePort(i: number) {
    const portName = data?.S07.ports[i]?.name ?? "";
    if (!portName.trim()) return;

    setPortLoading(prev => new Set(prev).add(i));
    try {
      // ① AI 자동완성 (국가 + 설명)
      const portRes  = await fetch(`/api/generate-port?${new URLSearchParams({ portName })}`);
      const portJson = await portRes.json();
      if (portJson.ok) {
        setData(d => {
          if (!d) return d;
          const ps = [...d.S07.ports];
          ps[i] = { ...ps[i], country: portJson.data.country, desc: portJson.data.desc };
          return { ...d, S07: { ...d.S07, ports: ps } };
        });
      }

      // ② Unsplash 이미지 검색 (선택 사항 — UNSPLASH_ACCESS_KEY 없으면 ok:false 반환)
      const imgRes  = await fetch(`/api/search-image?${new URLSearchParams({ query: portName + " travel" })}`);
      const imgJson = await imgRes.json();
      if (imgJson.ok && imgJson.photos?.length > 0) {
        setPortImageOptions(prev => ({ ...prev, [i]: imgJson.photos }));
      }
    } finally {
      setPortLoading(prev => { const ns = new Set(prev); ns.delete(i); return ns; });
    }
  }

  // NCL 뉴스룸 캐시에서 선박별 이미지 자동 매칭
  async function applyNclImages() {
    if (!data) return;
    setNclMatching(true);
    try {
      // 섹션별 병렬 요청
      const sections: Array<{ section: string; key: string; idx?: number }> = [
        { section: "S01",       key: "s01Hero"  },
        { section: "S04",       key: "s04Ship"  },
        { section: "S08",       key: "s08Closing" },
        ...([0,1,2,3].map(i => ({ section: "S03", key: `s03_${i}`, idx: i }))),
        ...data.S05.cabinTypes.map((_, i) => ({ section: "S05", key: `s05_${i}`, idx: i })),
        ...data.S06.mainFacilities.map((_, i) => ({ section: "S06_main", key: `s06m_${i}`, idx: i })),
        ...data.S06.kidsFacilities.map((_, i) => ({ section: "S06_kids", key: `s06k_${i}`, idx: i })),
        ...data.S06.dining.map((_, i) => ({ section: "S06_dining", key: `s06d_${i}`, idx: i })),
      ];

      // 섹션별 NCL 이미지 가져오기 (중복 방지용 already-used set)
      const usedUrls = new Set<string>();
      const newImages: ImageStore = { ...images };

      // 고유 섹션별 배치
      const sectionImages: Record<string, string[]> = {};
      const uniqueSections = [...new Set(sections.map(s => s.section))];
      await Promise.all(
        uniqueSections.map(async sec => {
          const res  = await fetch(`/api/ncl-images?${new URLSearchParams({ ship: shipName, section: sec })}`);
          const json = await res.json();
          if (json.ok) sectionImages[sec] = (json.images as { url: string }[]).map(i => i.url);
        })
      );

      // 섹션별 순서대로 이미지 배정 (중복 없이)
      const sectionIdxPointer: Record<string, number> = {};
      for (const { section, key, idx = 0 } of sections) {
        const pool = sectionImages[section] ?? [];
        const ptr  = sectionIdxPointer[section] ?? 0;
        // 이미 사용된 URL은 건너뜀
        let assigned: string | undefined;
        for (let i = ptr; i < pool.length; i++) {
          if (!usedUrls.has(pool[i])) {
            assigned = pool[i];
            usedUrls.add(pool[i]);
            sectionIdxPointer[section] = i + 1;
            break;
          }
        }
        if (!assigned) continue;

        if (key === "s01Hero")    newImages.s01Hero    = assigned;
        else if (key === "s04Ship")    newImages.s04Ship    = assigned;
        else if (key === "s08Closing") newImages.s08Closing = assigned;
        else if (key.startsWith("s03_")) {
          const arr = [...(newImages.s03Highlights ?? [])]; arr[idx] = assigned;
          newImages.s03Highlights = arr;
        } else if (key.startsWith("s05_")) {
          const arr = [...(newImages.s05Cabins ?? [])];
          arr[idx] = { ...(arr[idx] ?? {}), photo: assigned };
          newImages.s05Cabins = arr;
        } else if (key.startsWith("s06m_")) {
          const arr = [...(newImages.s06Main ?? [])]; arr[idx] = assigned; newImages.s06Main = arr;
        } else if (key.startsWith("s06k_")) {
          const arr = [...(newImages.s06Kids ?? [])]; arr[idx] = assigned; newImages.s06Kids = arr;
        } else if (key.startsWith("s06d_")) {
          const arr = [...(newImages.s06Dining ?? [])]; arr[idx] = assigned; newImages.s06Dining = arr;
        }
      }

      setImages(newImages);
    } catch (e) {
      alert("NCL 이미지 매칭 실패: " + String(e));
    } finally {
      setNclMatching(false);
    }
  }

  // 뉴스룸/미디어 URL 스크래핑
  async function scrapeMedia() {
    if (!mediaUrl.trim()) return;
    setScrapeLoading(true);
    setScrapeError("");
    setMediaImages([]);
    try {
      const res  = await fetch("/api/scrape-media", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: mediaUrl }),
      });
      const json = await res.json();
      if (json.ok) setMediaImages(json.images);
      else setScrapeError(json.error ?? "스크래핑 실패");
    } catch (e) {
      setScrapeError(String(e));
    } finally {
      setScrapeLoading(false);
    }
  }

  // 스크래핑/Unsplash 이미지 → 섹션 배정
  function assignImage(imgUrl: string, section: string, idx = 0) {
    switch (section) {
      case "s01Hero":       setImages(im => ({ ...im, s01Hero: imgUrl })); break;
      case "s03Highlights": setArr("s03Highlights", idx, imgUrl); break;
      case "s04Ship":       setImages(im => ({ ...im, s04Ship: imgUrl })); break;
      case "s05CabinPhoto": setCabinImg(idx, "photo", imgUrl); break;
      case "s06Main":       setArr("s06Main", idx, imgUrl); break;
      case "s06Kids":       setArr("s06Kids", idx, imgUrl); break;
      case "s06Dining":     setArr("s06Dining", idx, imgUrl); break;
      case "s07Ports":      setArr("s07Ports", idx, imgUrl); break;
      case "s08Closing":    setImages(im => ({ ...im, s08Closing: imgUrl })); break;
    }
    setPickerImg(null);
  }

  useEffect(() => {
    if (fromDB) {
      // ── DB에서 불러오기 (갤러리 → 편집) ──────────────────────
      fetch(`/api/products/${productId}`)
        .then(r => r.json())
        .then(res => {
          if (res.ok) {
            const p = res.product;
            setData(p.data as AllData);
            if (p.images)    setImages(p.images);
            if (p.benefits)  setBenefits(p.benefits);
            if (p.priceRows) setPriceRows(p.priceRows);
            if (p.consulting) setConsulting(p.consulting);
          } else {
            setError("저장된 데이터를 불러올 수 없습니다");
          }
        })
        .catch(e => setError(String(e)))
        .finally(() => setLoading(false));
    } else {
      // ── AI로 신규 생성 ────────────────────────────────────────
      const params = new URLSearchParams({ shippingLine, shipName, region });
      fetch(`/api/generate-all?${params.toString()}`)
        .then(r => r.json())
        .then(res => {
          if (res.ok) {
            const d = res.data as AllData;
            setData(d);
            if (res.needsReview?.length > 0) setNeedsReview(res.needsReview);
            // S07 기항지 이미지만 Unsplash 자동 채우기
            // — 기항지명+국가 쿼리로 검색 후 alt_description 에 지명이 포함된 경우만 삽입
            const ports = d.S07.ports.filter(p => p.name.trim());
            if (ports.length > 0) {
              setImgAutoLoading(true);
              // 한글 국가명 → 영문 매핑 (Unsplash alt_description 매칭용)
              const COUNTRY_EN: Record<string, string> = {
                "미국":"united states", "캐나다":"canada", "일본":"japan", "이탈리아":"italy",
                "스페인":"spain", "프랑스":"france", "그리스":"greece", "크로아티아":"croatia",
                "노르웨이":"norway", "핀란드":"finland", "영국":"united kingdom", "독일":"germany",
                "포르투갈":"portugal", "멕시코":"mexico", "바하마":"bahamas", "카리브해":"caribbean",
                "호주":"australia", "뉴질랜드":"new zealand", "싱가포르":"singapore",
                "터키":"turkey", "아이슬란드":"iceland", "에스토니아":"estonia",
              };
              Promise.all(
                ports.map(p =>
                  fetch(`/api/search-image?${new URLSearchParams({ query: `${p.name} ${p.country} city travel landmark` })}`)
                    .then(r => r.json())
                    .catch(() => ({ ok: false }))
                )
              ).then(results => {
                setImages(im => {
                  const s07Ports = [...(im.s07Ports ?? [])];
                  results.forEach((res, i) => {
                    if (!res.ok || !res.photos?.[0]) return; // 결과 없음 → 삽입 X
                    const photo      = res.photos[0];
                    const altDesc    = (photo.altDescription ?? "").toLowerCase();
                    const portLower  = ports[i].name.toLowerCase();
                    const countryKo  = ports[i].country.toLowerCase();
                    const countryEn  = COUNTRY_EN[countryKo] ?? countryKo;
                    // alt_description에 기항지명 또는 국가명(한/영) 포함 여부 확인
                    const isAccurate = altDesc.includes(portLower)
                      || altDesc.includes(countryEn)
                      || altDesc.includes(countryKo);
                    if (isAccurate) s07Ports[i] = photo.url;
                    // 불일치 → 빈 채로 유지 (강제 삽입 X)
                  });
                  return { ...im, s07Ports };
                });
              }).finally(() => setImgAutoLoading(false));
            }
            // 생성 직후 DB에 저장
            setTimeout(() => saveToDb(d, {}), 500);
          } else {
            setError(res.error ?? "생성 실패");
          }
        })
        .catch(e => setError(String(e)))
        .finally(() => setLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderWidth: 3 }} />
        <p className="text-base font-semibold text-gray-800">AI가 전체 섹션을 작성하고 있습니다…</p>
        <p className="text-sm text-gray-400">{shippingLine} · {shipName} · {region}</p>
        <p className="text-xs text-gray-300">S01~S08 섹션 생성 중 (약 15~30초)</p>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-md text-center space-y-3">
        <p className="text-red-500 font-semibold">생성 중 오류가 발생했습니다</p>
        <p className="text-sm text-gray-500">{error || "알 수 없는 오류"}</p>
        <p className="text-xs text-gray-400">ANTHROPIC_API_KEY가 .env.local에 설정되어 있는지 확인하세요</p>
        <Link href="/new" className="inline-block mt-2 text-blue-600 text-sm underline">← 다시 시도</Link>
      </div>
    </div>
  );

  const s = data;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 flex-shrink-0 z-10">
        <div className="px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/new" className="text-gray-400 hover:text-gray-600 text-sm flex-shrink-0">← 새 상품</Link>
            <span className="text-gray-300">/</span>
            <p className="text-sm font-semibold text-gray-900 truncate">{shippingLine} · {shipName} · {region}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 저장 상태 */}
            {isSaving ? (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <span className="w-2.5 h-2.5 border border-gray-300 border-t-blue-400 rounded-full animate-spin" /> 저장 중
              </span>
            ) : savedAt ? (
              <span className="text-xs text-gray-400">✓ {savedAt} 저장됨</span>
            ) : (
              <span className="text-xs text-green-600 bg-green-50 px-2.5 py-1 rounded-full font-medium">✓ 생성 완료</span>
            )}
            {imgAutoLoading && (
              <span className="text-xs text-violet-500 bg-violet-50 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                <span className="w-2.5 h-2.5 border border-violet-400 border-t-transparent rounded-full animate-spin" />
                이미지 채우는 중
              </span>
            )}
            <button onClick={() => saveToDb()}
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
              💾 저장
            </button>
            {isNcl && (
              <button onClick={applyNclImages} disabled={nclMatching}
                className="text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
                {nclMatching
                  ? <><span className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin" />매칭 중…</>
                  : "🚢 NCL 이미지 자동 매칭"}
              </button>
            )}
            <button onClick={() => setMediaOpen(true)}
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
              🖼️ 선사 미디어
            </button>
            <button onClick={goToImages}
              className="text-xs font-semibold px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700">
              이미지 삽입 →
            </button>
            <button onClick={goToOutput} className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700">
              출력 →
            </button>
          </div>
        </div>
      </header>

      {/* 본문 — 좌: 편집 폼 / 우: 미리보기 */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── 좌: 편집 폼 ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">

            {/* ── AI 검수 필요 배너 ── */}
            {needsReview.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-3">
                <span className="text-lg flex-shrink-0">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-800 mb-1">공식 소스 미확인 항목 — 직접 검수 필요</p>
                  <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                    {needsReview.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>
                <button onClick={() => setNeedsReview([])} className="text-amber-400 hover:text-amber-600 text-xl leading-none flex-shrink-0">×</button>
              </div>
            )}

            {/* S01 */}
            <SectionCard id="S01" title="인트로 헤드카피">
              <div className="space-y-3">
                <Field label="서브 카피 — FOMO·가격 후킹 (15자 이내)" value={s.S01.sub}
                  onChange={v => setData(d => d && { ...d, S01: { ...d.S01, sub: v } })}
                  placeholder="예: 올해 딱 5달만 열리는 자연의 문!" />
                <Field label="메인 카피 — 여행지 소구 (20자 이내)" value={s.S01.main}
                  onChange={v => setData(d => d && { ...d, S01: { ...d.S01, main: v } })}
                  placeholder="예: 알래스카의 야생을 크루즈로" />
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">히어로 이미지 (390×416)</p>
                  <ImgUpload label="히어로 이미지 업로드" src={images.s01Hero}
                    onChange={v => setImages(im => ({ ...im, s01Hero: v }))} />
                </div>

                {/* 실시간 상담 박스 */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                    <p className="text-xs font-bold text-gray-600">실시간 상담 박스</p>
                    <button
                      onClick={() => setConsulting(c => ({ ...c, enabled: !c.enabled }))}
                      className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors ${consulting.enabled ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-500"}`}
                    >
                      {consulting.enabled ? "표시 중" : "숨김"}
                    </button>
                  </div>
                  {consulting.enabled && (
                    <div className="px-4 py-3 space-y-2">
                      <Field label="전화번호" value={consulting.phone}
                        onChange={v => setConsulting(c => ({ ...c, phone: v }))}
                        placeholder="02-733-9034" />
                      <Field label="전화 상담 운영 시간" value={consulting.weekdayHours}
                        onChange={v => setConsulting(c => ({ ...c, weekdayHours: v }))}
                        placeholder="평일 10시 ~ 17시" />
                      <Field label="채팅 상담 시간 (/ 로 구분)" value={consulting.chatHours}
                        onChange={v => setConsulting(c => ({ ...c, chatHours: v }))}
                        placeholder="오전 10:00 ~ 11:00 / 오후 3:00 ~ 4:00" />
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* S02 */}
            <SectionCard id="S02" title="마이리얼트립 단독 혜택">
              <p className="text-xs text-gray-400 mb-3">표시 여부만 선택 — 내용 수정 불가</p>
              <div className="space-y-2">
                {benefits.map(b => {
                  const info = FIXED_BENEFITS[b.key];
                  return (
                    <button key={b.key} type="button"
                      onClick={() => setBenefits(prev => prev.map(x => x.key === b.key ? { ...x, enabled: !x.enabled } : x))}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${b.enabled ? "border-blue-400 bg-blue-50" : "border-gray-200 opacity-50"}`}
                    >
                      <span className={`w-4 h-4 rounded text-xs flex items-center justify-center font-bold flex-shrink-0 ${b.enabled ? "bg-blue-600 text-white" : "bg-gray-300 text-white"}`}>
                        {b.enabled ? "✓" : "—"}
                      </span>
                      <span className="text-sm font-medium text-gray-800 flex-1">
                        {info.title}
                        {info.valueLabel && <span className="ml-2 text-blue-600 font-bold text-xs">{info.valueLabel}</span>}
                      </span>
                      <span className="text-xs text-gray-400 truncate max-w-[180px]">{info.description}</span>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            {/* S03 */}
            <SectionCard id="S03" title="상품 개요">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="섹션 태그" value={s.S03.sectionTag}
                    onChange={v => setData(d => d && { ...d, S03: { ...d.S03, sectionTag: v } })} />
                  <Field label="섹션 제목" value={s.S03.sectionTitle}
                    onChange={v => setData(d => d && { ...d, S03: { ...d.S03, sectionTitle: v } })} />
                </div>
                <Field label="서브 카피" value={s.S03.subCopy}
                  onChange={v => setData(d => d && { ...d, S03: { ...d.S03, subCopy: v } })} />
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">하이라이트 포인트 + 이미지 (2×2 그리드)</p>
                  <div className="grid grid-cols-2 gap-3">
                    {s.S03.highlights.map((h, i) => (
                      <div key={i} className="space-y-1.5">
                        <input type="text" value={h}
                          onChange={e => setData(d => { if (!d) return d; const hl = [...d.S03.highlights]; hl[i] = e.target.value; return { ...d, S03: { ...d.S03, highlights: hl } }; })}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
                          placeholder={`하이라이트 ${i + 1}`}
                        />
                        <ImgUpload label={`사진 ${i + 1}`} src={images.s03Highlights?.[i]}
                          onChange={v => setArr("s03Highlights", i, v)} compact />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* S04 */}
            <SectionCard id="S04" title="선사 & 선박 소개">
              <div className="space-y-3">
                <Field label="선사 소개" value={s.S04.shippingLineDesc} rows={3}
                  onChange={v => setData(d => d && { ...d, S04: { ...d.S04, shippingLineDesc: v } })} />
                <Field label="선박 소개" value={s.S04.shipDesc} rows={3}
                  onChange={v => setData(d => d && { ...d, S04: { ...d.S04, shipDesc: v } })} />
                {/* 선박 제원 — 개별 필드 */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">선박 제원</p>
                  <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                    {([
                      ["builtYear",  "건조년도 / 리노베이션", "예: 2019년 / 2022년 리노베이션"],
                      ["tonnage",    "총 톤수",               "예: 168,666 GT"],
                      ["length",     "전장 (길이)",           "예: 347m"],
                      ["width",      "전폭 (너비)",           "예: 41m"],
                      ["passengers", "승객 정원",             "예: 4,180명"],
                      ["crew",       "승무원 수",             "예: 1,545명"],
                    ] as const).map(([key, label, ph], i) => {
                      const val = s.S04.specs?.[key] ?? "";
                      const empty = !val.trim();
                      return (
                        <div key={key} className={`flex items-center gap-3 px-4 py-2.5 ${empty ? "bg-orange-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                          <span className={`text-xs w-36 flex-shrink-0 ${empty ? "text-orange-500 font-semibold" : "text-gray-400"}`}>
                            {label}{empty && <span className="ml-1 text-[10px] bg-orange-100 text-orange-500 px-1 rounded">직접 입력</span>}
                          </span>
                          <input
                            value={val}
                            onChange={e => setData(d => d && { ...d, S04: { ...d.S04, specs: { ...d.S04.specs, [key]: e.target.value } } })}
                            className={`flex-1 text-sm bg-transparent focus:outline-none ${empty ? "text-orange-400 placeholder-orange-300" : "text-gray-800"}`}
                            placeholder={empty ? `확인 후 입력 (${ph})` : ph}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">선박 사진</p>
                  <ImgUpload label="선박 사진 업로드" src={images.s04Ship}
                    onChange={v => setImages(im => ({ ...im, s04Ship: v }))} />
                </div>
              </div>
            </SectionCard>

            {/* S05 */}
            <SectionCard id="S05" title="캐빈 & 가격표">
              <div className="space-y-4">
                <Field label="캐빈 소개" value={s.S05.intro}
                  onChange={v => setData(d => d && { ...d, S05: { ...d.S05, intro: v } })} />
                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-500">캐빈 타입 + 이미지</p>
                  {s.S05.cabinTypes.map((c, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-2">
                      {/* 타입명 + 삭제 버튼 */}
                      <div className="flex items-center gap-2">
                        <input value={c.name}
                          onChange={e => setData(d => { if (!d) return d; const ct = [...d.S05.cabinTypes]; ct[i] = { ...ct[i], name: e.target.value }; return { ...d, S05: { ...d.S05, cabinTypes: ct } }; })}
                          className="flex-1 border-0 text-sm font-semibold text-gray-800 focus:outline-none bg-transparent border-b border-gray-200 pb-1"
                          placeholder="캐빈 타입명"
                        />
                        <button
                          onClick={() => {
                            setData(d => { if (!d) return d; return { ...d, S05: { ...d.S05, cabinTypes: d.S05.cabinTypes.filter((_, j) => j !== i) } }; });
                            setImages(im => { const cabs = [...(im.s05Cabins ?? [])]; cabs.splice(i, 1); return { ...im, s05Cabins: cabs }; });
                          }}
                          className="text-gray-300 hover:text-red-400 text-xl leading-none flex-shrink-0" title="삭제">×</button>
                      </div>
                      <textarea value={c.desc} rows={2}
                        onChange={e => setData(d => { if (!d) return d; const ct = [...d.S05.cabinTypes]; ct[i] = { ...ct[i], desc: e.target.value }; return { ...d, S05: { ...d.S05, cabinTypes: ct } }; })}
                        className="w-full border-0 text-sm text-gray-600 focus:outline-none bg-transparent resize-none"
                        placeholder="캐빈 설명 (가격 후킹 포함)"
                      />
                      <textarea value={c.subDesc ?? ""} rows={2}
                        onChange={e => setData(d => { if (!d) return d; const ct = [...d.S05.cabinTypes]; ct[i] = { ...ct[i], subDesc: e.target.value }; return { ...d, S05: { ...d.S05, cabinTypes: ct } }; })}
                        className="w-full border-0 text-xs text-gray-400 focus:outline-none bg-gray-50 rounded-lg px-2 py-1.5 resize-none"
                        placeholder="부가설명 — 최대 인원·침대 구성 (예: 최대 4명 투숙 가능하며, 3~4인의 경우 소파/벙커 침대가 제공됩니다)"
                      />
                      <div className="pt-1">
                        <ImgUpload label="객실 사진" src={images.s05Cabins?.[i]?.photo}
                          onChange={v => setCabinImg(i, "photo", v)} compact />
                      </div>
                    </div>
                  ))}
                  {/* 캐빈 타입 추가 버튼 */}
                  <button
                    onClick={() => setData(d => { if (!d) return d; return { ...d, S05: { ...d.S05, cabinTypes: [...d.S05.cabinTypes, { name: "", desc: "", subDesc: "" }] } }; })}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    <span className="text-base">+</span> 캐빈 타입 추가
                  </button>
                </div>

                {/* 가격표 */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">가격표 <span className="text-gray-400">(직접 입력 · 인당 가격 자동 계산)</span></p>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr_auto] text-xs font-medium text-gray-500 bg-gray-50 px-3 py-2 gap-2">
                      <span>캐빈 타입</span><span>인원</span><span>총 가격(₩)</span><span>인당(₩)</span><span></span>
                    </div>
                    {priceRows.map((row, i) => (
                      <div key={row.id} className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr_auto] items-center px-3 py-2 gap-2 border-t border-gray-100 group">
                        <input value={row.cabin} placeholder="예: 발코니 캐빈"
                          onChange={e => setPriceRows(p => p.map((r, j) => j === i ? { ...r, cabin: e.target.value } : r))}
                          className="text-sm focus:outline-none bg-transparent" />
                        <select value={row.guests}
                          onChange={e => setPriceRows(p => p.map((r, j) => j === i ? { ...r, guests: +e.target.value } : r))}
                          className="text-sm border border-gray-200 rounded-lg px-1 py-1 focus:outline-none">
                          {[1,2,3,4].map(n => <option key={n} value={n}>{n}인</option>)}
                        </select>
                        <input type="number" value={row.total || ""}
                          onChange={e => setPriceRows(p => p.map((r, j) => j === i ? { ...r, total: +e.target.value } : r))}
                          className="text-sm border border-gray-200 rounded-lg px-2 py-1 text-right focus:outline-none" placeholder="0" />
                        <div className="text-sm font-medium text-right text-gray-700">
                          {row.total > 0 ? Math.round(row.total / row.guests).toLocaleString() : "—"}
                        </div>
                        <button onClick={() => setPriceRows(p => p.filter((_, j) => j !== i))}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-lg">×</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setPriceRows(p => [...p, { id: String(Date.now()), cabin: "", guests: 2, total: 0, note: "" }])}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    <span className="text-base">+</span> 행 추가
                  </button>
                </div>
              </div>
            </SectionCard>

            {/* S06 */}
            <SectionCard id="S06" title="주요 시설 & 다이닝">
              <div className="space-y-5">
                <Field label="시설 전체 소개" value={s.S06.intro}
                  onChange={v => setData(d => d && { ...d, S06: { ...d.S06, intro: v } })} />

                {/* 선박 전경 대표 이미지 */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">선박 전경 대표 이미지</p>
                  <ImgUpload label="선박 전경 사진 업로드" src={images.s06Overview}
                    onChange={v => setImages(im => ({ ...im, s06Overview: v }))} />
                </div>

                {/* ① 주요 부대시설 */}
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2">① 주요 부대시설</p>
                  {/* 하이라이트 이미지 3장 — 일괄업로드 + 드래그 순서 변경 */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs text-gray-400">⠿ 드래그해서 순서 변경</p>
                      <label className="text-xs text-blue-600 cursor-pointer hover:text-blue-700 font-medium">
                        + 일괄 업로드
                        <input type="file" multiple accept="image/*" className="hidden" onChange={e => handleBulkUpload("s06Main", e)} />
                      </label>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 1, 2].map(idx => (
                        <div key={idx}
                          draggable={!!images.s06Main?.[idx]}
                          onDragStart={() => setDragImg({ key: "s06Main", idx })}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => handleImgDrop("s06Main", idx)}
                          className={`rounded-xl transition-opacity ${dragImg?.key === "s06Main" && dragImg?.idx === idx ? "opacity-40 ring-2 ring-blue-400" : ""}`}>
                          <ImgUpload label={`하이라이트 ${idx + 1}`} src={images.s06Main?.[idx]}
                            onChange={v => setArr("s06Main", idx, v)} compact />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {s.S06.mainFacilities.map((f, i) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex gap-2">
                          <div className="flex-1 space-y-1">
                            <input value={f.name} placeholder="시설명"
                              onChange={e => setData(d => { if (!d) return d; const fs = [...d.S06.mainFacilities]; fs[i] = { ...fs[i], name: e.target.value }; return { ...d, S06: { ...d.S06, mainFacilities: fs } }; })}
                              className="w-full text-sm font-semibold bg-transparent focus:outline-none border-b border-gray-200 pb-0.5" />
                            <input value={f.desc} placeholder="설명"
                              onChange={e => setData(d => { if (!d) return d; const fs = [...d.S06.mainFacilities]; fs[i] = { ...fs[i], desc: e.target.value }; return { ...d, S06: { ...d.S06, mainFacilities: fs } }; })}
                              className="w-full text-xs text-gray-500 bg-transparent focus:outline-none" />
                          </div>
                          <select value={f.tag}
                            onChange={e => setData(d => { if (!d) return d; const fs = [...d.S06.mainFacilities]; fs[i] = { ...fs[i], tag: e.target.value as Tag }; return { ...d, S06: { ...d.S06, mainFacilities: sortByTag(fs) } }; })}
                            className={`text-xs font-medium px-2 py-1 rounded-lg border-0 focus:outline-none self-start ${f.tag === "free" ? "bg-green-100 text-green-700" : f.tag === "paid" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                            <option value="free">무료</option>
                            <option value="partially_paid">일부유료</option>
                            <option value="paid">유료</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ② 어린이&패밀리 */}
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2">② 어린이&패밀리 시설</p>
                  <input value={s.S06.kidsSubDesc ?? ""} placeholder="부가 설명 (예: 아이는 즐겁고 어른들은 쉴 수 있도록!)"
                    onChange={e => setData(d => d && { ...d, S06: { ...d.S06, kidsSubDesc: e.target.value } })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-600 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50" />
                  {/* 하이라이트 이미지 3장 — 일괄업로드 + 드래그 순서 변경 */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs text-gray-400">⠿ 드래그해서 순서 변경</p>
                      <label className="text-xs text-blue-600 cursor-pointer hover:text-blue-700 font-medium">
                        + 일괄 업로드
                        <input type="file" multiple accept="image/*" className="hidden" onChange={e => handleBulkUpload("s06Kids", e)} />
                      </label>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 1, 2].map(idx => (
                        <div key={idx}
                          draggable={!!images.s06Kids?.[idx]}
                          onDragStart={() => setDragImg({ key: "s06Kids", idx })}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => handleImgDrop("s06Kids", idx)}
                          className={`rounded-xl transition-opacity ${dragImg?.key === "s06Kids" && dragImg?.idx === idx ? "opacity-40 ring-2 ring-blue-400" : ""}`}>
                          <ImgUpload label={`하이라이트 ${idx + 1}`} src={images.s06Kids?.[idx]}
                            onChange={v => setArr("s06Kids", idx, v)} compact />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {s.S06.kidsFacilities.map((f, i) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex gap-2">
                          <div className="flex-1 space-y-1">
                            <input value={f.name} placeholder="시설명"
                              onChange={e => setData(d => { if (!d) return d; const fs = [...d.S06.kidsFacilities]; fs[i] = { ...fs[i], name: e.target.value }; return { ...d, S06: { ...d.S06, kidsFacilities: fs } }; })}
                              className="w-full text-sm font-semibold bg-transparent focus:outline-none border-b border-gray-200 pb-0.5" />
                            <input value={f.desc} placeholder="설명"
                              onChange={e => setData(d => { if (!d) return d; const fs = [...d.S06.kidsFacilities]; fs[i] = { ...fs[i], desc: e.target.value }; return { ...d, S06: { ...d.S06, kidsFacilities: fs } }; })}
                              className="w-full text-xs text-gray-500 bg-transparent focus:outline-none" />
                          </div>
                          <select value={f.tag}
                            onChange={e => setData(d => { if (!d) return d; const fs = [...d.S06.kidsFacilities]; fs[i] = { ...fs[i], tag: e.target.value as Tag }; return { ...d, S06: { ...d.S06, kidsFacilities: sortByTag(fs) } }; })}
                            className={`text-xs font-medium px-2 py-1 rounded-lg border-0 focus:outline-none self-start ${f.tag === "free" ? "bg-green-100 text-green-700" : f.tag === "paid" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                            <option value="free">무료</option>
                            <option value="partially_paid">일부유료</option>
                            <option value="paid">유료</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ③ 다이닝 */}
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2">③ 다이닝 (레스토랑&바)</p>
                  <input value={s.S06.diningSubDesc ?? ""} placeholder="부가 설명 (예: 드레스코드, 분위기, 포함 여부 등)"
                    onChange={e => setData(d => d && { ...d, S06: { ...d.S06, diningSubDesc: e.target.value } })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-600 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50" />
                  {/* 하이라이트 이미지 3장 — 일괄업로드 + 드래그 순서 변경 */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs text-gray-400">⠿ 드래그해서 순서 변경</p>
                      <label className="text-xs text-blue-600 cursor-pointer hover:text-blue-700 font-medium">
                        + 일괄 업로드
                        <input type="file" multiple accept="image/*" className="hidden" onChange={e => handleBulkUpload("s06Dining", e)} />
                      </label>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 1, 2].map(idx => (
                        <div key={idx}
                          draggable={!!images.s06Dining?.[idx]}
                          onDragStart={() => setDragImg({ key: "s06Dining", idx })}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => handleImgDrop("s06Dining", idx)}
                          className={`rounded-xl transition-opacity ${dragImg?.key === "s06Dining" && dragImg?.idx === idx ? "opacity-40 ring-2 ring-blue-400" : ""}`}>
                          <ImgUpload label={`하이라이트 ${idx + 1}`} src={images.s06Dining?.[idx]}
                            onChange={v => setArr("s06Dining", idx, v)} compact />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {s.S06.dining.map((f, i) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex gap-2">
                          <div className="flex-1 space-y-1">
                            <input value={f.name} placeholder="레스토랑/바 이름"
                              onChange={e => setData(d => { if (!d) return d; const fs = [...d.S06.dining]; fs[i] = { ...fs[i], name: e.target.value }; return { ...d, S06: { ...d.S06, dining: fs } }; })}
                              className="w-full text-sm font-semibold bg-transparent focus:outline-none border-b border-gray-200 pb-0.5" />
                            <input value={f.desc} placeholder="설명"
                              onChange={e => setData(d => { if (!d) return d; const fs = [...d.S06.dining]; fs[i] = { ...fs[i], desc: e.target.value }; return { ...d, S06: { ...d.S06, dining: fs } }; })}
                              className="w-full text-xs text-gray-500 bg-transparent focus:outline-none" />
                          </div>
                          <select value={f.tag}
                            onChange={e => setData(d => { if (!d) return d; const fs = [...d.S06.dining]; fs[i] = { ...fs[i], tag: e.target.value as Tag }; return { ...d, S06: { ...d.S06, dining: sortByTag(fs) } }; })}
                            className={`text-xs font-medium px-2 py-1 rounded-lg border-0 focus:outline-none self-start ${f.tag === "free" ? "bg-green-100 text-green-700" : f.tag === "paid" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                            <option value="free">포함</option>
                            <option value="partially_paid">일부유료</option>
                            <option value="paid">유료</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ④ 미포함 시설 */}
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2">④ 포함되지 않는 시설</p>
                  <div className="space-y-2">
                    {s.S06.notIncluded.map((f, i) => (
                      <div key={i} className="flex gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex-1 space-y-1">
                          <input value={f.name} placeholder="시설명"
                            onChange={e => setData(d => { if (!d) return d; const fs = [...d.S06.notIncluded]; fs[i] = { ...fs[i], name: e.target.value }; return { ...d, S06: { ...d.S06, notIncluded: fs } }; })}
                            className="w-full text-sm font-semibold bg-transparent focus:outline-none border-b border-gray-200 pb-0.5" />
                          <input value={f.desc} placeholder="설명"
                            onChange={e => setData(d => { if (!d) return d; const fs = [...d.S06.notIncluded]; fs[i] = { ...fs[i], desc: e.target.value }; return { ...d, S06: { ...d.S06, notIncluded: fs } }; })}
                            className="w-full text-xs text-gray-500 bg-transparent focus:outline-none" />
                        </div>
                        <button
                          onClick={() => setData(d => { if (!d) return d; const fs = d.S06.notIncluded.filter((_, j) => j !== i); return { ...d, S06: { ...d.S06, notIncluded: fs } }; })}
                          className="text-gray-300 hover:text-red-400 text-lg self-start leading-none">×</button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setData(d => d && { ...d, S06: { ...d.S06, notIncluded: [...d.S06.notIncluded, { name: "", desc: "" }] } })}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    <span className="text-base">+</span> 항목 추가
                  </button>
                </div>
              </div>
            </SectionCard>

            {/* S07 */}
            <SectionCard id="S07" title="기항지 일정">
              <div className="space-y-3">
                <Field label="기항지 소개" value={s.S07.intro}
                  onChange={v => setData(d => d && { ...d, S07: { ...d.S07, intro: v } })} />
                <div className="space-y-3">
                  {s.S07.ports.map((p, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-2.5">

                      {/* 기항지명 + 국가 + 자동완성 버튼 */}
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <input value={p.name}
                            onChange={e => setData(d => { if (!d) return d; const ps = [...d.S07.ports]; ps[i] = { ...ps[i], name: e.target.value }; return { ...d, S07: { ...d.S07, ports: ps } }; })}
                            onBlur={() => { if (p.name.trim() && !p.country && !portLoading.has(i)) autoCompletePort(i); }}
                            className="text-sm font-semibold text-gray-800 border-0 border-b border-gray-200 pb-1 focus:outline-none bg-transparent"
                            placeholder="기항지명 입력 후 포커스 이동 → 자동완성"
                          />
                          <input value={p.country}
                            onChange={e => setData(d => { if (!d) return d; const ps = [...d.S07.ports]; ps[i] = { ...ps[i], country: e.target.value }; return { ...d, S07: { ...d.S07, ports: ps } }; })}
                            className="text-sm text-gray-500 border-0 border-b border-gray-200 pb-1 focus:outline-none bg-transparent"
                            placeholder="국가 (자동완성)"
                          />
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => autoCompletePort(i)}
                            disabled={portLoading.has(i) || !p.name.trim()}
                            className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                          >
                            {portLoading.has(i) ? (
                              <span className="flex items-center gap-1">
                                <span className="w-3 h-3 border border-violet-400 border-t-transparent rounded-full animate-spin inline-block" />
                                생성 중
                              </span>
                            ) : "✨ 자동완성"}
                          </button>
                          <button
                            onClick={() => {
                              setData(d => { if (!d) return d; const ps = d.S07.ports.filter((_, j) => j !== i); return { ...d, S07: { ...d.S07, ports: ps } }; });
                              setPortImageOptions(prev => { const n = { ...prev }; delete n[i]; return n; });
                            }}
                            className="text-gray-300 hover:text-red-400 text-lg leading-none px-1"
                          >×</button>
                        </div>
                      </div>

                      {/* 기항지 소개 */}
                      <textarea value={p.desc} rows={2}
                        onChange={e => setData(d => { if (!d) return d; const ps = [...d.S07.ports]; ps[i] = { ...ps[i], desc: e.target.value }; return { ...d, S07: { ...d.S07, ports: ps } }; })}
                        className="w-full text-sm text-gray-600 border-0 focus:outline-none resize-none bg-gray-50 rounded-lg px-3 py-2"
                        placeholder="기항지 소개 (자동완성 또는 직접 입력)"
                      />

                      {/* 사진 업로드 */}
                      <ImgUpload label={`${p.name || `기항지 ${i+1}`} 사진`} src={images.s07Ports?.[i]}
                        onChange={v => setArr("s07Ports", i, v)} compact />

                      {/* Unsplash 이미지 픽커 */}
                      {portImageOptions[i] && portImageOptions[i].length > 0 && (
                        <div className="pt-1">
                          <p className="text-xs text-gray-400 mb-1.5">Unsplash 이미지 선택 <span className="text-gray-300">(클릭하면 적용)</span></p>
                          <div className="flex gap-1.5">
                            {portImageOptions[i].map((photo, j) => (
                              <button
                                key={j}
                                onClick={() => {
                                  setArr("s07Ports", i, photo.url);
                                  setPortImageOptions(prev => { const n = { ...prev }; delete n[i]; return n; });
                                }}
                                className="flex-1 rounded-lg overflow-hidden border-2 border-transparent hover:border-violet-400 transition-all group"
                              >
                                <img src={photo.thumb} alt="" className="w-full h-16 object-cover" />
                                <p className="text-[10px] text-gray-400 px-1 py-0.5 truncate bg-white group-hover:text-violet-600">
                                  © {photo.credit}
                                </p>
                              </button>
                            ))}
                            <button
                              onClick={() => setPortImageOptions(prev => { const n = { ...prev }; delete n[i]; return n; })}
                              className="text-xs text-gray-300 hover:text-gray-500 px-1"
                            >닫기</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setData(d => d && { ...d, S07: { ...d.S07, ports: [...d.S07.ports, { name: "", country: "", desc: "" }] } })}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  <span className="text-base">+</span> 기항지 추가
                </button>
              </div>
            </SectionCard>

            {/* S08 */}
            <SectionCard id="S08" title="유의사항 & 마무리">
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1">
                  <p className="font-medium text-gray-700">유의사항 (표준 템플릿 자동 적용)</p>
                  <p>• 예약 확정 후 취소 시 위약금이 발생할 수 있습니다.</p>
                  <p>• 출항 2~3시간 전까지 탑승 수속을 완료해야 합니다.</p>
                  <p>• 크루즈 일정은 기상 상황에 따라 변경될 수 있습니다.</p>
                  <p className="text-gray-400 mt-2">출력 시 전체 유의사항이 포함됩니다</p>
                </div>
                <Field label="마무리 감성 카피 (20자 이내)" value={s.S08.closingCopy}
                  onChange={v => setData(d => d && { ...d, S08: { closingCopy: v } })}
                  placeholder="예: 그 바다에서, 당신만의 이야기가 시작됩니다" />
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">클로징 이미지 (390×416)</p>
                  <ImgUpload label="클로징 이미지 업로드" src={images.s08Closing}
                    onChange={v => setImages(im => ({ ...im, s08Closing: v }))} />
                </div>
              </div>
            </SectionCard>

            {/* 하단 액션 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center justify-between">
              <p className="text-sm text-gray-500">편집이 완료되면 JPG/HTML로 출력할 수 있습니다</p>
              <button onClick={goToOutput} className="bg-blue-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-blue-700 text-sm">
                출력 화면으로 →
              </button>
            </div>

          </div>
        </div>

        {/* ── 우: 미리보기 패널 ── */}
        <div className="w-[430px] flex-shrink-0 border-l border-gray-200 bg-gray-100 overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between z-10">
            <span className="text-xs font-semibold text-gray-600">미리보기</span>
            <span className="text-xs text-gray-400">390px 모바일</span>
          </div>
          <div className="py-5 flex justify-center">
            <CruiseDetailPreview
              data={s}
              benefits={benefits}
              priceRows={priceRows}
              images={images}
              shippingLine={shippingLine}
              shipName={shipName}
              region={region}
              consulting={consulting}
            />
          </div>
        </div>

      </div>

      {/* ── 선사 미디어 모달 ── */}
      {mediaOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) { setMediaOpen(false); setPickerImg(null); } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

            {/* 헤더 */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="font-bold text-gray-900">🖼️ 선사 미디어 이미지 불러오기</p>
                <p className="text-xs text-gray-400 mt-0.5">선사 뉴스룸·미디어 페이지 URL을 입력하면 이미지를 자동으로 수집합니다</p>
              </div>
              <button onClick={() => { setMediaOpen(false); setPickerImg(null); }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            {/* URL 입력 */}
            <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex gap-2">
                <input
                  value={mediaUrl}
                  onChange={e => setMediaUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && scrapeMedia()}
                  placeholder="예: https://www.ncl.com/in/en/newsroom/multimedia/#"
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button onClick={scrapeMedia} disabled={scrapeLoading || !mediaUrl.trim()}
                  className="text-sm font-semibold px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40">
                  {scrapeLoading ? "수집 중…" : "불러오기"}
                </button>
              </div>
              {scrapeError && <p className="text-xs text-red-500 mt-2">{scrapeError}</p>}
              {scrapeLoading && (
                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
                  <span className="w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full animate-spin inline-block" />
                  페이지를 분석하는 중입니다 (최대 30초)…
                </p>
              )}
            </div>

            {/* 이미지 그리드 */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {mediaImages.length === 0 && !scrapeLoading && (
                <div className="text-center py-16 text-gray-300 text-sm">
                  URL을 입력하고 불러오기를 눌러주세요
                </div>
              )}
              {mediaImages.length > 0 && (
                <>
                  <p className="text-xs text-gray-400 mb-3">{mediaImages.length}장 수집됨 — 이미지를 클릭하면 섹션에 배정할 수 있습니다</p>
                  <div className="grid grid-cols-3 gap-3">
                    {mediaImages.map((imgUrl, j) => (
                      <div key={j} className={`rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${pickerImg === imgUrl ? "border-blue-500 shadow-lg" : "border-transparent hover:border-gray-300"}`}
                        onClick={() => setPickerImg(pickerImg === imgUrl ? null : imgUrl)}>
                        <img src={imgUrl} alt="" className="w-full h-28 object-cover" onError={e => (e.currentTarget.style.display = "none")} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 배정 패널 — 이미지 선택 시 표시 */}
            {pickerImg && (
              <div className="border-t border-blue-100 bg-blue-50 px-6 py-4 flex-shrink-0">
                <p className="text-xs font-bold text-blue-700 mb-3">선택한 이미지를 배정할 섹션을 선택하세요</p>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => assignImage(pickerImg, "s01Hero")} className="text-xs px-2.5 py-1 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:text-blue-600">S01 배경</button>
                  {[0,1,2,3].map(idx => (
                    <button key={idx} onClick={() => assignImage(pickerImg, "s03Highlights", idx)} className="text-xs px-2.5 py-1 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:text-blue-600">
                      S03 하이라이트 {idx+1}
                    </button>
                  ))}
                  <button onClick={() => assignImage(pickerImg, "s04Ship")} className="text-xs px-2.5 py-1 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:text-blue-600">S04 선박</button>
                  {s.S05.cabinTypes.map((c, idx) => (
                    <button key={idx} onClick={() => assignImage(pickerImg, "s05CabinPhoto", idx)} className="text-xs px-2.5 py-1 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:text-blue-600">
                      S05 {c.name}
                    </button>
                  ))}
                  {s.S06.mainFacilities.map((_, idx) => (
                    <button key={idx} onClick={() => assignImage(pickerImg, "s06Main", idx)} className="text-xs px-2.5 py-1 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:text-blue-600">
                      S06 주요시설 {idx+1}
                    </button>
                  ))}
                  {s.S06.kidsFacilities.map((_, idx) => (
                    <button key={idx} onClick={() => assignImage(pickerImg, "s06Kids", idx)} className="text-xs px-2.5 py-1 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:text-blue-600">
                      S06 어린이 {idx+1}
                    </button>
                  ))}
                  {s.S06.dining.map((_, idx) => (
                    <button key={idx} onClick={() => assignImage(pickerImg, "s06Dining", idx)} className="text-xs px-2.5 py-1 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:text-blue-600">
                      S06 다이닝 {idx+1}
                    </button>
                  ))}
                  {s.S07.ports.map((p, idx) => (
                    <button key={idx} onClick={() => assignImage(pickerImg, "s07Ports", idx)} className="text-xs px-2.5 py-1 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:text-blue-600">
                      S07 {p.name || `기항지 ${idx+1}`}
                    </button>
                  ))}
                  <button onClick={() => assignImage(pickerImg, "s08Closing")} className="text-xs px-2.5 py-1 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:text-blue-600">S08 클로징</button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

// ── 페이지 진입점 ────────────────────────────────────────────
export default function EditPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params);
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <EditContent productId={productId} />
    </Suspense>
  );
}
