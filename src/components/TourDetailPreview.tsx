"use client";

import type { TourData, TourSectionId } from "@/types/tour";

// ── SectionHeader ────────────────────────────────────────────
function SectionHeader({ tag, title }: { tag: string; title: string }) {
  return (
    <div className="mb-5">
      <span
        className="inline-block text-xs font-bold tracking-widest px-3 py-1 rounded-full mb-2"
        style={{ backgroundColor: "#EEF4FF", color: "#1865F2" }}
      >
        {tag}
      </span>
      <h2 className="text-xl font-extrabold text-gray-900 leading-snug">{title}</h2>
    </div>
  );
}

// ── S01 Hero ────────────────────────────────────────────────
function S01Hero({
  s01,
  heroImage,
  duration,
}: {
  s01: TourData["S01"];
  heroImage?: string;
  duration: string;
}) {
  return (
    <div
      className="relative flex flex-col justify-between px-6 py-10 min-h-[380px]"
      style={
        heroImage
          ? {
              backgroundImage: `url(${heroImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : { backgroundColor: "#0f172a" }
      }
    >
      {/* 오버레이 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 40%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* 중앙 타이틀 */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center gap-3 py-6">
        <h1
          className="text-3xl font-bold text-white leading-tight"
          style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}
        >
          {s01.heroTitle}
        </h1>
        <p className="text-lg" style={{ color: "rgba(255,255,255,0.8)" }}>
          {s01.heroSubtitle}
        </p>
      </div>

      {/* 하단 배지 */}
      <div className="relative z-10 flex flex-wrap justify-center gap-2">
        <span
          className="text-xs font-bold px-4 py-2 rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.3)" }}
        >
          {duration || s01.duration}
        </span>
        {s01.departureInfo && (
          <span
            className="text-xs font-bold px-4 py-2 rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.3)" }}
          >
            {s01.departureInfo}
          </span>
        )}
      </div>
    </div>
  );
}

// ── S02 Summary ─────────────────────────────────────────────
function S02Summary({ s02 }: { s02: TourData["S02"] }) {
  return (
    <div className="px-6 py-8">
      <SectionHeader tag="SUMMARY" title="상품 소개" />

      {/* 인트로 */}
      {s02.intro && (
        <p className="text-sm leading-relaxed mb-6" style={{ color: "#374151" }}>
          {s02.intro}
        </p>
      )}

      {/* 하이라이트 그리드 */}
      {s02.highlights.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {s02.highlights.map((h, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-xl px-4 py-3"
              style={{ backgroundColor: "#EEF4FF" }}
            >
              <span className="text-lg flex-shrink-0 leading-none mt-0.5">{h.icon}</span>
              <p className="text-xs font-medium leading-relaxed" style={{ color: "#1e3a8a" }}>
                {h.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 꿀팁 */}
      {s02.showTips && s02.tips.length > 0 && (
        <div className="rounded-xl px-5 py-4" style={{ backgroundColor: "#FFF9E6" }}>
          <p className="text-sm font-bold mb-3" style={{ color: "#92400e" }}>
            💡 꿀팁
          </p>
          <ul className="space-y-2">
            {s02.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-xs flex-shrink-0 mt-0.5" style={{ color: "#d97706" }}>
                  •
                </span>
                <p className="text-xs leading-relaxed" style={{ color: "#78350f" }}>
                  {tip}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── S03 일정 및 코스 ─────────────────────────────────────────
function S03Itinerary({ s03 }: { s03: TourData["S03"] }) {
  return (
    <div className="px-6 py-8" style={{ backgroundColor: "#f8fafc" }}>
      <SectionHeader tag="ITINERARY" title="일정 및 코스" />

      {s03.intro && (
        <p className="text-sm leading-relaxed mb-6" style={{ color: "#374151" }}>
          {s03.intro}
        </p>
      )}

      {/* 타임라인 */}
      <div className="relative">
        {/* 세로 줄 */}
        <div
          className="absolute left-[28px] top-0 bottom-0 w-px"
          style={{ backgroundColor: "#dbeafe" }}
        />

        <div className="space-y-6">
          {s03.days.map((day, i) => (
            <div key={i} className="flex gap-4 relative">
              {/* Day 배지 */}
              <div
                className="flex-shrink-0 w-14 text-center text-xs font-black text-white py-1 rounded-full z-10"
                style={{ backgroundColor: "#1865F2" }}
              >
                Day {day.dayNum}
              </div>

              {/* 내용 */}
              <div className="flex-1 bg-white rounded-xl px-4 py-3 border" style={{ borderColor: "#e2e8f0" }}>
                {day.title && (
                  <p className="text-sm font-bold mb-1" style={{ color: "#1e293b" }}>
                    {day.title}
                  </p>
                )}
                {day.desc && (
                  <p className="text-xs leading-relaxed mb-2" style={{ color: "#475569" }}>
                    {day.desc}
                  </p>
                )}
                {(day.meals || day.accommodation) && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {day.meals && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: "#fef3c7", color: "#92400e" }}
                      >
                        🍽 {day.meals}
                      </span>
                    )}
                    {day.accommodation && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: "#f0fdf4", color: "#166534" }}
                      >
                        🏨 {day.accommodation}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── S04 안내사항 ─────────────────────────────────────────────
const INCLUDED_PREFIX = ["포함", "포함사항", "포함 사항", "included", "INCLUDED"];
const EXCLUDED_PREFIX = ["불포함", "불포함사항", "불포함 사항", "excluded", "EXCLUDED", "미포함"];

function isIncludedCategory(title: string) {
  return INCLUDED_PREFIX.some((p) => title.includes(p));
}
function isExcludedCategory(title: string) {
  return EXCLUDED_PREFIX.some((p) => title.includes(p));
}

function S04Notice({ s04 }: { s04: TourData["S04"] }) {
  return (
    <div className="px-6 py-8">
      <SectionHeader tag="NOTICE" title="안내사항" />

      <div className="space-y-6">
        {s04.categories.map((cat, i) => {
          const isIncluded = isIncludedCategory(cat.title);
          const isExcluded = isExcludedCategory(cat.title);
          const showIcons = isIncluded || isExcluded;

          return (
            <div key={i}>
              <p
                className="text-sm font-bold mb-2 pb-2 border-b"
                style={{ color: "#1e293b", borderColor: "#e2e8f0" }}
              >
                {cat.title}
              </p>
              <ul className="space-y-1.5">
                {cat.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2">
                    {showIcons ? (
                      <span className="flex-shrink-0 mt-0.5 text-sm">
                        {isIncluded ? "✅" : "❌"}
                      </span>
                    ) : (
                      <span
                        className="flex-shrink-0 mt-1.5 w-1 h-1 rounded-full"
                        style={{ backgroundColor: "#94a3b8" }}
                      />
                    )}
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: "#475569" }}
                    >
                      {item}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── S05 FAQ ──────────────────────────────────────────────────
function S05FAQ({ s05 }: { s05: TourData["S05"] }) {
  return (
    <div className="px-6 py-8" style={{ backgroundColor: "#f8fafc" }}>
      <SectionHeader tag="FAQ" title="자주 묻는 질문" />

      <div className="space-y-4">
        {s05.faqs.map((faq, i) => (
          <div key={i} className="rounded-xl overflow-hidden border" style={{ borderColor: "#dbeafe" }}>
            {/* Q */}
            <div
              className="px-4 py-3 flex items-start gap-2"
              style={{ backgroundColor: "#EEF4FF" }}
            >
              <span
                className="flex-shrink-0 text-xs font-black w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                style={{ backgroundColor: "#1865F2", color: "#ffffff" }}
              >
                Q
              </span>
              <p className="text-sm font-bold leading-snug" style={{ color: "#1e3a8a" }}>
                {faq.question}
              </p>
            </div>
            {/* A */}
            <div className="px-4 py-3 bg-white flex items-start gap-2">
              <span
                className="flex-shrink-0 text-xs font-black w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}
              >
                A
              </span>
              <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>
                {faq.answer}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export default function TourDetailPreview({
  data,
  images,
  productName,
  region,
  duration,
}: {
  data: TourData;
  images: { s01Hero?: string };
  productName: string;
  region: string;
  duration: string;
}) {
  // S01을 제외한 나머지 섹션 순서 (S01은 항상 맨 위)
  const restOrder = data.sectionOrder.filter((id) => id !== "S01");

  function renderSection(id: TourSectionId) {
    switch (id) {
      case "S02":
        return data.S02 ? <S02Summary key="S02" s02={data.S02} /> : null;
      case "S03":
        return data.S03 ? <S03Itinerary key="S03" s03={data.S03} /> : null;
      case "S04":
        return data.S04 ? <S04Notice key="S04" s04={data.S04} /> : null;
      case "S05":
        return data.S05 ? <S05FAQ key="S05" s05={data.S05} /> : null;
      default:
        return null;
    }
  }

  return (
    <div
      className="bg-white overflow-hidden"
      style={{
        width: "390px",
        fontFamily: "var(--font-noto-sans-kr), 'Noto Sans KR', sans-serif",
        wordBreak: "keep-all",
        overflowWrap: "break-word",
      }}
    >
      {/* S01: 항상 맨 위 */}
      {data.S01 && (
        <S01Hero
          s01={data.S01}
          heroImage={images.s01Hero}
          duration={duration}
        />
      )}

      {/* 나머지 섹션을 sectionOrder 순서대로 */}
      {restOrder.map((id) => renderSection(id))}
    </div>
  );
}
