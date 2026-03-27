// GET /api/generate-section?section=S01&shippingLine=...&shipName=...&region=...
// 쿼리 파라미터로 데이터 전달 → ByteString fetch body 문제 완전 우회
// SSE 스트리밍으로 생성 결과 반환

import {
  generateJSON,
  promptS01,
  promptS03,
  promptS04,
  promptS07Port,
  promptS08,
} from "@/lib/claude";

export const dynamic = "force-dynamic";

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
  const url   = new URL(request.url);
  const p     = url.searchParams;
  const section = p.get("section") ?? "";

  // 컨텍스트 파라미터
  const shippingLine  = p.get("shippingLine")  ?? "";
  const shipName      = p.get("shipName")       ?? "";
  const region        = p.get("region")         ?? "";
  const portName      = p.get("portName")       ?? "";
  const country       = p.get("country")        ?? "";
  const headCopyMain  = p.get("headCopyMain")   ?? "";
  const specsJson     = p.get("specs")          ?? "{}";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: string, d: unknown) =>
        controller.enqueue(encoder.encode(sseEvent(e, d)));

      try {
        send("status", { generating: true });
        let result: unknown;

        switch (section) {
          case "S01":
            result = await generateJSON<{ sub: string; main: string }>(
              promptS01(shippingLine, shipName, region)
            );
            break;
          case "S03":
            result = await generateJSON<{
              sectionTag: string; sectionTitle: string; subCopy: string;
            }>(promptS03(shippingLine, shipName, region));
            break;
          case "S04": {
            const specs = JSON.parse(specsJson);
            result = await generateJSON<{ shipDescription: string }>(
              promptS04(shippingLine, shipName, specs)
            );
            break;
          }
          case "S07_port":
            result = await generateJSON<{ description: string }>(
              promptS07Port(portName, country)
            );
            break;
          case "S08":
            result = await generateJSON<{ closingCopy: string }>(
              promptS08(region, headCopyMain)
            );
            break;
          default:
            throw new Error(`Unknown section: ${section}`);
        }

        send("result", { section, data: result });
        send("done",   { success: true });
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      Connection:      "keep-alive",
    },
  });
}
