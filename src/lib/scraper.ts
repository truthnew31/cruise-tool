import * as cheerio from "cheerio";
import { classifyPricingTag } from "@/types/cruise";
import type { FacilityItem } from "@/types/cruise";

// ── Cheerio 스크래핑 (정적 HTML) ──
export async function scrapeStaticUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

// 텍스트만 추출 (스크립트/스타일 제거)
export function extractText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, img").remove();
  return $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000);
}

// ── 시설 목록 파싱 (S06용) ──
export function parseFacilitiesFromText(rawText: string): FacilityItem[] {
  // 줄 단위 분리 → 각 줄을 시설 후보로 처리
  const lines = rawText
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 3 && l.length < 200);

  const facilities: FacilityItem[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    // 너무 짧거나 숫자만 있는 줄 제외
    if (/^\d+$/.test(line)) continue;
    const key = line.toLowerCase().slice(0, 30);
    if (seen.has(key)) continue;
    seen.add(key);

    const { tag, reviewFlag } = classifyPricingTag(line);
    facilities.push({
      facilityKey: key.replace(/\s+/g, "_"),
      category: "facility",
      name: line.slice(0, 60),
      description: "",
      parsedTag: tag,
      userOverride: null,
      resolvedTag: tag,
      reviewFlag,
      image: { url: "", alt: line.slice(0, 40) },
      featured: false,
    });

    if (facilities.length >= 20) break;
  }

  return facilities;
}

// ── 선박 스펙 파싱 ──
export function parseShipSpecs(text: string): Record<string, string> {
  const specs: Record<string, string> = {};
  const patterns: [string, RegExp][] = [
    ["yearBuilt",          /(?:건조|취항|built|launched)[^\d]*(\d{4})/i],
    ["grossTonnage",       /(\d[\d,]+)\s*(?:GT|gross ton|총톤)/i],
    ["passengerCapacity",  /(\d[\d,]+)\s*(?:명|guests?|passengers?|승객)/i],
    ["crewCount",          /(\d[\d,]+)\s*(?:crew|승무원|乗組員)/i],
    ["lengthM",            /(?:length|길이|전장)[^\d]*(\d+(?:\.\d+)?)\s*m/i],
    ["widthM",             /(?:width|beam|폭|선폭)[^\d]*(\d+(?:\.\d+)?)\s*m/i],
  ];

  for (const [key, re] of patterns) {
    const m = text.match(re);
    if (m) specs[key] = m[1].replace(/,/g, "");
  }
  return specs;
}

// ── cruisia.co.kr 감지 ──
export function isCruisiaSite(url: string): boolean {
  return url.includes("cruisia.co.kr");
}
