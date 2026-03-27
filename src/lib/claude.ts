import Anthropic from "@anthropic-ai/sdk";

// 서버 사이드 전용 — API Route에서만 import
export function getClaudeClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

const MODEL = "claude-sonnet-4-5";

// JSON만 반환하는 공통 헬퍼
export async function generateJSON<T>(prompt: string): Promise<T> {
  const client = getClaudeClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  const text = (message.content[0] as { type: "text"; text: string }).text;
  // 마크다운 코드블록 제거 후 파싱
  const clean = text.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(clean) as T;
}

// ── 섹션별 프롬프트 ──

export function promptS01(shipLine: string, shipName: string, region: string) {
  return `크루즈 상품 상세페이지 인트로 카피를 생성해줘.
선사: ${shipLine}, 선박: ${shipName}, 코스: ${region}
JSON만 반환 (마크다운 없이):
{"sub": "소제목 15자 이내", "main": "메인카피 20자 이내, 감성적+행동유도"}`;
}

export function promptS03(shipLine: string, shipName: string, region: string) {
  return `크루즈 상품 개요 섹션 카피를 작성해줘.
선사: ${shipLine}, 선박: ${shipName}, 지역: ${region}
JSON만 반환:
{
  "sectionTag": "섹션 태그 10자 이내",
  "sectionTitle": "섹션 제목 20자 이내",
  "subCopy": "부제목 40자 이내, 여행 감성"
}`;
}

export function promptS04(shipLine: string, shipName: string, specs: object) {
  return `크루즈 선사 및 선박 소개문을 작성해줘.
선사: ${shipLine}, 선박: ${shipName}, 스펙: ${JSON.stringify(specs)}
2단락으로 작성. 첫 단락은 선사 소개, 두 번째 단락은 선박 소개.
JSON만 반환:
{"shipDescription": "소개문 전체 (두 단락, \\n\\n으로 구분)"}`;
}

export function promptS07Port(portName: string, country: string) {
  return `크루즈 기항지 소개 카피를 2~3문장으로 작성해줘.
기항지: ${portName}, 국가: ${country}
여행자 감성으로, 해당 도시의 매력을 강조.
JSON만 반환:
{"description": "기항지 소개 2~3문장"}`;
}

export function promptS08(region: string, headCopyMain: string) {
  return `크루즈 상품 상세페이지 마무리 감성 카피를 작성해줘.
지역: ${region}, 앞서 사용한 헤드카피: "${headCopyMain}"
헤드카피와 연결되는 감성적 마무리 문구. 20자 이내.
JSON만 반환:
{"closingCopy": "마무리 카피"}`;
}
