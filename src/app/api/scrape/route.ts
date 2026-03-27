// POST /api/scrape
// URL을 받아 HTML을 스크래핑하고 텍스트를 반환
// cruisia.co.kr → Puppeteer, 그 외 → Cheerio

import { scrapeStaticUrl, extractText, parseShipSpecs, isCruisiaSite } from "@/lib/scraper";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type ScrapeRequest = {
  urls: {
    specUrl?: string;
    cabinUrl?: string;
    facilityUrl?: string;
    itineraryUrl?: string;
  };
};

type ScrapeResult = {
  specText?: string;
  cabinText?: string;
  facilityText?: string;
  itineraryText?: string;
  shipSpecs?: Record<string, string>;
  errors?: Record<string, string>;
};

async function scrapeOne(url: string): Promise<string> {
  if (!url) return "";
  if (isCruisiaSite(url)) {
    // cruisia.co.kr: Puppeteer 사용 (Vercel에서는 @sparticuz/chromium 필요)
    // 개발 환경에서는 로컬 Chromium 사용
    try {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
      const text = await page.evaluate(
        () => document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 8000)
      );
      await browser.close();
      return text;
    } catch (err) {
      throw new Error(`Puppeteer 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  // 일반 사이트: Cheerio
  const html = await scrapeStaticUrl(url);
  return extractText(html);
}

export async function POST(request: Request) {
  const body: ScrapeRequest = await request.json();
  const { urls } = body;
  const result: ScrapeResult = { errors: {} };

  const tasks: [keyof typeof urls, string][] = [
    ["specUrl",      urls.specUrl ?? ""],
    ["cabinUrl",     urls.cabinUrl ?? ""],
    ["facilityUrl",  urls.facilityUrl ?? ""],
    ["itineraryUrl", urls.itineraryUrl ?? ""],
  ];

  await Promise.allSettled(
    tasks.map(async ([key, url]) => {
      if (!url) return;
      try {
        const text = await scrapeOne(url);
        if (key === "specUrl")     { result.specText = text; result.shipSpecs = parseShipSpecs(text); }
        if (key === "cabinUrl")     result.cabinText = text;
        if (key === "facilityUrl")  result.facilityText = text;
        if (key === "itineraryUrl") result.itineraryText = text;
      } catch (err) {
        result.errors![key] = err instanceof Error ? err.message : String(err);
      }
    })
  );

  return Response.json(result);
}
