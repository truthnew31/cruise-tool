// POST /api/export-jpg
// Body: FormData { html: string }
// Returns: JPEG image
// Puppeteer로 HTML을 렌더링해서 스크린샷 반환

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const html = formData.get("html") as string;
    if (!html) return Response.json({ error: "html 필드 누락" }, { status: 400 });

    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-web-security"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 1200, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });

    // 콘텐츠 전체 높이에 맞춰 스크린샷
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewport({ width: 800, height: bodyHeight, deviceScaleFactor: 2 });

    const screenshot = await page.screenshot({ type: "jpeg", quality: 92, fullPage: true });
    await browser.close();

    return new Response(Buffer.from(screenshot), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": 'attachment; filename="cruise-detail.jpg"',
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
