// POST /api/export-jpg
// Body: FormData { html: string }
// Returns: JPEG image
// 로컬: puppeteer (로컬 Chrome)
// Vercel: puppeteer-core + @sparticuz/chromium (서버리스 Chrome)

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const html = formData.get("html") as string;
    if (!html) return Response.json({ error: "html 필드 누락" }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let browser: any;

    if (process.env.VERCEL) {
      // Vercel 서버리스: @sparticuz/chromium + puppeteer-core
      const chromium = await import("@sparticuz/chromium");
      const puppeteerCore = await import("puppeteer-core");
      browser = await puppeteerCore.default.launch({
        args: chromium.default.args,
        executablePath: await chromium.default.executablePath(),
        headless: true,
      });
    } else {
      // 로컬: 일반 puppeteer
      const puppeteer = await import("puppeteer");
      browser = await puppeteer.default.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-web-security"],
      });
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 1200, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });

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
