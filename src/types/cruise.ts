// ── 공통 타입 ──
export type Img = { url: string; alt: string; caption?: string };
export type PricingTag = "free" | "partially_paid" | "paid";
export type SectionBase = { sectionId: string; visible: boolean; order: number };

// ── S01 인트로 ──
export type S01_Intro = SectionBase & {
  sectionId: "S01";
  heroImage: Img;
  shippingLineLogo: Img;
  brandColor: string;           // 로고에서 자동 추출 (추후 기능)
  brandColorFallback: string;
  headCopy: { sub: string; main: string };
  consultBox: {
    title: string;
    phone: string;
    phoneHours: string;
    chatHours: string;
  };
};

// ── S02 단독혜택 — 고정 3종, 표시 여부만 선택 ──
export type BenefitKey = "wifi" | "port_voucher" | "onboard_credit";

export type S02_Benefits = SectionBase & {
  sectionId: "S02";
  platformName: "마이리얼트립"; // 고정값
  selections: { key: BenefitKey; enabled: boolean }[];
  limitNote?: string;
  bgColor: string; // 기본값: "#1A73E8"
};

// ── S03 상품 개요 ──
export type HighlightCard = {
  type: "image_text_pair" | "image_overlay";
  image: Img;
  badge?: string;
  title: string;
  description: string;
};

export type S03_Overview = SectionBase & {
  sectionId: "S03";
  sectionTag: string;
  sectionTitle: string;
  summaryBadges: { departurePort: string; portCount: string; duration: string };
  subCopy: string;
  highlights: HighlightCard[];
};

// ── S04 선박 스펙 ──
export type S04_ShipSpec = SectionBase & {
  sectionId: "S04";
  sectionTag: string;
  shippingLineName: string;
  shipDescription: string;
  shipImage: Img;
  specTableTitle: string;
  specs: {
    yearBuilt: number;
    yearRefurbished?: number;
    grossTonnage: number;
    lengthM: number;
    widthM: number;
    passengerCapacity: number;
    crewCount: number;
  };
};

// ── S05 캐빈 + 가격표 (프로토타입: 단순 리스트) ──
export type PriceEntry = {
  id: string;
  guestCount: 1 | 2 | 3 | 4;
  cabinTypeName: string;
  totalPrice: number;
  perPersonPrice: number; // totalPrice / guestCount 자동 계산
  note?: string;
};

export type CabinCard = {
  typeKey: string;
  typeName: string;
  occupancy: string;
  description: string;
  roomImage: Img;
  floorPlanImage?: Img;
  occupancyNote: string;
  featured: boolean;
};

export type S05_Cabin = SectionBase & {
  sectionId: "S05";
  sectionTag: string;
  sectionTitle: string;
  cabinCards: CabinCard[];
  priceTableTitle: string;
  priceNote: string;
  priceEntries: PriceEntry[];
};

// ── S06 시설 (URL 파싱 + 수동 오버라이드) ──
// 핵심 로직: parsedTag(자동) vs userOverride(수동) → resolvedTag(최종)
export type FacilityItem = {
  facilityKey: string;
  category: "facility" | "kids" | "dining";
  name: string;
  description: string;
  parsedTag: PricingTag;          // URL 파싱 원본 (변경 불가)
  userOverride: PricingTag | null; // 편집자 수동 변경값
  resolvedTag: PricingTag;        // 최종 = userOverride ?? parsedTag
  reviewFlag: boolean;            // true = 파싱 신뢰도 낮음 → 편집자 검토 필요
  image: Img;
  featured: boolean;
};

export type S06_Facilities = SectionBase & {
  sectionId: "S06";
  sourceUrl: string;
  lastParsedAt: string;
  sectionTitle: string;
  facilities: FacilityItem[];
  notIncludedTitle: string;
  notIncluded: { name: string; pricingTag: "partially_paid" | "paid" }[];
};

// ── S07 기항지 ──
export type Port = {
  day: number;
  portName: string;
  portNameEn: string;
  countryFlag: string;
  isDayAtSea: boolean;
  description: string;
  tours: { tourName: string }[];
  image?: Img;
};

export type S07_Itinerary = SectionBase & {
  sectionId: "S07";
  sectionTag: string;
  sectionTitle: string;
  routeMapImage: Img;
  courseFlow: string[];
  ports: Port[];
  tourPricePolicy: "inquiry" | "listed";
  tourNote: string;
};

// ── S08 유의사항 + 클로징 ──
export type S08_Notes = SectionBase & {
  sectionId: "S08";
  noteBlocks: { title: string; items: string[] }[];
  closingImage: Img;
  closingCopy: string;
};

// ── 출력 설정 ──
export type OutputConfig = {
  mode: "full" | "section" | "both";
  widthPx: number;      // 기본 750
  scaleFactor: number;  // 기본 2 (레티나)
  fontFamily: string;   // "Noto Sans KR"
  sectionFilePrefix: string;
  outputDir: string;
};

// ── 최상위 상품 타입 ──
export type CruiseProduct = {
  productId: string;
  productName: string;
  shippingLine: string;
  shipName: string;
  region: string;
  brandColor: string;
  updatedAt: string;
  outputConfig: OutputConfig;
  sections: {
    S01: S01_Intro;
    S02: S02_Benefits;
    S03: S03_Overview;
    S04: S04_ShipSpec;
    S05: S05_Cabin;
    S06: S06_Facilities;
    S07: S07_Itinerary;
    S08: S08_Notes;
  };
};

// ── S06 요금 태그 파싱 함수 ──
export function classifyPricingTag(text: string): { tag: PricingTag; reviewFlag: boolean } {
  const lower = text.toLowerCase();
  const freeKeywords = ["무료", "included", "complimentary", "free", "포함"];
  const paidKeywords = ["$", "fee", "charge", "유료", "추가 요금", "surcharge", "별도"];

  const isFree = freeKeywords.some((k) => lower.includes(k));
  const isPaid = paidKeywords.some((k) => lower.includes(k));

  if (isFree && !isPaid) return { tag: "free", reviewFlag: false };
  if (isPaid && !isFree) return { tag: "paid", reviewFlag: false };
  if (isPaid && isFree) return { tag: "partially_paid", reviewFlag: true };
  return { tag: "partially_paid", reviewFlag: true }; // 미탐지
}
