// GET /api/generate-from-keywords?sectionId=S07&fieldKey=portDescription&keywords=...&portName=...
// 쿼리 파라미터로 전달 → ByteString body 문제 우회

import { getClaudeClient } from "@/lib/claude";

export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-5";

function buildPrompt(
  sectionId: string,
  fieldKey: string,
  keywords: string,
  ctx: Record<string, string>
): string {
  if (sectionId === "S07" || fieldKey === "portDescription") {
    return `크루즈 기항지 소개를 2~3문장으로 작성해줘.
기항지: ${ctx.portName ?? keywords}
선박: ${ctx.shipName ?? ""}, 코스: ${ctx.region ?? ""}
참고 키워드: ${keywords}
여행자 감성으로 해당 항구 도시의 매력을 담아 작성.
JSON만 반환: {"text": "기항지 소개 2~3문장"}`;
  }
  if (sectionId === "S05" || fieldKey === "cabinDescription") {
    return `크루즈 객실(캐빈) 소개를 2문장으로 작성해줘.
객실 타입: ${ctx.cabinType ?? ""}
선박: ${ctx.shipName ?? ""}
참고 키워드: ${keywords}
JSON만 반환: {"text": "객실 소개 2문장"}`;
  }
  if (sectionId === "S06" || fieldKey === "facilityDescription") {
    return `크루즈 선내 시설 소개를 1~2문장으로 작성해줘.
시설명: ${ctx.facilityName ?? ""}
선박: ${ctx.shipName ?? ""}
참고 키워드: ${keywords}
JSON만 반환: {"text": "시설 소개 1~2문장"}`;
  }
  return `다음 키워드를 바탕으로 2~3문장의 소개 문장을 작성해줘.
키워드: ${keywords}
JSON만 반환: {"text": "소개 문장"}`;
}

export async function GET(request: Request) {
  const url       = new URL(request.url);
  const p         = url.searchParams;
  const sectionId = p.get("sectionId") ?? "generic";
  const fieldKey  = p.get("fieldKey")  ?? "";
  const keywords  = p.get("keywords")  ?? "";

  if (!keywords.trim()) {
    return Response.json({ text: "" }, { status: 400 });
  }

  // 컨텍스트 파라미터 (전부 쿼리에서 읽음)
  const ctx: Record<string, string> = {};
  ["shipName", "shippingLine", "region", "portName", "facilityName", "cabinType"].forEach(k => {
    const v = p.get(k);
    if (v) ctx[k] = v;
  });

  try {
    const client = getClaudeClient();
    const prompt = buildPrompt(sectionId, fieldKey, keywords, ctx);
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const raw   = (message.content[0] as { type: "text"; text: string }).text;
    const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
    return Response.json(JSON.parse(clean) as { text: string });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
