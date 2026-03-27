// GET /api/ncl-images?ship=Norwegian+Encore&section=S06
// 캐시된 NCL 이미지를 선박명 + 섹션으로 필터링하여 반환

import { readCache } from "@/app/api/ncl-sync/route";

export const dynamic = "force-dynamic";

// 섹션 → 카테고리 매핑
const SECTION_CATEGORIES: Record<string, string[]> = {
  S01: ["Ship Exterior"],
  S03: ["Ship Exterior", "Pool & Deck", "Entertainment", "Atrium"],
  S04: ["Ship Exterior"],
  S05: ["Inside Cabin", "Ocean View", "Balcony Cabin", "Suite"],
  S06_main: ["Pool & Deck", "Spa", "Casino", "Entertainment", "Sports", "Atrium"],
  S06_kids: ["Kids & Family"],
  S06_dining: ["Dining", "Bar & Lounge"],
  S08: ["Ship Exterior"],
};

// 선박명 정규화 — 한글/영문 혼용 대응
function normalizeShipName(raw: string): string {
  const SHIP_ALIASES: Record<string, string> = {
    "encore":       "Norwegian Encore",
    "엔코어":        "Norwegian Encore",
    "bliss":        "Norwegian Bliss",
    "블리스":        "Norwegian Bliss",
    "breakaway":    "Norwegian Breakaway",
    "브레이크어웨이": "Norwegian Breakaway",
    "getaway":      "Norwegian Getaway",
    "게이트웨이":     "Norwegian Getaway",
    "joy":          "Norwegian Joy",
    "조이":          "Norwegian Joy",
    "escape":       "Norwegian Escape",
    "에스케이프":     "Norwegian Escape",
    "prima":        "Norwegian Prima",
    "프리마":        "Norwegian Prima",
    "viva":         "Norwegian Viva",
    "비바":          "Norwegian Viva",
    "epic":         "Norwegian Epic",
    "에픽":          "Norwegian Epic",
    "luna":         "Norwegian Luna",
    "루나":          "Norwegian Luna",
    "aqua":         "Norwegian Aqua",
    "아쿠아":        "Norwegian Aqua",
    "gem":          "Norwegian Gem",
    "젬":           "Norwegian Gem",
    "pearl":        "Norwegian Pearl",
    "펄":           "Norwegian Pearl",
    "jade":         "Norwegian Jade",
    "제이드":        "Norwegian Jade",
    "star":         "Norwegian Star",
    "스타":          "Norwegian Star",
    "dawn":         "Norwegian Dawn",
    "던":           "Norwegian Dawn",
    "sky":          "Norwegian Sky",
    "스카이":        "Norwegian Sky",
    "sun":          "Norwegian Sun",
    "선":           "Norwegian Sun",
    "spirit":       "Norwegian Spirit",
    "스피릿":        "Norwegian Spirit",
    "pride of america": "Pride of America",
    "프라이드 오브 아메리카": "Pride of America",
  };
  const lower = raw.toLowerCase().trim();
  // 직접 매칭
  if (SHIP_ALIASES[lower]) return SHIP_ALIASES[lower];
  // 부분 매칭
  for (const [alias, canonical] of Object.entries(SHIP_ALIASES)) {
    if (lower.includes(alias)) return canonical;
  }
  // 이미 영문이면 그대로 (첫 글자 대문자)
  return raw.trim().replace(/\b\w/g, c => c.toUpperCase());
}

export async function GET(request: Request) {
  const url     = new URL(request.url);
  const rawShip = url.searchParams.get("ship") ?? "";
  const section = url.searchParams.get("section") ?? "";  // S01, S04, S05, S06_main, ...

  const cache = readCache();
  if (!cache) {
    return Response.json({ ok: false, error: "NCL 이미지 캐시 없음. /api/ncl-sync 를 먼저 실행하세요." });
  }

  const shipName = normalizeShipName(rawShip);
  let images = cache.images;

  // 선박명 필터 — im.ship 이 비어있으면 반드시 제외
  if (shipName) {
    const target = shipName.toLowerCase();
    images = images.filter(im => {
      if (!im.ship) return false;                      // 선박명 없는 이미지 제외
      const src = im.ship.toLowerCase();
      // 정확히 동일하거나, ship 이름의 뒷부분(Encore 등)이 일치해야 함
      if (src === target) return true;
      // "norwegian encore" ↔ "encore" 처럼 선박 고유명(마지막 단어)으로 비교
      const srcLast    = src.split(" ").pop() ?? src;
      const targetLast = target.split(" ").pop() ?? target;
      return srcLast === targetLast;
    });
  }

  // 섹션 필터
  if (section && SECTION_CATEGORIES[section]) {
    const cats = SECTION_CATEGORIES[section];
    images = images.filter(im => cats.includes(im.category));
  }

  return Response.json({ ok: true, images, total: images.length, ship: shipName });
}
