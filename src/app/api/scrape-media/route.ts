// POST /api/scrape-media
// body: { url: string }
// Puppeteer로 선사 뉴스룸/미디어 페이지에서 이미지 URL 추출

import puppeteer from "puppeteer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "JSON 파싱 실패" }, { status: 400 });
  }

  const { url } = body;
  if (!url?.trim()) {
    return Response.json({ ok: false, error: "url 필드가 필요합니다" }, { status: 400 });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // 페이지 로드 (최대 30초)
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // JS 렌더링 대기 (동적 콘텐츠)
    await new Promise(r => setTimeout(r, 2000));

    // 스크롤하여 lazy-load 이미지 로드
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 200));
      }
    });

    // 이미지 URL 수집
    const images: string[] = await page.evaluate(() => {
      const seen = new Set<string>();
      const result: string[] = [];

      // 1) <img> 태그 (크기가 충분한 것만)
      document.querySelectorAll("img").forEach(img => {
        const src = img.src || img.dataset.src || img.dataset.lazySrc || "";
        const w   = img.naturalWidth  || img.width  || 0;
        const h   = img.naturalHeight || img.height || 0;
        if (src && src.startsWith("http") && w >= 300 && h >= 200 && !seen.has(src)) {
          seen.add(src);
          result.push(src);
        }
      });

      // 2) srcset에서 가장 큰 이미지
      document.querySelectorAll("img[srcset]").forEach(img => {
        const srcset = img.getAttribute("srcset") ?? "";
        const parts  = srcset.split(",").map(s => s.trim().split(" ")[0]);
        const last   = parts[parts.length - 1];
        if (last && last.startsWith("http") && !seen.has(last)) {
          seen.add(last);
          result.push(last);
        }
      });

      // 3) CSS background-image
      document.querySelectorAll("[style*='background-image']").forEach(el => {
        const style = (el as HTMLElement).style.backgroundImage;
        const match = style.match(/url\(["']?(https?[^"')]+)["']?\)/);
        if (match?.[1] && !seen.has(match[1])) {
          seen.add(match[1]);
          result.push(match[1]);
        }
      });

      // 4) <source> 태그 (picture 요소)
      document.querySelectorAll("source[srcset]").forEach(src => {
        const srcset = src.getAttribute("srcset") ?? "";
        const parts  = srcset.split(",").map(s => s.trim().split(" ")[0]);
        const last   = parts[parts.length - 1];
        if (last && last.startsWith("http") && !seen.has(last)) {
          seen.add(last);
          result.push(last);
        }
      });

      return result
        // 아이콘·로고·트래킹 픽셀 제외
        .filter(src =>
          !src.includes("logo") &&
          !src.includes("icon") &&
          !src.includes("pixel") &&
          !src.includes("tracking") &&
          !src.includes("1x1") &&
          /\.(jpg|jpeg|png|webp)/i.test(src)
        )
        .slice(0, 60); // 최대 60장
    });

    return Response.json({ ok: true, images, count: images.length });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "스크래핑 실패" },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close();
  }
}
