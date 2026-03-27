// GET /api/search-image?query=Juneau+Alaska
// Unsplash API로 저작권 프리 이미지 검색
// 사전 조건: .env.local 에 UNSPLASH_ACCESS_KEY=<your key> 추가

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url       = new URL(request.url);
  const query     = url.searchParams.get("query") ?? "";
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    return Response.json({
      ok:    false,
      error: "UNSPLASH_ACCESS_KEY가 .env.local에 없습니다. unsplash.com/developers 에서 무료 발급 후 추가해 주세요.",
    });
  }

  if (!query.trim()) {
    return Response.json({ ok: false, error: "query 누락" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape&client_id=${accessKey}`,
      { headers: { "Accept-Version": "v1" } }
    );

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ ok: false, error: `Unsplash 오류: ${text}` }, { status: 500 });
    }

    const json   = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const photos = (json.results ?? []).map((p: any) => ({
      url:            p.urls.regular,         // 1080px — 실제 저장용
      thumb:          p.urls.small,           // 400px  — 미리보기 썸네일
      credit:         p.user.name,
      creditLink:     p.user.links.html,
      photoLink:      p.links.html,
      altDescription: (p.alt_description ?? p.description ?? "").toLowerCase(),
    }));

    return Response.json({ ok: true, photos });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
