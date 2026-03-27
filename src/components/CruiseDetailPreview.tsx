"use client";

import { FIXED_BENEFITS } from "@/constants/benefits";
import type { BenefitKey } from "@/types/cruise";
import type { ImageStore } from "@/types/images";

type Tag = "free" | "partially_paid" | "paid";
type BenefitSel = { key: BenefitKey; enabled: boolean };
type PriceRow = { id: string; cabin: string; guests: number; total: number; note: string };

export type SpecFields = {
  builtYear: string; tonnage: string; length: string;
  width: string; passengers: string; crew: string;
};

export type ConsultingInfo = {
  enabled: boolean;
  phone: string;
  weekdayHours: string;
  chatHours: string;
};

export type PreviewData = {
  S01: { sub: string; main: string };
  S02: { note: string };
  S03: { sectionTag: string; sectionTitle: string; subCopy: string; highlights: string[] };
  S04: { shippingLineDesc: string; shipDesc: string; specs: SpecFields };
  S05: { intro: string; cabinTypes: { name: string; desc: string; subDesc?: string }[] };
  S06: {
    intro: string;
    mainFacilities: { name: string; desc: string; tag: Tag }[];
    kidsSubDesc: string;
    kidsFacilities: { name: string; desc: string; tag: Tag }[];
    diningSubDesc: string;
    dining: { name: string; desc: string; tag: Tag }[];
    notIncluded: { name: string; desc: string }[];
  };
  S07: { intro: string; ports: { name: string; country: string; desc: string }[] };
  S08: { closingCopy: string };
};

const TAG_LABEL: Record<Tag, string> = { free: "무료", partially_paid: "일부유료", paid: "유료" };
const TAG_BG: Record<Tag, string> = {
  free: "bg-emerald-100 text-emerald-700",
  partially_paid: "bg-amber-100 text-amber-700",
  paid: "bg-red-100 text-red-700",
};

// 이미지 슬롯: src 없으면 렌더링하지 않음 (빈 placeholder 표시 안 함)
function ImgSlot({ ratio = "56.25%", label = "이미지", src, className = "" }: {
  ratio?: string; label?: string; src?: string; className?: string;
}) {
  if (!src) return null;
  return (
    <div className={`relative w-full overflow-hidden ${className}`}
      style={{ paddingBottom: ratio }}>
      <img src={src} alt={label} className="absolute inset-0 w-full h-full object-cover" />
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────
const DEFAULT_CONSULTING: ConsultingInfo = {
  enabled:      true,
  phone:        "02-733-9034",
  weekdayHours: "평일 10시 ~ 17시",
  chatHours:    "오전 10:00 ~ 11:00 / 오후 3:00 ~ 4:00",
};

const SPEC_LABELS: [keyof SpecFields, string][] = [
  ["builtYear",  "건조년도"],
  ["tonnage",    "총 톤수"],
  ["length",     "전장"],
  ["width",      "전폭"],
  ["passengers", "승객 정원"],
  ["crew",       "승무원"],
];

export default function CruiseDetailPreview({
  data, benefits, priceRows, images = {},
  shippingLine, shipName, region,
  consulting = DEFAULT_CONSULTING,
}: {
  data: PreviewData;
  benefits: BenefitSel[];
  priceRows: PriceRow[];
  images?: ImageStore;
  shippingLine: string;
  shipName: string;
  region: string;
  consulting?: ConsultingInfo;
}) {
  const enabledBenefits = benefits.filter(b => b.enabled);
  const validPriceRows = priceRows.filter(r => r.cabin || r.total > 0);

  return (
    <div className="w-[390px] bg-white overflow-hidden"
      style={{ fontFamily: "var(--font-noto-sans-kr), 'Noto Sans KR', sans-serif", wordBreak: "keep-all", overflowWrap: "break-word" }}>

      {/* S01 인트로 */}
      <div className="relative flex flex-col items-center justify-between px-8 py-10 min-h-[420px]"
        style={images.s01Hero
          ? { backgroundImage: `url(${images.s01Hero})`, backgroundSize: "cover", backgroundPosition: "center" }
          : { backgroundColor: "#0f172a" }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60 pointer-events-none" />
        <div className="relative z-10 bg-white/90 rounded-lg px-4 py-2 text-xs font-bold text-gray-700 tracking-wider uppercase">
          {shippingLine}
        </div>
        <div className="relative z-10 text-center text-white space-y-2 mb-8">
          <p className="text-sm tracking-wider italic">{data.S01.sub}</p>
          <h1 className="text-4xl font-black leading-tight drop-shadow-lg"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
            {data.S01.main}
          </h1>
        </div>
        {consulting.enabled && (
          <div className="relative z-10 w-full bg-white/95 rounded-2xl px-6 py-4 text-center space-y-2">
            <p className="text-sm font-extrabold text-gray-900">실시간 상담 제공</p>
            <div className="flex justify-center gap-8 text-xs text-gray-600">
              <div>
                <p className="font-bold text-gray-800">전화 상담</p>
                <p className="text-blue-600 font-bold text-base">{consulting.phone}</p>
                <p className="text-gray-400">({consulting.weekdayHours})</p>
              </div>
              <div className="w-px bg-gray-200" />
              <div>
                <p className="font-bold text-gray-800">빠른 채팅 상담 시간</p>
                {consulting.chatHours.split("/").map((t, i) => (
                  <p key={i}>{t.trim()}</p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* S02 단독 혜택 */}
      {enabledBenefits.length > 0 && (
        <div className="px-8 py-10 text-center" style={{ backgroundColor: "#1865F2" }}>
          <p className="text-xs font-bold tracking-[0.2em] text-white/60 mb-3">SPECIAL OFFER</p>
          <p className="text-2xl font-extrabold text-white mb-1">마이리얼트립 구매자 전용</p>
          <p className="text-2xl font-extrabold mb-6" style={{ color: "#F5C842" }}>객실당 단독 특전</p>
          <div className="grid grid-cols-3 gap-4 mb-5">
            {enabledBenefits.map(b => {
              const info = FIXED_BENEFITS[b.key];
              const icons: Record<BenefitKey, string> = { wifi: "📶", port_voucher: "🪙", onboard_credit: "🪙" };
              return (
                <div key={b.key} className="bg-white/15 rounded-2xl px-4 py-5 text-white flex flex-col items-center gap-2">
                  <span className="text-3xl">{icons[b.key]}</span>
                  {info.valueLabel && <span className="text-lg font-black" style={{ color: "#F5C842" }}>{info.valueLabel}</span>}
                  <p className="text-sm font-bold">{info.title}</p>
                  <p className="text-xs text-white/70 text-center">{info.description}</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-white/50">100$ 온보드 바우처는 예약자 30명 선착순으로 증정됩니다.</p>
        </div>
      )}

      {/* S03 상품 개요 */}
      <div className="px-8 py-10">
        <p className="text-xs font-bold tracking-[0.2em] text-gray-400 mb-3 text-center">Highlight</p>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-4 text-center">{data.S03.sectionTitle}</h2>
        <div className="flex justify-center gap-2 mb-5 flex-wrap">
          {region.split(/[·\s]+/).filter(Boolean).slice(0, 3).map((tag, i) => (
            <span key={i} className="text-sm font-bold text-white px-4 py-2 rounded-xl" style={{ backgroundColor: "#1865F2" }}>{tag}</span>
          ))}
        </div>
        <p className="text-sm text-center text-gray-500 mb-6">{data.S03.subCopy}</p>
        <div className="grid grid-cols-2 gap-3">
          {data.S03.highlights.slice(0, 4).map((h, i) => {
            const imgSrc = images.s03Highlights?.[i];
            return (
              <div key={i} className="relative rounded-2xl overflow-hidden">
                {imgSrc ? (
                  <>
                    <div style={{ paddingBottom: "100%" }} />
                    <img src={imgSrc} alt={h} className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-4">
                      <p className="text-white text-sm font-bold leading-snug">{h}</p>
                    </div>
                  </>
                ) : (
                  <div className="flex items-end p-4 min-h-[100px]" style={{ backgroundColor: "#1865F2" }}>
                    <p className="text-white text-sm font-bold leading-snug">{h}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* S04 선사 & 선박 */}
      <div className="px-8 py-10 bg-gray-50">
        <p className="text-xs font-bold tracking-[0.2em] text-gray-400 mb-3 text-center">ABOUT {shippingLine.toUpperCase()}</p>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-5 text-center">{shippingLine}</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-3 text-center">{data.S04.shippingLineDesc}</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-6 text-center">{data.S04.shipDesc}</p>
        <ImgSlot ratio="52%" label={`${shipName} 선박 사진`} src={images.s04Ship} className="rounded-2xl mb-6" />
        <div className="border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 text-sm font-bold text-white" style={{ backgroundColor: "#1865F2" }}>{shipName} 선박 제원</div>
          {SPEC_LABELS.filter(([key]) => data.S04.specs?.[key]).map(([key, label], i) => (
            <div key={key} className={`flex px-5 py-3 text-sm ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
              <span className="text-gray-500 w-32 flex-shrink-0">{label}</span>
              <span className="text-gray-900 font-medium">{data.S04.specs[key]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* S05 캐빈 */}
      <div className="px-8 py-10">
        <p className="text-xs font-bold tracking-[0.2em] text-gray-400 mb-3 text-center">RECOMMENDED STATEROOM</p>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-6 text-center">추천 객실</h2>
        <div className="space-y-6">
          {data.S05.cabinTypes.map((c, i) => (
            <div key={i} className="border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-800 text-white text-sm font-bold">{c.name}</div>
              <div className="flex gap-4 p-4">
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-gray-600 leading-relaxed">{c.desc}</p>
                  {c.subDesc && (
                    <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed border border-gray-100">{c.subDesc}</p>
                  )}
                </div>
                {images.s05Cabins?.[i]?.photo && (
                  <div className="w-32 flex-shrink-0">
                    <ImgSlot ratio="80%" label="객실 사진" src={images.s05Cabins?.[i]?.photo} className="rounded-xl" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {validPriceRows.length > 0 && (
          <div className="mt-8">
            <p className="text-xs text-gray-400 mb-1 text-right">*정확한 가격은 문의를 참고해주세요.</p>
            <div className="border border-gray-200 rounded-2xl overflow-hidden">
              <div className="grid text-xs font-bold text-white px-4 py-2.5 gap-2"
                style={{ backgroundColor: "#1865F2", gridTemplateColumns: "1.5fr 0.7fr 1.5fr 1.5fr" }}>
                <span>캐빈 타입</span><span className="text-center">인원</span><span className="text-right">총 가격</span><span className="text-right">인당 가격</span>
              </div>
              {validPriceRows.map((row, i) => (
                <div key={i} className={`grid px-4 py-3 text-sm gap-2 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                  style={{ gridTemplateColumns: "1.5fr 0.7fr 1.5fr 1.5fr" }}>
                  <span className="font-medium text-gray-800">{row.cabin || "—"}</span>
                  <span className="text-center text-gray-500">{row.guests}인실</span>
                  <span className="text-right text-gray-600">{row.total > 0 ? `${row.total.toLocaleString()}원~` : "문의"}</span>
                  <span className="text-right font-bold" style={{ color: "#1865F2" }}>
                    {row.total > 0 ? `${Math.round(row.total / row.guests).toLocaleString()}원~` : "문의"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* S06 시설 */}
      <div style={{ backgroundColor: "#1865F2" }} className="px-6 pt-6 pb-4">
        <p className="text-xs font-bold tracking-[0.2em] text-white/60 mb-1 text-center">ONBOARD EXPERIENCE</p>
        <h2 className="text-xl font-extrabold text-white text-center mb-2">{shipName} 주요 시설</h2>
        <p className="text-sm text-white/70 text-center leading-relaxed">{data.S06.intro}</p>
      </div>
      <div className="bg-white">
        <ImgSlot ratio="60%" label="선박 전경 / 시설 대표 이미지" src={images.s06Overview} />
        {/* ① 주요 부대시설 — 상단 3장 하이라이트 + 텍스트 리스트 */}
        {data.S06.mainFacilities?.length > 0 && (
          <div className="px-5 pt-6 pb-2">
            <p className="text-xs font-extrabold text-white px-3 py-1.5 rounded-full inline-block mb-4" style={{ backgroundColor: "#1865F2" }}>
              캐빈 예약 시 누릴 수 있는 크루즈 내 부대시설 ✨
            </p>
            {/* 3장 하이라이트 이미지 */}
            {(images.s06Main?.[0] || images.s06Main?.[1] || images.s06Main?.[2]) && (
              <div className="grid grid-cols-3 gap-1.5 mb-5">
                {[0, 1, 2].map(idx => (
                  <ImgSlot key={idx} ratio="100%" src={images.s06Main?.[idx]}
                    label={`시설 사진 ${idx + 1}`} className="rounded-xl" />
                ))}
              </div>
            )}
            {/* 시설 텍스트 리스트 */}
            <div className="space-y-3">
              {data.S06.mainFacilities.map((f, i) => (
                <div key={i} className="flex items-start justify-between gap-2 py-2.5 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-bold text-gray-900 mb-0.5">{f.name}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 mt-0.5 ${TAG_BG[f.tag]}`}>{TAG_LABEL[f.tag]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* ② 어린이&패밀리 */}
        {data.S06.kidsFacilities?.length > 0 && (
          <div className="px-5 pt-5 pb-2">
            <p className="text-xs font-extrabold text-white px-3 py-1.5 rounded-full inline-block mb-2" style={{ backgroundColor: "#F5A623" }}>
              어린이&패밀리 시설 👨‍👩‍👧‍👦
            </p>
            {data.S06.kidsSubDesc && <p className="text-xs text-gray-500 leading-relaxed mb-3">{data.S06.kidsSubDesc}</p>}
            {(images.s06Kids?.[0] || images.s06Kids?.[1] || images.s06Kids?.[2]) && (
              <div className="grid grid-cols-3 gap-1.5 mb-4">
                {[0, 1, 2].map(idx => (
                  <ImgSlot key={idx} ratio="100%" src={images.s06Kids?.[idx]}
                    label={`키즈 시설 ${idx + 1}`} className="rounded-xl" />
                ))}
              </div>
            )}
            <div className="space-y-3">
              {data.S06.kidsFacilities.map((f, i) => (
                <div key={i} className="flex items-start justify-between gap-2 py-2.5 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-bold text-gray-900 mb-0.5">{f.name}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 mt-0.5 ${TAG_BG[f.tag]}`}>{TAG_LABEL[f.tag]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* ③ 다이닝 */}
        {data.S06.dining?.length > 0 && (
          <div className="px-5 pt-5 pb-2">
            <p className="text-xs font-extrabold text-white px-3 py-1.5 rounded-full inline-block mb-2" style={{ backgroundColor: "#333" }}>
              다이닝 (레스토랑&바) 🍽️
            </p>
            {data.S06.diningSubDesc && <p className="text-xs text-gray-500 leading-relaxed mb-3">{data.S06.diningSubDesc}</p>}
            {(images.s06Dining?.[0] || images.s06Dining?.[1] || images.s06Dining?.[2]) && (
              <div className="grid grid-cols-3 gap-1.5 mb-4">
                {[0, 1, 2].map(idx => (
                  <ImgSlot key={idx} ratio="100%" src={images.s06Dining?.[idx]}
                    label={`다이닝 ${idx + 1}`} className="rounded-xl" />
                ))}
              </div>
            )}
            <div className="space-y-3">
              {data.S06.dining.map((f, i) => (
                <div key={i} className="flex items-start justify-between gap-2 py-2.5 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-bold text-gray-900 mb-0.5">{f.name}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 mt-0.5 ${TAG_BG[f.tag]}`}>{TAG_LABEL[f.tag]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* ④ 미포함 */}
        {data.S06.notIncluded?.length > 0 && (
          <div className="px-5 pt-5 pb-6">
            <p className="text-xs font-bold text-gray-500 mb-3 border-b border-gray-100 pb-2">포함되지 않는 시설</p>
            <div className="grid grid-cols-2 gap-2">
              {data.S06.notIncluded.map((f, i) => (
                <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                  <p className="text-xs font-bold text-gray-800 mb-0.5">{f.name}</p>
                  <p className="text-xs text-gray-400 leading-snug">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* S07-1 코스 */}
      <div className="px-8 py-10 text-center" style={{ backgroundColor: "#1865F2" }}>
        <p className="text-xs font-bold tracking-[0.2em] text-white/60 mb-3">TRIP HIGHLIGHTS</p>
        <h2 className="text-2xl font-extrabold text-white mb-1">{region}</h2>
        <p className="text-lg font-extrabold mb-6" style={{ color: "#F5C842" }}>기항지 및 투어 소개</p>
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-white">
          {data.S07.ports.map((p, i) => (
            <span key={i} className="flex items-center gap-2">
              <span className="bg-white/20 rounded-full px-3 py-1 font-medium">{p.name}</span>
              {i < data.S07.ports.length - 1 && <span className="text-white/40">→</span>}
            </span>
          ))}
        </div>
        <p className="text-xs text-white/50 mt-4">*기항지 투어 목록 및 가격은 문의를 통해 확인 가능하며,<br/>여행 확정 후 기항지투어 예약에 대한 대행도 가능합니다.</p>
      </div>

      {/* S07-2 기항지 상세 */}
      <div className="px-8 py-8 space-y-8">
        {data.S07.ports.map((p, i) => (
          <div key={i}>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-8 rounded-full text-white text-sm font-black flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "#1865F2" }}>{i + 1}</span>
              <div>
                <p className="text-base font-extrabold text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-400">{p.country}</p>
              </div>
            </div>
            {images.s07Ports?.[i] && (
              <ImgSlot ratio="70%" label={`${p.name} 사진`} src={images.s07Ports?.[i]} className="rounded-2xl mb-3" />
            )}
            <p className="text-sm text-gray-600 leading-relaxed">{p.desc}</p>
          </div>
        ))}
      </div>

      {/* S08 유의사항 */}
      <div className="px-8 py-8 bg-gray-50 space-y-5">
        {[
          { title: "[예약시 유의사항]", items: ["크루즈 상품은 성인 2인 기준 1일 기준 1인 금액입니다.", "요금 및 예약 가능 여부는 예약 시점에 따라 달라질 수 있습니다.", "크루즈 이용 수 3/4인실 이용률 할인은 직접 문의 후 별도 판매 부탁드립니다."] },
          { title: "[선사 규정]", items: ["예약 최소 3영업일전까지 전자티켓 제공 가능", "체크인은 출발일 최소 90일 전에 NCL 공식 홈페이지를 통해 완료해야 합니다."] },
        ].map((block, bi) => (
          <div key={bi}>
            <p className="text-sm font-bold text-gray-800 mb-2">{block.title}</p>
            <ul className="space-y-1">
              {block.items.map((item, ii) => (
                <li key={ii} className="text-xs text-gray-500 flex gap-1.5">
                  <span className="text-gray-400 flex-shrink-0">-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* S08 클로징 */}
      <div className="relative flex flex-col items-center justify-end px-8 py-10 min-h-[280px]"
        style={images.s08Closing
          ? { backgroundImage: `url(${images.s08Closing})`, backgroundSize: "cover", backgroundPosition: "center" }
          : { backgroundColor: "#0f172a" }}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />
        <p className="relative z-10 text-2xl font-black text-white text-center mb-2 drop-shadow-lg"
          style={{ textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
          {data.S08.closingCopy}
        </p>
        <p className="relative z-10 text-sm text-white/60 mt-2">{shippingLine} · {shipName}</p>
      </div>

    </div>
  );
}
