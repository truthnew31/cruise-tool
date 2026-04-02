"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ⚠️ 구글 시트 URL — 실제 URL로 교체하세요
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1oJWf3i1CkVH8of-oi5PoI7ej3XVze2esh9BBR49s9qc/edit";

type ProductSummary = {
  id:           string;
  shippingLine: string;
  shipName:     string;
  region:       string;
  thumbnail?:   string;
  createdAt:    string;
  updatedAt:    string;
  productType?: string;
  productName?: string;
};

// ── 지역 폴더 정의 ───────────────────────────────────────────
const REGION_FOLDERS = [
  { label: "미주",     keywords: ["미국", "캐나다", "알래스카", "카리브", "멕시코", "버뮤다", "바하마", "하와이", "마이애미", "시애틀", "뉴욕"] },
  { label: "대양주",   keywords: ["호주", "뉴질랜드", "피지", "남태평양", "시드니", "오클랜드"] },
  { label: "일본",     keywords: ["일본", "오키나와", "도쿄", "오사카", "나가사키", "요코하마", "삿포로"] },
  { label: "중화권",   keywords: ["중국", "홍콩", "대만", "마카오", "상하이", "베이징"] },
  { label: "동남아",   keywords: ["싱가포르", "태국", "베트남", "필리핀", "인도네시아", "말레이시아", "발리", "방콕", "푸켓", "다낭", "세부", "코타키나발루"] },
  { label: "남부유럽", keywords: ["지중해", "이탈리아", "그리스", "스페인", "포르투갈", "크로아티아", "터키", "몰타", "두브로브니크", "아테네", "바르셀로나", "로마"] },
  { label: "중부유럽", keywords: ["북유럽", "노르웨이", "피오르드", "발틱", "독일", "프랑스", "영국", "네덜란드", "덴마크", "스웨덴", "핀란드", "아이슬란드", "스위스", "오스트리아"] },
] as const;

function getFolder(region: string): string {
  const lower = region.toLowerCase();
  for (const folder of REGION_FOLDERS) {
    if (folder.keywords.some(k => lower.includes(k.toLowerCase()))) {
      return folder.label;
    }
  }
  return "기타";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 1)   return "방금 전";
  if (m < 60)  return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

const GRADIENTS = [
  "from-blue-400 to-cyan-500",
  "from-violet-400 to-purple-600",
  "from-emerald-400 to-teal-600",
  "from-orange-400 to-rose-500",
  "from-sky-400 to-indigo-600",
  "from-pink-400 to-rose-600",
];
function gradient(id: string) {
  let n = 0;
  for (const c of id) n += c.charCodeAt(0);
  return GRADIENTS[n % GRADIENTS.length];
}

type NclStatus = { synced: boolean; total?: number; lastSynced?: string };

export default function HomePage() {
  const router  = useRouter();
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<string>("전체");

  const [nclStatus,  setNclStatus]  = useState<NclStatus>({ synced: false });
  const [nclSyncing, setNclSyncing] = useState(false);
  const [nclError,   setNclError]   = useState("");

  useEffect(() => {
    fetch("/api/products")
      .then(r => r.json())
      .then(res => { if (res.ok) setProducts(res.products); })
      .finally(() => setLoading(false));
    fetch("/api/ncl-sync")
      .then(r => r.json())
      .then(res => { if (res.ok) setNclStatus(res); })
      .catch(() => {});
  }, []);

  async function handleNclSync() {
    setNclSyncing(true); setNclError("");
    try {
      const res  = await fetch("/api/ncl-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const json = await res.json();
      if (json.ok) setNclStatus({ synced: true, total: json.total, lastSynced: json.lastSynced });
      else setNclError(json.error ?? "동기화 실패");
    } catch (e) { setNclError(String(e)); }
    finally { setNclSyncing(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 상품을 삭제할까요?")) return;
    setDeleting(id);
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    setProducts(ps => ps.filter(p => p.id !== id));
    setDeleting(null); setMenuOpen(null);
  }

  function editUrl(p: ProductSummary) {
    if (p.productType === "tour") {
      return `/edit-tour/${p.id}?fromDB=1&productName=${encodeURIComponent(p.productName ?? p.shipName)}&region=${encodeURIComponent(p.region)}&duration=`;
    }
    return `/edit/${p.id}?fromDB=1&shippingLine=${encodeURIComponent(p.shippingLine)}&shipName=${encodeURIComponent(p.shipName)}&region=${encodeURIComponent(p.region)}`;
  }
  function outputUrl(p: ProductSummary) {
    if (p.productType === "tour") {
      return `/output-tour/${p.id}?productName=${encodeURIComponent(p.productName ?? p.shipName)}&region=${encodeURIComponent(p.region)}`;
    }
    return `/output/${p.id}?shippingLine=${encodeURIComponent(p.shippingLine)}&shipName=${encodeURIComponent(p.shipName)}&region=${encodeURIComponent(p.region)}`;
  }

  // 폴더별 카운트
  const folderCounts: Record<string, number> = { 전체: products.length };
  for (const p of products) {
    const f = getFolder(p.region);
    folderCounts[f] = (folderCounts[f] ?? 0) + 1;
  }

  // 필터된 상품
  const filtered = activeFolder === "전체"
    ? products
    : products.filter(p => getFolder(p.region) === activeFolder);

  const folders = ["전체", ...REGION_FOLDERS.map(f => f.label), "기타"];

  return (
    <div className="min-h-screen bg-gray-50" onClick={() => setMenuOpen(null)}>

      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 font-medium">마이리얼트립 내부 툴</p>
            <h1 className="text-base font-bold text-gray-900 leading-tight">상세페이지 자동화</h1>
          </div>

          {/* NCL 동기화 */}
          <div className="hidden md:flex items-center gap-2">
            {nclStatus.synced ? (
              <span className="text-xs text-gray-400">NCL {nclStatus.total?.toLocaleString()}장 · {nclStatus.lastSynced ? timeAgo(nclStatus.lastSynced) : ""}</span>
            ) : (
              <span className="text-xs text-orange-500">NCL 미동기화</span>
            )}
            <button onClick={handleNclSync} disabled={nclSyncing}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-50 flex items-center gap-1">
              {nclSyncing ? <><span className="w-3 h-3 border border-gray-400 border-t-blue-500 rounded-full animate-spin" />동기화 중…</> : "🔄 NCL 동기화"}
            </button>
            {nclError && <span className="text-xs text-red-500">{nclError}</span>}
          </div>

          {/* 구글 시트 링크 */}
          <a href={SHEET_URL} target="_blank" rel="noopener noreferrer"
            className="text-sm font-semibold px-3.5 py-2 rounded-xl border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 flex items-center gap-1.5 transition-colors">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
              <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            구글 시트
          </a>

          <Link href="/new"
            className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 flex items-center gap-1.5 transition-colors shadow-sm">
            <span className="text-base leading-none">+</span> 만들기
          </Link>
        </div>
      </header>

      {/* 바디: 사이드바 + 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">

        {/* 사이드바 */}
        <aside className="w-44 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-20">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">지역</p>
            </div>
            <nav className="py-1.5">
              {folders.map(folder => {
                const count = folderCounts[folder] ?? 0;
                if (folder !== "전체" && count === 0) return null;
                const isActive = activeFolder === folder;
                return (
                  <button key={folder} onClick={() => setActiveFolder(folder)}
                    className={`w-full text-left flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}>
                    <span>{folder}</span>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${
                      isActive ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"
                    }`}>{count}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">
              {activeFolder === "전체" ? "전체 상품" : activeFolder}
            </h2>
            <p className="text-sm text-gray-400">{filtered.length}개</p>
          </div>

          {/* 로딩 */}
          {loading && (
            <div className="grid grid-cols-3 gap-5">
              {[1,2,3].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
                  <div className="h-40 bg-gray-100" />
                  <div className="p-4 space-y-2"><div className="h-4 bg-gray-100 rounded w-2/3" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>
                </div>
              ))}
            </div>
          )}

          {/* 빈 상태 */}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-20">
              <p className="text-3xl mb-3">{activeFolder === "전체" ? "🚢" : "📂"}</p>
              <p className="text-base font-semibold text-gray-700 mb-2">
                {activeFolder === "전체" ? "아직 만든 상품이 없어요" : `${activeFolder} 지역 상품이 없어요`}
              </p>
              {activeFolder === "전체" && (
                <Link href="/new" className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors mt-2">
                  + 상세페이지 만들기
                </Link>
              )}
            </div>
          )}

          {/* 상품 그리드 */}
          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-3 gap-5">
              {filtered.map(p => {
                const isTour = p.productType === "tour";
                const displayName = isTour ? (p.productName || p.shipName) : p.shipName;
                const displaySub  = isTour ? p.region : p.shippingLine;
                return (
                  <div key={p.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group">
                    {/* 썸네일 */}
                    <div className="relative h-40 overflow-hidden">
                      {p.thumbnail ? (
                        <img src={p.thumbnail} alt={displayName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${gradient(p.id)} flex items-center justify-center`}>
                          <span className="text-white/80 text-3xl">{isTour ? "✈️" : "🚢"}</span>
                        </div>
                      )}
                      {/* 유형 배지 */}
                      <span className={`absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-md ${
                        isTour ? "bg-orange-500 text-white" : "bg-blue-600 text-white"
                      }`}>{isTour ? "투어" : "크루즈"}</span>
                      {/* 케밥 메뉴 */}
                      <div className="absolute top-2 right-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)}
                          className="w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full text-white flex items-center justify-center text-sm transition-colors">···</button>
                        {menuOpen === p.id && (
                          <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-28 z-20">
                            <button onClick={() => router.push(editUrl(p))}
                              className="w-full text-left text-sm px-3.5 py-2 hover:bg-gray-50 text-gray-700">편집</button>
                            <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                              className="w-full text-left text-sm px-3.5 py-2 hover:bg-red-50 text-red-500 disabled:opacity-40">
                              {deleting === p.id ? "삭제 중…" : "삭제"}</button>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* 카드 정보 */}
                    <div className="p-4">
                      <p className="font-bold text-gray-900 truncate text-sm">{displayName}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{displaySub}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-medium">{getFolder(p.region)}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md truncate max-w-[120px]">{p.region}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">{timeAgo(p.updatedAt)}</p>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => router.push(editUrl(p))}
                          className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 transition-colors">
                          ✏️ 편집
                        </button>
                        <button onClick={() => router.push(outputUrl(p))}
                          className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold border border-gray-200 text-gray-600 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                          👁 미리보기
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
