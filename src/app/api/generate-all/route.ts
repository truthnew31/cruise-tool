// GET /api/generate-all?shippingLine=...&shipName=...&region=...
// Phase 1: 공식 선사 사이트 우선 → 웹 검색으로 실측 정보 수집
// Phase 2: 검색 결과 기반 JSON 생성

import Anthropic from "@anthropic-ai/sdk";
import { getClaudeClient } from "@/lib/claude";

export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-5";

// ── 태그 기준 정렬 (무료 → 일부유료 → 유료) ────────────────────
const TAG_ORDER: Record<string, number> = { free: 0, partially_paid: 1, paid: 2 };
function sortByTag<T extends { tag: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => (TAG_ORDER[a.tag] ?? 9) - (TAG_ORDER[b.tag] ?? 9));
}

// ── Phase 1: 웹 서치로 팩트 수집 ────────────────────────────────
async function researchFacts(
  client: Anthropic,
  shippingLine: string,
  shipName: string,
  region: string
): Promise<string> {
  try {
    const query = `크루즈 선박 "${shipName}" (${shippingLine}) 의 정확한 정보를 검색해줘.

🔍 검색 우선순위:
1순위: 공식 선사 홈페이지 (ncl.com, royalcaribbean.com, princess.com, msc.com, celebrity.com 등) → [공식] 표시
2순위: 위키피디아, cruisemapper.com, cruiseline.com 등 전문 사이트 → [검색] 표시
확인 불가 항목 → "미확인" 표시

수집 항목:
1. 선박 공식 제원 (건조년도, GT 톤수, 전장m, 전폭m, 승객 정원, 승무원 수)

2. 선내 실제 시설 (이 선박에 실제로 있는 것만, 정확한 이름)
   - 주요 부대시설 (수영장·스파·카지노·극장·스포츠 등) + 각 무료/유료 여부
   - 어린이·패밀리 시설 (키즈클럽·워터파크·놀이터 등) + 각 무료/유료 여부
   - 다이닝 (레스토랑·바·라운지 이름과 무료/유료 여부)
   - 별도 유료 시설 목록

3. "${region}" 항로의 전체 기항지 일정
   ⚠️ 중요: 출발항부터 모든 기항지, 도착항까지 순서대로 전부 나열 (누락 없이)
   각 기항지마다 도시명과 국가명 명시

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
    console.warn("[generate-all] Web search failed:", err);
    return "";
  }
}

// ── Phase 2: 검색 결과 기반 JSON 생성 ───────────────────────────
function buildPrompt(
  shippingLine: string,
  shipName: string,
  region: string,
  researchContext: string
): string {
  const contextBlock = researchContext
    ? `아래는 웹 검색으로 확인된 실제 정보입니다. [공식]/[검색]/미확인 표시를 참고해 신뢰도를 판단하세요:\n\n${researchContext}\n\n---\n\n`
    : "";

  return `${contextBlock}크루즈 상품 상세페이지 JSON을 생성해줘.

선사: ${shippingLine}
선박: ${shipName}
항로/코스: ${region}

⚠️ 정확성 규칙 (반드시 준수):
- S04 specs: 검색에서 [공식] 표시된 수치만 사용. 없거나 불확실하면 "" (빈 문자열). 절대 추측 금지.
- S06 시설명: 해당 선박에 실제 존재하는 시설만. 무료/유료 여부 정확히 반영.
  - tag 값: "free"(무료 포함), "partially_paid"(일부 유료), "paid"(완전 유료)
  - 각 카테고리 내에서 free → partially_paid → paid 순서로 정렬
- S07 기항지: 출발항부터 도착항까지 실제 코스 전체를 순서대로 기재. 3개로 제한하지 말고 실제 일정 그대로.
- S01·S03·S05·S08 카피: 창의적으로 자유롭게 작성 가능.

아래 JSON 형식으로만 반환. 마크다운 코드블록 없이 순수 JSON만.

{
  "S01": {
    "sub": "서브카피 15자 이내. FOMO(긴박감)·가격 후킹 위주.",
    "main": "메인카피 20자 이내. 여행지 자체 소구. 감성적·행동 유도."
  },
  "S02": { "note": "" },
  "S03": {
    "sectionTag": "섹션 태그 8자 이내",
    "sectionTitle": "섹션 제목 20자 이내",
    "subCopy": "부제목 40자 이내 (여행 감성)",
    "highlights": [
      "기항지·자연·문화 하이라이트 1 (15자 이내)",
      "기항지·자연·문화 하이라이트 2 (15자 이내)",
      "선사 서비스 하이라이트 (15자 이내)",
      "선사 서비스 하이라이트 (15자 이내)"
    ]
  },
  "S04": {
    "shippingLineDesc": "선사 소개 2~3문장.",
    "shipDesc": "선박 소개 2~3문장.",
    "specs": {
      "builtYear": "건조년도 (불확실 시 \"\")",
      "tonnage": "총 톤수 (불확실 시 \"\")",
      "length": "전장m (불확실 시 \"\")",
      "width": "전폭m (불확실 시 \"\")",
      "passengers": "승객 정원 (불확실 시 \"\")",
      "crew": "승무원 수 (불확실 시 \"\")"
    }
  },
  "S05": {
    "intro": "캐빈 소개 1~2문장.",
    "cabinTypes": [
      { "name": "인사이드 캐빈", "desc": "가성비 강조 1~2문장.", "subDesc": "최대 투숙 인원·침대 구성 1문장." },
      { "name": "오션뷰 캐빈", "desc": "뷰 소구 1~2문장.", "subDesc": "최대 투숙 인원·침대 구성 1문장." },
      { "name": "발코니 캐빈", "desc": "발코니 경험 소구 1~2문장.", "subDesc": "최대 투숙 인원·침대 구성 1문장." }
    ]
  },
  "S06": {
    "intro": "선내 시설 전체 소개 1~2문장",
    "mainFacilities": [
      { "name": "실제 시설명 (무료 우선 배치)", "desc": "시설 특징 1문장", "tag": "free" },
      { "name": "실제 시설명", "desc": "시설 특징 1문장", "tag": "free" },
      { "name": "실제 시설명 (유료는 하단)", "desc": "시설 특징 1문장", "tag": "paid" }
    ],
    "kidsSubDesc": "어린이 전용 시설 소개 1문장",
    "kidsFacilities": [
      { "name": "실제 어린이·패밀리 시설명", "desc": "시설 특징 1문장", "tag": "free" }
    ],
    "diningSubDesc": "선박 다이닝 전반 특징 1문장",
    "dining": [
      { "name": "실제 레스토랑/바 이름 (무료 우선)", "desc": "다이닝 특징 1문장", "tag": "free" },
      { "name": "실제 레스토랑/바 이름 (유료 하단)", "desc": "다이닝 특징 1문장", "tag": "paid" }
    ],
    "notIncluded": [
      { "name": "실제 유료 전용 시설명", "desc": "간단 설명" }
    ]
  },
  "S07": {
    "intro": "기항지 일정 소개 1~2문장",
    "ports": [
      { "name": "출발항 도시명", "country": "국가명", "desc": "도시 소개 2문장" },
      { "name": "기항지 도시명", "country": "국가명", "desc": "도시 소개 2문장" },
      "...실제 코스 전체를 순서대로. 3개로 제한하지 말 것. 실제 일정이 7개면 7개, 10개면 10개..."
    ]
  },
  "S08": {
    "closingCopy": "마무리 감성 카피 20자 이내"
  },
  "needsReview": ["공식 소스 미확인 항목 목록. 예: \"S04.specs.builtYear\", \"S06 — 스파 유료 여부\". 모두 확인됐으면 []"],
  "sourceInfo": {
    "summary": "어떤 출처를 사용했는지 1~3문장 요약. 예: 'NCL 공식 홈페이지(ncl.com)에서 선박 제원과 시설 목록을 확인했습니다. 기항지 전체 코스는 ncl.com 항로 페이지를 참조했습니다.'",
    "officialUrl": "공식 사이트에서 참조한 URL (없으면 null)",
    "verifiedFields": ["공식 소스로 확인된 주요 항목 목록. 예: 'S04 선박 제원', 'S06 시설명 및 유료 여부'"],
    "unverifiedFields": ["검색만으로 확인되거나 불확실한 항목. 예: '기항지 3번째 이후'"]
  }
}`;
}

// ── 라우트 핸들러 ────────────────────────────────────────────────
export async function GET(request: Request) {
  const url          = new URL(request.url);
  const shippingLine = url.searchParams.get("shippingLine") ?? "";
  const shipName     = url.searchParams.get("shipName")     ?? "";
  const region       = url.searchParams.get("region")       ?? "";
  const departure    = url.searchParams.get("departure")    ?? "";
  const saveToDb     = url.searchParams.get("save") === "true";

  if (!shippingLine || !shipName || !region) {
    return Response.json({ error: "필수 파라미터 누락" }, { status: 400 });
  }

  try {
    const client = getClaudeClient();

    // Phase 1: 공식 사이트 우선 + 웹 서치
    const researchContext = await researchFacts(client, shippingLine, shipName, region);

    // Phase 2: 검색 결과 기반 JSON 생성
    const prompt  = buildPrompt(shippingLine, shipName, region, researchContext);
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw    = (message.content[0] as { type: "text"; text: string }).text;
    const clean  = raw.replace(/```json\n?|\n?```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      // max_tokens 초과로 JSON이 잘린 경우 stop_reason 확인
      const stopReason = (message as { stop_reason?: string }).stop_reason;
      if (stopReason === "max_tokens") {
        throw new Error("응답이 너무 길어 잘렸습니다. 항로/기항지가 많은 경우 발생할 수 있습니다. 다시 시도해주세요.");
      }
      throw new Error("JSON 파싱 실패: AI 응답 형식 오류. 다시 시도해주세요.");
    }

    // needsReview / sourceInfo 분리
    const { needsReview = [], sourceInfo = null, ...rawData } = parsed;

    // S06 시설 태그 순서 보정 (무료→상단, 유료→하단)
    if (rawData.S06) {
      if (Array.isArray(rawData.S06.mainFacilities))
        rawData.S06.mainFacilities = sortByTag(rawData.S06.mainFacilities);
      if (Array.isArray(rawData.S06.kidsFacilities))
        rawData.S06.kidsFacilities = sortByTag(rawData.S06.kidsFacilities);
      if (Array.isArray(rawData.S06.dining))
        rawData.S06.dining = sortByTag(rawData.S06.dining);
    }

    // save=true 이면 Supabase에 저장 후 productId 반환
    let productId: string | undefined;
    if (saveToDb) {
      const { upsertProduct } = await import("@/lib/db");
      productId = crypto.randomUUID();
      const now = new Date().toISOString();
      await upsertProduct({
        id: productId,
        shippingLine,
        shipName,
        region,
        departure,
        data: rawData,   // 편집 페이지 구조와 일치: p.data.S01 ...
        images: {},
        benefits: [
          { key: "wifi", enabled: true },
          { key: "port_voucher", enabled: true },
          { key: "onboard_credit", enabled: true },
        ],
        priceRows: [{ id: "1", cabin: "", guests: 2, total: 0, note: "" }],
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
