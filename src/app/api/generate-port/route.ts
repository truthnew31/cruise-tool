// GET /api/generate-port?portName=주노
// Claude Haiku로 기항지 국가 + 소개 자동 생성

import { getClaudeClient } from "@/lib/claude";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url      = new URL(request.url);
  const portName = url.searchParams.get("portName") ?? "";

  if (!portName.trim()) {
    return Response.json({ ok: false, error: "portName 누락" }, { status: 400 });
  }

  const prompt = `크루즈 기항지 "${portName}"에 대한 정보를 JSON으로 반환해줘.

마크다운 없이 순수 JSON만:
{
  "country": "국가명 (한국어, 예: 미국 / 노르웨이 / 캐나다)",
  "desc": "기항지 소개 2문장. 주요 관광지·체험거리 중심. 여행자 감성으로. 60자 이내."
}`;

  try {
    const client  = getClaudeClient();
    const message = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages:   [{ role: "user", content: prompt }],
    });

    const raw   = (message.content[0] as { type: "text"; text: string }).text;
    const clean = raw.replace(/```json\n?|\n?```/g, "").trim();
    const data  = JSON.parse(clean);

    return Response.json({ ok: true, data });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
