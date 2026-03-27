// GET /api/auto-images?shippingLine=...&shipName=...&ports=주노,스캐그웨이&cabins=인사이드,발코니&facilities=수영장,스파
// Unsplash API로 섹션별 이미지 자동 검색 (병렬)
// 사전 조건: .env.local 에 UNSPLASH_ACCESS_KEY=<your key>

import { ImageStore } from "@/types/images";

export const dynamic = "force-dynamic";

async function searchOne(query: string, accessKey: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&client_id=${accessKey}`,
      { headers: { "Accept-Version": "v1" } }
    );
    if (!res.ok) return undefined;
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.results?.[0] as any)?.urls?.regular ?? undefined;
  } catch {
    return undefined;
  }
}

export async function GET(request: Request) {
  const url          = new URL(request.url);
  const shippingLine = url.searchParams.get("shippingLine") ?? "";
  const shipName     = url.searchParams.get("shipName")     ?? "";
  const ports        = (url.searchParams.get("ports") ?? "").split(",").filter(Boolean);
  const cabins       = (url.searchParams.get("cabins") ?? "").split(",").filter(Boolean);
  const facilities   = (url.searchParams.get("facilities") ?? "").split(",").filter(Boolean);
  const accessKey    = process.env.UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    return Response.json({
      ok: false,
      error: "UNSPLASH_ACCESS_KEY 미설정 — .env.local 에 추가 후 서버 재시작 (unsplash.com/developers 에서 무료 발급)",
    });
  }

  // ── 섹션별 검색 쿼리 정의 ─────────────────────────────────
  const s01Query   = `${shipName} cruise ship ocean`;
  const s03Queries = [
    `${shipName} cruise ship deck scenery`,
    `${shippingLine} cruise entertainment show`,
    `${shippingLine} cruise all inclusive drinks`,
    `${shippingLine} family cruise kids children`,
  ];
  const s04Query  = `${shipName} ${shippingLine} cruise ship exterior side`;
  const s08Query  = `${shippingLine} cruise ship sunset ocean romantic`;

  const cabinQueries = cabins.length > 0
    ? cabins.map(c => {
        if (c.includes("인사이드") || c.toLowerCase().includes("inside")) return "cruise ship inside cabin interior cozy";
        if (c.includes("스튜디오") || c.toLowerCase().includes("studio")) return "cruise ship studio cabin single";
        if (c.includes("오션뷰") || c.toLowerCase().includes("ocean")) return "cruise ship ocean view cabin window sea";
        if (c.includes("발코니") || c.toLowerCase().includes("balcony")) return "cruise ship balcony cabin private terrace";
        if (c.includes("스위트") || c.toLowerCase().includes("suite")) return "cruise ship suite luxury bedroom";
        return `cruise ship ${c} cabin interior`;
      })
    : [
        "cruise ship inside cabin interior",
        "cruise ship ocean view cabin window",
        "cruise ship balcony private terrace",
        "cruise ship suite luxury",
      ];

  const facilityQueries = facilities.length > 0
    ? facilities.map(f => `${shipName} cruise ${f}`)
    : [
        `${shipName} cruise pool deck`,
        `${shippingLine} cruise spa wellness`,
        `${shipName} cruise theater entertainment`,
      ];

  const portQueries = ports.map(p => `${p} travel tourism landmark`);

  // ── 전체 병렬 검색 ─────────────────────────────────────────
  const allQueries = [
    s01Query,
    ...s03Queries,
    s04Query,
    s08Query,
    ...cabinQueries,
    ...facilityQueries,
    ...portQueries,
  ];

  const results = await Promise.all(allQueries.map(q => searchOne(q, accessKey)));

  let idx = 0;
  const get = () => results[idx++];

  const s01Hero        = get();
  const s03Highlights  = s03Queries.map(() => get()).filter(Boolean) as string[];
  const s04Ship        = get();
  const s08Closing     = get();
  const s05Cabins      = cabinQueries.map(() => ({ photo: get() }));
  const s06Main        = facilityQueries.map(() => get()).filter(Boolean) as string[];
  const s07Ports       = portQueries.map(() => get()).filter(Boolean) as string[];

  const images: ImageStore = {
    s01Hero,
    s03Highlights,
    s04Ship,
    s08Closing,
    s05Cabins,
    s06Main,
    s07Ports,
  };

  return Response.json({ ok: true, images });
}
