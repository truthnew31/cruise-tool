// POST /api/ncl-sync
// NCL 뉴스룸 스크래핑 전략:
//   ① 각 선박 아코디언 클릭 → 서브카테고리 ID 수집
//   ② 각 서브카테고리 클릭 → AJAX 완료 대기(waitForSelector) → 이미지 수집
//   선박명은 현재 처리 중인 필터에서 직접 지정 (파일명 파싱 불필요)

import puppeteer, { type Page } from "puppeteer";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const NCL_URL    = "https://www.ncl.com/in/en/newsroom/multimedia/#";
const CACHE_PATH = path.join(process.cwd(), "data", "ncl-images.json");

// 선박 슬러그 → 정식 선박명
const SHIP_SLUGS: Record<string, string> = {
  "norwegianaura":      "Norwegian Aura",
  "aqua":               "Norwegian Aqua",
  "norwegianbliss":     "Norwegian Bliss",
  "norwegianbreakaway": "Norwegian Breakaway",
  "norwegiandawn":      "Norwegian Dawn",
  "norwegianencore":    "Norwegian Encore",
  "norwegianepic":      "Norwegian Epic",
  "norwegianescape":    "Norwegian Escape",
  "norwegiangem":       "Norwegian Gem",
  "norwegiangetaway":   "Norwegian Getaway",
  "norwegianjade":      "Norwegian Jade",
  "norwegianjewel":     "Norwegian Jewel",
  "norwegianjoy":       "Norwegian Joy",
  "luna":               "Norwegian Luna",
  "norwegianpearl":     "Norwegian Pearl",
  "norwegianprima":     "Norwegian Prima",
  "norwegiansky":       "Norwegian Sky",
  "norwegianspirit":    "Norwegian Spirit",
  "norwegianstar":      "Norwegian Star",
  "norwegiansun":       "Norwegian Sun",
  "norwegianviva":      "Norwegian Viva",
  "prideofamerica":     "Pride of America",
};

// 서브카테고리 텍스트 → 섹션 카테고리
const SUBCAT_CATEGORY: Record<string, string> = {
  "aerial":             "Ship Exterior",
  "ship interior":      "Ship Exterior",
  "ship exterior":      "Ship Exterior",
  "staterooms":         "Cabin",         // 세부는 title로 재분류
  "food & beverage":    "Dining",
  "bar & lounge":       "Bar & Lounge",
  "onboard activities": "Sports",
  "entertainment":      "Entertainment",
  "lifestyle":          "General",
  "the haven":          "Suite",
  "haven":              "Suite",
  "spa":                "Spa",
  "casino":             "Casino",
  "kids":               "Kids & Family",
  "family":             "Kids & Family",
};

function subcatToCategory(subcatText: string): string {
  const t = subcatText.toLowerCase();
  for (const [key, cat] of Object.entries(SUBCAT_CATEGORY)) {
    if (t.includes(key)) return cat;
  }
  return "General";
}

// 타이틀에서 캐빈 세부 카테고리 재분류
function refineCabinCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("haven") || t.includes("suite") || t.includes("penthouse") || t.includes("villa")) return "Suite";
  if (t.includes("balcony")) return "Balcony Cabin";
  if (t.includes("inside") || t.includes("studio")) return "Inside Cabin";
  return "Cabin";
}

// 카테고리 키워드 감지 (타이틀 기반 보조)
const CATEGORY_KEYWORDS: [string, string[]][] = [
  ["Ship Exterior",  ["aerial", "exterior", "at sea", "bow", "stern"]],
  ["Pool & Deck",    ["pool", "waterslide", "sun deck", "splash", "waterpark", "aqua park"]],
  ["Spa",            ["spa", "mandara", "thermal", "sauna", "wellness", "massage"]],
  ["Casino",         ["casino"]],
  ["Kids & Family",  ["kids", "youth", "splash zone", "teen", "children", "family"]],
  ["Dining",         ["dining", "restaurant", "buffet", "café", "cafe", "food", "taste", "savor"]],
  ["Bar & Lounge",   ["bar", "pub", "ale house", "lounge", "wine", "brewery"]],
  ["Entertainment",  ["theater", "show", "stage", "comedy", "music", "jazz", "piano"]],
  ["Suite",          ["haven", "suite", "penthouse", "villa", "owner"]],
  ["Balcony Cabin",  ["balcony stateroom", "balcony cabin"]],
  ["Inside Cabin",   ["inside stateroom", "inside cabin", "studio"]],
  ["Sports",         ["sports", "rock climbing", "laser", "go kart", "bowling", "mini golf", "fitness", "gym", "racquet"]],
];

function detectCategory(text: string): string {
  const t = text.toLowerCase();
  for (const [cat, kws] of CATEGORY_KEYWORDS) {
    if (kws.some(k => t.includes(k))) return cat;
  }
  return "General";
}

export interface NclImage {
  url:      string;
  thumb:    string;
  title:    string;
  ship:     string;
  category: string;
}
export interface NclCache {
  lastSynced: string;
  total:      number;
  images:     NclImage[];
}

export function readCache(): NclCache | null {
  if (!existsSync(CACHE_PATH)) return null;
  try { return JSON.parse(readFileSync(CACHE_PATH, "utf-8")); }
  catch { return null; }
}

// 서브카테고리 하나 처리: 클릭 → 대기 → Load More → 수집
async function scrapeSubcat(
  page: Page,
  subcatId: string,
  shipName: string,
  subcatText: string
): Promise<NclImage[]> {
  // 클릭
  await page.click(`li#${subcatId}`);

  // AJAX 완료 대기 (이미지 DOM 사라졌다가 다시 생김)
  await new Promise(r => setTimeout(r, 500));
  try {
    await page.waitForSelector(".pp_medialibrary_item", { timeout: 12000 });
  } catch {
    return []; // 이미지 없는 서브카테고리
  }
  await new Promise(r => setTimeout(r, 1000));

  // Load More 반복
  for (let i = 0; i < 10; i++) {
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector<HTMLElement>(".js-pp-medialib-showmore");
      if (!btn) return false;
      const cs = window.getComputedStyle(btn);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      btn.click();
      return true;
    });
    if (!clicked) break;
    await new Promise(r => setTimeout(r, 1200));
  }

  // 이미지 수집
  const rawItems = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLAnchorElement>(".pp_medialibrary_item")).map(el => ({
      filename:    el.getAttribute("data-filename") ?? "",
      dataTitle:   el.getAttribute("data-title")    ?? "",
      href:        el.getAttribute("href")           ?? "",
      description: el.getAttribute("data-description") ?? "",
    }))
  );

  const baseCat = subcatToCategory(subcatText);

  return rawItems
    .filter(item => item.href && item.filename)
    .map(item => {
      const thumb = item.href;
      const url   = thumb.replace(/\/800_/, "/");
      const title = item.dataTitle.split(" _ ")[0].trim() || item.filename.replace(/\.(jpg|jpeg|png|webp)$/i, "");

      // 캐빈 세부 분류
      let category = baseCat;
      if (baseCat === "Cabin") {
        category = refineCabinCategory(title + " " + item.description);
      } else if (baseCat === "Sports" || baseCat === "General") {
        // 타이틀로 재분류 시도
        const detected = detectCategory(title + " " + item.description);
        if (detected !== "General") category = detected;
      }

      return { url, thumb, title, ship: shipName, category };
    });
}

// ── POST: 동기화 ─────────────────────────────────────────────────
export async function POST(request: Request) {
  // Vercel 서버리스 환경에서는 Puppeteer 실행 불가 (Chrome 미지원 + 타임아웃 제한)
  if (process.env.VERCEL) {
    return Response.json({
      error: "vercel_env",
      message: "NCL 동기화는 로컬 환경에서만 실행 가능합니다. 로컬 PC에서 'npm run dev' 후 동기화를 실행해주세요.",
    }, { status: 503 });
  }

  let targetSlug: string | undefined;
  try {
    const body = await request.json();
    targetSlug = body?.shipSlug;
  } catch { /* 전체 동기화 */ }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1440, height: 900 });

    console.log("[ncl-sync] 페이지 로딩...");
    await page.goto(NCL_URL, { waitUntil: "domcontentloaded", timeout: 90000 });
    await new Promise(r => setTimeout(r, 5000));

    // 동기화할 선박 목록
    const slugsToProcess = targetSlug
      ? (SHIP_SLUGS[targetSlug] ? [targetSlug] : [])
      : Object.keys(SHIP_SLUGS);

    const allImages: NclImage[] = [];
    const usedUrls = new Set<string>();

    for (const slug of slugsToProcess) {
      const shipName = SHIP_SLUGS[slug];
      console.log(`[ncl-sync] ▶ ${shipName} 수집 시작`);

      // 1) 아코디언 펼치기
      try {
        await page.click(`li.medialib_list.${slug} div.medialib_item`);
        await new Promise(r => setTimeout(r, 1500));
      } catch {
        console.warn(`[ncl-sync]   아코디언 클릭 실패: ${slug}`);
        continue;
      }

      // 2) 서브카테고리 목록 수집
      const subcats = await page.evaluate((s) => {
        const ul = document.querySelector(`li.medialib_list.${s} ul`);
        if (!ul) return [];
        return Array.from(ul.querySelectorAll<HTMLElement>("li[id]")).map(li => ({
          id:   li.id,
          text: li.textContent?.trim() ?? "",
        })).filter(sub => sub.id && !sub.text.toLowerCase().includes("b-roll")); // b-roll 제외
      }, slug);

      console.log(`[ncl-sync]   서브카테고리: ${subcats.map(s => s.text).join(", ")}`);

      // 3) 서브카테고리별 이미지 수집
      let shipTotal = 0;
      for (const subcat of subcats) {
        try {
          const imgs = await scrapeSubcat(page, subcat.id, shipName, subcat.text);
          for (const img of imgs) {
            if (usedUrls.has(img.url)) continue;
            usedUrls.add(img.url);
            allImages.push(img);
            shipTotal++;
          }
          console.log(`[ncl-sync]     ${subcat.text}: ${imgs.length}장`);
        } catch (e) {
          console.warn(`[ncl-sync]     ${subcat.text} 실패:`, e);
        }
      }
      console.log(`[ncl-sync]   ${shipName} 총 ${shipTotal}장`);
    }

    const cache: NclCache = {
      lastSynced: new Date().toISOString(),
      total:      allImages.length,
      images:     allImages,
    };

    if (!existsSync(path.dirname(CACHE_PATH))) {
      mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    }
    writeFileSync(CACHE_PATH, JSON.stringify(cache), "utf-8");

    const byShip: Record<string, number> = {};
    for (const im of allImages) byShip[im.ship] = (byShip[im.ship] ?? 0) + 1;
    console.log("[ncl-sync] 완료:", JSON.stringify(byShip));

    return Response.json({ ok: true, total: allImages.length, lastSynced: cache.lastSynced, byShip });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ncl-sync] 치명적 오류:", msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}

// ── GET: 캐시 상태 확인 ──────────────────────────────────────────
export async function GET() {
  const cache = readCache();
  if (!cache) return Response.json({ ok: true, synced: false });
  const byShip: Record<string, number> = {};
  for (const im of cache.images) byShip[im.ship] = (byShip[im.ship] ?? 0) + 1;
  return Response.json({
    ok:         true,
    synced:     true,
    total:      cache.total,
    lastSynced: cache.lastSynced,
    ships:      Object.keys(byShip).sort(),
    byShip,
  });
}
