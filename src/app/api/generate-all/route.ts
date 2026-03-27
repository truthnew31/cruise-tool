// GET /api/generate-all?shippingLine=...&shipName=...&region=...
// Phase 1: 웹 검색으로 선박 제원 + 기항지 실측 정보 수집
// Phase 2: 검색 결과 기반 JSON 생성 (불확실한 항목은 빈 문자열)

import Anthropic from "@anthropic-ai/sdk";
import { getClaudeClient } from "@/lib/claude";

export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-5";

// ── Phase 1: 웹 서치로 팩트 수집 ────────────────────────────
async function researchFacts(
  client: Anthropic,
  shippingLine: string,
  shipName: string,
  region: string
): Promise<string> {
  try {
    const query = `크루즈 선박 "${shipName}" (${shippingLine}) 에 대해 아래 항목을 검색해줘:

1. 선박 공식 제원
   - 건조년도, 총 톤수(GT), 전장(m), 전폭(m), 승객 정원, 승무원 수

2. 선내 실제 시설 목록 (이 선박에 실제로 있는 것만)
   - 주요 부대시설: 수영장, 스파, 카지노, 극장, 스포츠시설 등 (이름 포함)
   - 어린이/패밀리 시설: 키즈클럽, 워터파크, 놀이터 등 (이름 포함)
   - 다이닝: 메인 레스토랑, 스페셜티 레스토랑, 바/라운지 (이름과 무료/유료 여부)
   - 별도 유료 시설 목록

3. "${region}" 항로의 실제 기항지 목록 (도시명, 국가명)

확인된 사실만 나열하고, 모르는 항목은 "미확인"으로 표시해.`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (client as any).beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      betas: ["web-search-2025-03-05"],
      messages: [{ role: "user", content: query }],
    });

    // content 배열에서 텍스트 블록만 추출
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const texts = (res.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text);

    return texts.join("\n").trim();
  } catch (err) {
    // 웹 서치 실패 시 Phase 2에서 보수적으로 생성
    console.warn("[generate-all] Web search failed, proceeding conservatively:", err);
    return "";
  }
}

// ── Phase 2: 검색 결과 기반 JSON 생성 ───────────────────────
function buildPrompt(
  shippingLine: string,
  shipName: string,
  region: string,
  researchContext: string
): string {
  const contextBlock = researchContext
    ? `아래는 웹 검색으로 확인된 실제 정보입니다. 이 정보를 우선 사용하세요:\n\n${researchContext}\n\n---\n\n`
    : "";

  return `${contextBlock}크루즈 상품 상세페이지 JSON을 생성해줘.

선사: ${shippingLine}
선박: ${shipName}
항로/코스: ${region}

⚠️ 정확성 규칙 (반드시 준수):
- S04 specs (건조년도·톤수·길이·너비·승객수·승무원): 위 검색 결과에서 확인된 수치만 사용. 검색 결과에 없거나 불확실한 항목은 반드시 "" (빈 문자열)로 남길 것. 절대 추측하거나 가짜 숫자를 채우지 말 것.
- S06 시설명: 해당 선박에 실제 존재하는 시설만 기재. 불확실하면 항목 수를 줄여도 됨.
- S07 기항지: 해당 항로의 실제 기항지만. 불확실한 기항지는 제외.
- S01·S03·S05·S08 카피: 창의적으로 자유롭게 작성 가능.

아래 JSON 형식으로만 반환. 마크다운 코드블록 없이 순수 JSON만.

{
  "S01": {
    "sub": "서브카피 15자 이내. FOMO(긴박감)·가격 후킹 위주. 예: '올해 딱 5달만 열리는 자연의 문!' / '지금 예약이 가장 저렴합니다'",
    "main": "메인카피 20자 이내. 여행지 자체 소구. 감성적·행동 유도. 예: '알래스카의 야생을 크루즈로'"
  },
  "S02": {
    "note": "마이리얼트립 단독 혜택 섹션 (내용 고정, 별도 생성 불필요)"
  },
  "S03": {
    "sectionTag": "섹션 태그 8자 이내",
    "sectionTitle": "섹션 제목 20자 이내",
    "subCopy": "부제목 40자 이내 (여행 감성)",
    "highlights": [
      "기항지·자연·문화 하이라이트 1 (15자 이내, 여행지 중심)",
      "기항지·자연·문화 하이라이트 2 (15자 이내, 여행지 중심)",
      "선사 서비스 하이라이트 (15자 이내, 예: '올 인클루시브 혜택' / '무제한 뷔페 포함')",
      "선사 서비스 하이라이트 (15자 이내, 예: '가족 친화적 크루즈' / '어린이 클럽 무료')"
    ]
  },
  "S04": {
    "shippingLineDesc": "선사 소개 2~3문장. 선사의 특징과 철학.",
    "shipDesc": "선박 소개 2~3문장. 선박 규모, 분위기, 특징.",
    "specs": {
      "builtYear": "건조년도. 확인 안 되면 \"\"",
      "tonnage": "총 톤수. 확인 안 되면 \"\"",
      "length": "전장(m). 확인 안 되면 \"\"",
      "width": "전폭(m). 확인 안 되면 \"\"",
      "passengers": "승객 정원. 확인 안 되면 \"\"",
      "crew": "승무원 수. 확인 안 되면 \"\""
    }
  },
  "S05": {
    "intro": "캐빈 소개 문구 1~2문장. 다양한 가격대와 취향에 맞게 선택 가능하다는 점 강조.",
    "cabinTypes": [
      {
        "name": "인사이드 캐빈",
        "desc": "캐빈 특징 1~2문장. 인사이드/스튜디오는 '가성비 최강 객실' '1인 여행자에게 완벽한 선택' 등 가격 메리트 언급.",
        "subDesc": "최대 투숙 인원·침대 구성 안내 1문장. 예: 최대 2명 투숙 가능하며, 더블 베드로 구성됩니다."
      },
      {
        "name": "오션뷰 캐빈",
        "desc": "캐빈 특징 1~2문장. 뷰 소구 중심.",
        "subDesc": "최대 투숙 인원·침대 구성 안내 1문장."
      },
      {
        "name": "발코니 캐빈",
        "desc": "캐빈 특징 1~2문장. 프라이빗 발코니 경험 소구.",
        "subDesc": "최대 투숙 인원·침대 구성 안내 1문장. 3~4인 가족 여행 시 소파/벙커 침대 제공 여부도 언급."
      }
    ]
  },
  "S06": {
    "intro": "선내 시설 전체 소개 1~2문장",
    "mainFacilities": [
      { "name": "실제 존재하는 주요 부대시설명", "desc": "시설 특징 1문장", "tag": "free" },
      { "name": "실제 존재하는 주요 부대시설명", "desc": "시설 특징 1문장", "tag": "free" },
      { "name": "실제 존재하는 주요 부대시설명", "desc": "시설 특징 1문장", "tag": "free" }
    ],
    "kidsSubDesc": "어린이 전용 시설 소개 1문장",
    "kidsFacilities": [
      { "name": "실제 존재하는 어린이/패밀리 시설명", "desc": "시설 특징 1문장", "tag": "free" },
      { "name": "실제 존재하는 어린이/패밀리 시설명", "desc": "시설 특징 1문장", "tag": "free" }
    ],
    "diningSubDesc": "선박 다이닝 전반 특징 1문장",
    "dining": [
      { "name": "실제 레스토랑/바 이름", "desc": "다이닝 특징 1문장", "tag": "free" },
      { "name": "실제 레스토랑/바 이름", "desc": "다이닝 특징 1문장", "tag": "paid" },
      { "name": "실제 레스토랑/바 이름", "desc": "다이닝 특징 1문장", "tag": "free" }
    ],
    "notIncluded": [
      { "name": "실제 유료 시설명", "desc": "간단 설명" },
      { "name": "실제 유료 시설명", "desc": "간단 설명" }
    ]
  },
  "S07": {
    "intro": "기항지 일정 소개 1~2문장",
    "ports": [
      { "name": "실제 기항지명", "country": "국가명", "desc": "기항지 소개 2문장" },
      { "name": "실제 기항지명", "country": "국가명", "desc": "기항지 소개 2문장" },
      { "name": "실제 기항지명", "country": "국가명", "desc": "기항지 소개 2문장" }
    ]
  },
  "S08": {
    "closingCopy": "마무리 감성 카피 20자 이내 (S01 메인카피와 연결되는 느낌)"
  }
}`;
}

// ── 라우트 핸들러 ────────────────────────────────────────────
export async function GET(request: Request) {
  const url          = new URL(request.url);
  const shippingLine = url.searchParams.get("shippingLine") ?? "";
  const shipName     = url.searchParams.get("shipName")     ?? "";
  const region       = url.searchParams.get("region")       ?? "";

  if (!shippingLine || !shipName || !region) {
    return Response.json({ error: "필수 파라미터 누락" }, { status: 400 });
  }

  try {
    const client = getClaudeClient();

    // Phase 1: 웹 서치로 실제 정보 수집 (실패해도 계속 진행)
    const researchContext = await researchFacts(client, shippingLine, shipName, region);

    // Phase 2: 검색 결과 기반 JSON 생성
    const prompt  = buildPrompt(shippingLine, shipName, region, researchContext);
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw   = (message.content[0] as { type: "text"; text: string }).text;
    const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
    const data  = JSON.parse(clean);

    return Response.json({ ok: true, data, searchUsed: !!researchContext });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
