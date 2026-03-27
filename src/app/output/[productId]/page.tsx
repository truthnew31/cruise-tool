"use client";

import { use, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { BenefitKey } from "@/types/cruise";
import type { ImageStore } from "@/types/images";
import CruiseDetailPreview, { type PreviewData } from "@/components/CruiseDetailPreview";

type BenefitSel = { key: BenefitKey; enabled: boolean };
type PriceRow = { id: string; cabin: string; guests: number; total: number; note: string };

// ── 출력 본체 ────────────────────────────────────────────────
function OutputContent({ productId }: { productId: string }) {
  const sp = useSearchParams();
  const shippingLine = sp.get("shippingLine") ?? "";
  const shipName     = sp.get("shipName")     ?? "";
  const region       = sp.get("region")       ?? "";

  const [data, setData]           = useState<PreviewData | null>(null);
  const [benefits, setBenefits]   = useState<BenefitSel[]>([]);
  const [priceRows, setPriceRows] = useState<PriceRow[]>([]);
  const [images, setImages]       = useState<ImageStore>({});
  const [exporting, setExporting] = useState<"jpg" | "html" | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ① localStorage 먼저 시도
    try {
      const raw = localStorage.getItem(`cruise_output_${productId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.data) {
          setData(parsed.data);
          setBenefits(parsed.benefits ?? []);
          setPriceRows(parsed.priceRows ?? []);
          setImages(parsed.images ?? {});
          return; // localStorage에 있으면 DB 조회 불필요
        }
      }
    } catch {}
    // ② localStorage에 없으면 DB에서 로드 (갤러리 → 미리보기 경로)
    fetch(`/api/products/${productId}`)
      .then(r => r.json())
      .then(res => {
        if (res.ok && res.product) {
          const p = res.product;
          setData(p.data);
          setBenefits(p.benefits ?? []);
          setPriceRows(p.priceRows ?? []);
          setImages(p.images ?? {});
          // 이후 편집→미리보기 이동을 위해 localStorage에도 저장
          localStorage.setItem(`cruise_output_${productId}`, JSON.stringify({
            data: p.data, benefits: p.benefits, priceRows: p.priceRows, images: p.images, consulting: p.consulting,
          }));
        }
      })
      .catch(() => {});
  }, [productId]);

  function buildHtmlString() {
    if (!outputRef.current) return "";
    const styles = Array.from(document.styleSheets)
      .flatMap(s => { try { return Array.from(s.cssRules).map(r => r.cssText); } catch { return []; } })
      .join("\n");
    return `<!DOCTYPE html>\n<html lang="ko">\n<head>\n<meta charset="UTF-8"/>\n<title>${shippingLine} ${shipName} 상세페이지</title>\n<style>${styles}</style>\n</head>\n<body style="margin:0">\n${outputRef.current.outerHTML}\n</body>\n</html>`;
  }

  async function handleJpg() {
    if (!outputRef.current) return;
    setExporting("jpg");

    // ── 색상 변환 헬퍼 (Canvas API로 oklch/oklab → rgb 변환) ──────────
    const tmpCvs = document.createElement("canvas");
    tmpCvs.width = tmpCvs.height = 1;
    const ctx = tmpCvs.getContext("2d")!;
    function toRgb(color: string): string {
      try {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        if (a === 0) return "transparent";
        return a < 255 ? `rgba(${r},${g},${b},${(a / 255).toFixed(3)})` : `rgb(${r},${g},${b})`;
      } catch { return color; }
    }
    // oklch/oklab 패턴 모두 rgb로 치환 (그라디언트 내부 포함)
    function convertOklch(css: string): string {
      return css.replace(/(oklch|oklab)\([^)]+\)/g, m => toRgb(m));
    }

    // ── 1. 모든 요소에 computed style → inline style 적용 ─────────────
    const elements = [outputRef.current, ...outputRef.current.querySelectorAll("*")] as HTMLElement[];
    const savedStyles = elements.map(el => el.getAttribute("style") ?? "");
    elements.forEach(el => {
      const cs = window.getComputedStyle(el);
      el.setAttribute("style", convertOklch(cs.cssText));
    });

    // ── 2. 스타일시트 임시 비활성화 (oklch 파싱 오류 차단) ────────────
    const sheets = Array.from(document.styleSheets);
    sheets.forEach(s => { try { s.disabled = true; } catch { /* cross-origin 무시 */ } });

    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(outputRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `${shippingLine}_${shipName}_${region}.jpg`.replace(/\s+/g, "_");
      link.href = canvas.toDataURL("image/jpeg", 0.92);
      link.click();
    } catch (e) {
      alert("JPG 저장 실패: " + String(e));
    } finally {
      // ── 3. 스타일시트 복원 ────────────────────────────────────────────
      sheets.forEach(s => { try { s.disabled = false; } catch { /* ignore */ } });
      // ── 4. inline style 복원 ─────────────────────────────────────────
      elements.forEach((el, i) => {
        if (savedStyles[i]) el.setAttribute("style", savedStyles[i]);
        else el.removeAttribute("style");
      });
      setExporting(null);
    }
  }

  function handleHtml() {
    if (!outputRef.current) return;
    setExporting("html");
    const html = buildHtmlString();
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const link = document.createElement("a");
    link.download = `${shippingLine}_${shipName}_${region}.html`.replace(/\s+/g, "_");
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    setExporting(null);
  }

  if (!data) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center space-y-3">
        <p className="text-gray-500">데이터를 불러올 수 없습니다.</p>
        <Link href="/new" className="text-blue-600 text-sm underline">← 새 상품 만들기</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-200">
      {/* 툴바 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 print:hidden">
        <div className="max-w-[600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← 홈</Link>
            <span className="text-gray-200">|</span>
            <Link
              href={`/edit/${productId}?shippingLine=${encodeURIComponent(shippingLine)}&shipName=${encodeURIComponent(shipName)}&region=${encodeURIComponent(region)}&fromDB=1`}
              className="text-sm text-gray-400 hover:text-gray-600"
            >편집으로</Link>
            <span className="text-sm font-semibold text-gray-800 truncate max-w-[240px]">
              {shippingLine} · {shipName} · {region}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleHtml} disabled={!!exporting}
              className="text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50">
              {exporting === "html" ? "저장 중…" : "HTML 저장"}
            </button>
            <button onClick={handleJpg} disabled={!!exporting}
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {exporting === "jpg" ? "저장 중…" : "JPG 저장"}
            </button>
          </div>
        </div>
      </div>

      {/* 출력 영역 */}
      <div className="py-8">
        <div ref={outputRef} className="mx-auto w-fit">
          <CruiseDetailPreview
            data={data}
            benefits={benefits}
            priceRows={priceRows}
            images={images}
            shippingLine={shippingLine}
            shipName={shipName}
            region={region}
          />
        </div>
      </div>
    </div>
  );
}

export default function OutputPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params);
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <OutputContent productId={productId} />
    </Suspense>
  );
}
