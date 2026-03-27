"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ProductSummary = {
  id:           string;
  shippingLine: string;
  shipName:     string;
  region:       string;
  thumbnail?:   string;
  createdAt:    string;
  updatedAt:    string;
};

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

// 썸네일 없을 때 선박명 기반 그라디언트 색상
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

  // NCL 동기화 상태
  const [nclStatus,  setNclStatus]  = useState<NclStatus>({ synced: false });
  const [nclSyncing, setNclSyncing] = useState(false);
  const [nclError,   setNclError]   = useState("");

  useEffect(() => {
    fetch("/api/products")
      .then(r => r.json())
      .then(res => { if (res.ok) setProducts(res.products); })
      .finally(() => setLoading(false));
    // NCL 캐시 상태 확인
    fetch("/api/ncl-sync")
      .then(r => r.json())
      .then(res => { if (res.ok) setNclStatus(res); })
      .catch(() => {});
  }, []);

  async function handleNclSync() {
    setNclSyncing(true);
    setNclError("");
    try {
      const res  = await fetch("/api/ncl-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const json = await res.json();
      if (json.ok) {
        setNclStatus({ synced: true, total: json.total, lastSynced: json.lastSynced });
      } else {
        setNclError(json.error ?? "동기화 실패");
      }
    } catch (e) {
      setNclError(String(e));
    } finally {
      setNclSyncing(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 상품을 삭제할까요?")) return;
    setDeleting(id);
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    setProducts(ps => ps.filter(p => p.id !== id));
    setDeleting(null);
    setMenuOpen(null);
  }

  return (
    <div className="min-h-screen bg-gray-50" onClick={() => setMenuOpen(null)}>
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium">마이리얼트립 내부 툴</p>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">크루즈 상세페이지 자동화</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* NCL 뉴스룸 동기화 */}
            <div className="flex items-center gap-2">
              {nclStatus.synced ? (
                <span className="text-xs text-gray-400">
                  NCL 이미지 {nclStatus.total?.toLocaleString()}장 · {nclStatus.lastSynced ? timeAgo(nclStatus.lastSynced) : ""} 동기화됨
                </span>
              ) : (
                <span className="text-xs text-orange-500">NCL 이미지 미동기화</span>
              )}
              <button onClick={handleNclSync} disabled={nclSyncing}
                className="text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-50 flex items-center gap-1.5">
                {nclSyncing
                  ? <><span className="w-3 h-3 border border-gray-400 border-t-blue-500 rounded-full animate-spin" /> NCL 동기화 중…</>
                  : "🔄 NCL 이미지 동기화"}
              </button>
              {nclError && <span className="text-xs text-red-500">{nclError}</span>}
            </div>
            <Link href="/new"
              className="bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-blue-700 flex items-center gap-1.5 transition-colors shadow-sm">
              <span className="text-base leading-none">+</span> 상세페이지 만들기
            </Link>
          </div>
        </div>
      </header>

      {/* 본문 */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">내 상품</h2>
          <p className="text-sm text-gray-400">{products.length}개의 상세페이지</p>
        </div>

        {/* 로딩 */}
        {loading && (
          <div className="grid grid-cols-3 gap-5">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
                <div className="h-44 bg-gray-100" />
                <div className="p-4 space-y-2.5">
                  <div className="h-4 bg-gray-100 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-8 bg-gray-100 rounded mt-3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && products.length === 0 && (
          <div className="text-center py-24">
            <p className="text-4xl mb-4">🚢</p>
            <p className="text-lg font-semibold text-gray-700 mb-2">아직 만든 상품이 없어요</p>
            <p className="text-sm text-gray-400 mb-6">첫 번째 크루즈 상세페이지를 만들어보세요</p>
            <Link href="/new"
              className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
              + 상세페이지 만들기
            </Link>
          </div>
        )}

        {/* 상품 그리드 */}
        {!loading && products.length > 0 && (
          <div className="grid grid-cols-3 gap-5">
            {products.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group">

                {/* 썸네일 */}
                <div className="relative h-44 overflow-hidden">
                  {p.thumbnail ? (
                    <img src={p.thumbnail} alt={p.shipName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${gradient(p.id)} flex items-center justify-center`}>
                      <span className="text-white/80 text-4xl">🚢</span>
                    </div>
                  )}
                  {/* 케밥 메뉴 */}
                  <div className="absolute top-2.5 right-2.5" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)}
                      className="w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full text-white flex items-center justify-center text-sm transition-colors">
                      ···
                    </button>
                    {menuOpen === p.id && (
                      <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-28 z-20">
                        <button onClick={() => router.push(`/edit/${p.id}?shippingLine=${encodeURIComponent(p.shippingLine)}&shipName=${encodeURIComponent(p.shipName)}&region=${encodeURIComponent(p.region)}&fromDB=1`)}
                          className="w-full text-left text-sm px-3.5 py-2 hover:bg-gray-50 text-gray-700">편집</button>
                        <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                          className="w-full text-left text-sm px-3.5 py-2 hover:bg-red-50 text-red-500 disabled:opacity-40">
                          {deleting === p.id ? "삭제 중…" : "삭제"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 카드 정보 */}
                <div className="p-4">
                  <p className="font-bold text-gray-900 truncate">{p.shipName}</p>
                  <p className="text-sm text-gray-500 truncate mt-0.5">{p.shippingLine}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-medium truncate max-w-[160px]">
                      {p.region}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">{timeAgo(p.updatedAt)}</p>

                  {/* 액션 버튼 */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => router.push(`/edit/${p.id}?shippingLine=${encodeURIComponent(p.shippingLine)}&shipName=${encodeURIComponent(p.shipName)}&region=${encodeURIComponent(p.region)}&fromDB=1`)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold bg-blue-600 text-white py-2 rounded-xl hover:bg-blue-700 transition-colors">
                      ✏️ 편집
                    </button>
                    <button
                      onClick={() => router.push(`/output/${p.id}?shippingLine=${encodeURIComponent(p.shippingLine)}&shipName=${encodeURIComponent(p.shipName)}&region=${encodeURIComponent(p.region)}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold border border-gray-200 text-gray-600 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                      👁 미리보기
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
