// GET /api/generate-tour?productName=...&region=...&duration=...&save=true
// Phase 1: Anthropic web_search로 실제 투어 정보 수집 (공식 여행사 사이트 우선)
// Phase 2: 수집된 정보로 TourData JSON 생성

import Anthropic from "@anthropic-ai/sdk";
import { getClaudeClient } from "@/lib/claude";

export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-5";

// ── Phase 1: 웹 서치로 팩트 수집 ────────────────────────────────
async function researchFacts(
  client: Anthropic,
  productName: string,
  region: string,
  duration: string
): Promise<string> {
  try {
    const query = `투어 상품 "${productName}" (${region}, ${duration}) 의 정확한 정보를 검색해줘.

🔍 검색 우선순위:
1순위: 공식 여행사 홈페이지 (모두투어, 하나투어, 롯데관광, 참좋은여행 등 공식 사이트) → [공식] 표시
2순위: 여행 전문 사이트, 여행 커뮤니티, 블로그 후기 → [검색] 표시
확인 불가 항목 → "미확인" 표시

수집 항목:
1. 상품 기본 정보 (출발일, 출발지, 여행 기간, 항공사, 숙박 정보)

2. 상세 여행 일정
   ⚠️ 중요: Day 1부터 마지막 날까지 전체 일정을 순서대로 전부 나열 (누락 없이)
   각 Day마다: 방문지, 주요 활동, 식사(조/중/석), 숙박 정보 포함

3. 투어 하이라이트 (5~6개)
   - 이 투어에서만 경험할 수 있는 특별한 포인트
   - 포함된 특별 서비스나 액티비티

4. 포함/불포함 사항
   - 포함: 항공료, 숙박, 식사, 입장료 등 포함 내역
   - 불포함: 개인 경비, 선택 관광, 팁 등 불포함 내역

5. 여행 준비물 및 주의 사항
   - 필수 준비물, 복장 안내
   - 건강·안전 주의사항, 현지 에티켓

6. 자주 묻는 질문 (FAQ)
   - 취소/환불 정책
   - 나이 제한, 건강 조건
   - 현지 화폐, 날씨 등 실용 정보

각 항목마다 [공식] / [검색] / 미확인 구분 필수.
출처 URL도 가능한 경우 기재해줘.`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (client as any).beta.messages.create({
      model: MODEL,
      max_tokens: 3000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      betas: ["web-search-2025-03-05"],
      messages: [{ role: "user", content: query }],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const texts = (res.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text);

    return texts.join("\n").trim();
  } catch (err) {
    console.warn("[generate-tour] Web search failed:", err);
    return "";
  }
}

// ── Phase 2: 검색 결과 기반 JSON 생성 ───────────────────────────
function buildPrompt(
  productName: string,
  region: string,
  duration: string,
  departure: string,
  researchContext: string
): string {
  const contextBlock = researchContext
    ? `아래는 웹 검색으로 확인된 실제 정보입니다. [공식]/[검색]/미확인 표시를 참고해 신뢰도를 판단하세요:\n\n${researchContext}\n\n---\n\n`
    : "";

  return `${contextBlock}투어 상품 상세페이지 JSON을 생성해줘.

상품명: ${productName}
지역/코스: ${region}
여행 기간: ${duration}
출발지: ${departure || "미지정"}

⚠️ 정확성 규칙 (반드시 준수):
- S03 일정: 검색에서 확인된 실제 일정을 Day 1부터 마지막 날까지 순서대로 전부 기재. 누락 없이.
- S04 포함/불포함: 해당 상품에 실제 해당하는 내용만. 불확실하면 일반적인 패키지 기준으로 작성.
- S05 FAQ: 실제 여행자들이 자주 묻는 질문 위주로 5~8개. 구체적이고 실용적인 답변.
- S01·S02 카피: 창의적으로 자유롭게 작성 가능.

아래 JSON 형식으로만 반환. 마크다운 코드블록 없이 순수 JSON만.

{
  "sectionOrder": ["S01","S02","S03","S04","S05"],
  "S01": {
    "heroTitle": "투어 메인 타이틀 (20자 이내, 감성적·행동 유도)",
    "heroSubtitle": "서브 타이틀 (30자 이내, FOMO·가격 후킹 위주)",
    "duration": "${duration}",
    "departureInfo": "출발지 및 출발 관련 핵심 정보 1문장"
  },
  "S02": {
    "intro": "이 투어의 특별함을 소개하는 2~3문장",
    "highlights": [
      {"icon":"✈️","text":"하이라이트 1 (15자 이내)"},
      {"icon":"🏨","text":"하이라이트 2 (15자 이내)"},
      {"icon":"🍽️","text":"하이라이트 3 (15자 이내)"},
      {"icon":"🎭","text":"하이라이트 4 (15자 이내)"},
      {"icon":"🌟","text":"하이라이트 5 (15자 이내)"}
    ],
    "showTips": true,
    "tips": [
      "꿀팁 1: 실용적인 여행 팁",
      "꿀팁 2: 현지에서 유용한 정보",
      "꿀팁 3: 준비물 또는 복장 팁"
    ]
  },
  "S03": {
    "intro": "전체 여행 일정 소개 1~2문장",
    "days": [
      {
        "dayNum": "Day 1",
        "title": "일정 제목 (도시명 포함, 20자 이내)",
        "desc": "당일 주요 활동 및 방문지 상세 설명 2~3문장",
        "meals": "조식/중식/석식 (포함된 식사만 표기, 예: 중식·석식 포함)",
        "accommodation": "숙박 정보 (호텔명 또는 등급, 도시명)"
      }
    ]
  },
  "S04": {
    "categories": [
      {
        "title": "포함 사항",
        "items": ["항공료 (왕복)", "숙박비 (호텔 기준)", "일정상 식사", "입장료 (일정표 기준)", "현지 교통비"]
      },
      {
        "title": "불포함 사항",
        "items": ["개인 경비", "선택 관광 비용", "여행자 보험", "팁 (가이드·기사·포터)"]
      },
      {
        "title": "여행 준비물",
        "items": ["여권 (유효기간 6개월 이상)", "비자 (필요 시)", "편안한 걷기 편한 신발", "현지 화폐 또는 신용카드"]
      },
      {
        "title": "주의 사항",
        "items": ["출발 3시간 전 공항 도착 권장", "귀중품 분실 주의", "현지 문화·에티켓 준수"]
      }
    ]
  },
  "S05": {
    "faqs": [
      {"question": "자주 묻는 질문 1?", "answer": "구체적이고 실용적인 답변 1~2문장."},
      {"question": "자주 묻는 질문 2?", "answer": "구체적이고 실용적인 답변 1~2문장."},
      {"question": "자주 묻는 질문 3?", "answer": "구체적이고 실용적인 답변 1~2문장."},
      {"question": "자주 묻는 질문 4?", "answer": "구체적이고 실용적인 답변 1~2문장."},
      {"question": "자주 묻는 질문 5?", "answer": "구체적이고 실용적인 답변 1~2문장."}
    ]
  },
  "needsReview": ["공식 소스 미확인 항목 목록. 모두 확인됐으면 []"],
  "sourceInfo": {
    "summary": "어떤 출처를 사용했는지 1~3문장 요약",
    "officialUrl": "공식 사이트에서 참조한 URL (없으면 null)",
    "verifiedFields": ["공식 소스로 확인된 주요 항목 목록"],
    "unverifiedFields": ["검색만으로 확인되거나 불확실한 항목"]
  }
}`;
}

// ── 라우트 핸들러 ────────────────────────────────────────────────
export async function GET(request: Request) {
  const url         = new URL(request.url);
  const productName = url.searchParams.get("productName") ?? "";
  const region      = url.searchParams.get("region")      ?? "";
  const duration    = url.searchParams.get("duration")    ?? "";
  const departure   = url.searchParams.get("departure")   ?? "";
  const saveToDb    = url.searchParams.get("save") === "true";

  if (!productName || !region || !duration) {
    return Response.json({ error: "필수 파라미터 누락 (productName, region, duration)" }, { status: 400 });
  }

  try {
    const client = getClaudeClient();

    // Phase 1: 공식 여행사 사이트 우선 + 웹 서치
    const researchContext = await researchFacts(client, productName, region, duration);

    // Phase 2: 검색 결과 기반 JSON 생성
    const prompt  = buildPrompt(productName, region, duration, departure, researchContext);
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 6000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw   = (message.content[0] as { type: "text"; text: string }).text;
    const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      const stopReason = (message as { stop_reason?: string }).stop_reason;
      if (stopReason === "max_tokens") {
        throw new Error("응답이 너무 길어 잘렸습니다. 일정이 많은 경우 발생할 수 있습니다. 다시 시도해주세요.");
      }
      throw new Error("JSON 파싱 실패: AI 응답 형식 오류. 다시 시도해주세요.");
    }

    // needsReview / sourceInfo 분리
    const { needsReview = [], sourceInfo = null, ...rawData } = parsed;

    // save=true 이면 Supabase에 저장 후 productId 반환
    let productId: string | undefined;
    if (saveToDb) {
      const { upsertProduct } = await import("@/lib/db");
      productId = crypto.randomUUID();
      const now = new Date().toISOString();
      await upsertProduct({
        id: productId,
        productType: "tour",
        productName,
        shippingLine: "",   // ProductSummary 호환 (투어는 미사용)
        shipName: "",       // ProductSummary 호환 (투어는 미사용)
        region,
        duration,
        departure,
        data: rawData,
        images: {},
        consulting: {
          enabled: true,
          phone: "02-733-9034",
          weekdayHours: "평일 10시 ~ 17시",
          chatHours: "오전 10:00 ~ 11:00 / 오후 3:00 ~ 4:00",
        },
        createdAt: now,
        updatedAt: now,
      });
    }

    return Response.json({
      ok: true,
      data: rawData,
      ...(productId ? { productId } : {}),
      needsReview,
      sourceInfo,
      searchUsed: !!researchContext,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
