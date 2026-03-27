// POST /api/generate
// Claude API로 섹션별 카피를 생성하고 SSE로 진행률 스트리밍

import {
  generateJSON,
  promptS01,
  promptS03,
  promptS04,
  promptS07Port,
  promptS08,
} from "@/lib/claude";
import type { Port } from "@/types/cruise";

export const dynamic = "force-dynamic";

type GenerateRequest = {
  shippingLine: string;
  shipName: string;
  region: string;
  scrapedTexts?: {
    spec?: string;
    cabin?: string;
    facility?: string;
    itinerary?: string;
  };
  ports?: Pick<Port, "portName" | "portNameEn">[];
};

// SSE 헬퍼
function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const body: GenerateRequest = await request.json();
  const { shippingLine, shipName, region, scrapedTexts = {}, ports = [] } = body;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      }

      try {
        send("progress", { step: "S01", label: "인트로 카피 생성 중…", pct: 10 });
        const s01Copy = await generateJSON<{ sub: string; main: string }>(
          promptS01(shippingLine, shipName, region)
        );
        send("result", { section: "S01", data: s01Copy });

        send("progress", { step: "S03", label: "상품 개요 카피 생성 중…", pct: 25 });
        const s03Copy = await generateJSON<{
          sectionTag: string;
          sectionTitle: string;
          subCopy: string;
        }>(promptS03(shippingLine, shipName, region));
        send("result", { section: "S03", data: s03Copy });

        send("progress", { step: "S04", label: "선박 소개 카피 생성 중…", pct: 45 });
        const specHint = scrapedTexts.spec?.slice(0, 500) ?? "";
        const s04Copy = await generateJSON<{ shipDescription: string }>(
          promptS04(shippingLine, shipName, { specHint })
        );
        send("result", { section: "S04", data: s04Copy });

        // S07 기항지 — 포트별 병렬 생성 (최대 5개)
        if (ports.length > 0) {
          send("progress", { step: "S07", label: "기항지 카피 생성 중…", pct: 65 });
          const portSlice = ports.slice(0, 5);
          const portCopies = await Promise.all(
            portSlice.map((p) =>
              generateJSON<{ description: string }>(
                promptS07Port(p.portName, p.portNameEn)
              ).then((r) => ({ portName: p.portName, ...r }))
            )
          );
          send("result", { section: "S07", data: portCopies });
        }

        send("progress", { step: "S08", label: "마무리 카피 생성 중…", pct: 85 });
        const s08Copy = await generateJSON<{ closingCopy: string }>(
          promptS08(region, s01Copy.main)
        );
        send("result", { section: "S08", data: s08Copy });

        send("progress", { step: "done", label: "카피 생성 완료", pct: 100 });
        send("done", { success: true });
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
