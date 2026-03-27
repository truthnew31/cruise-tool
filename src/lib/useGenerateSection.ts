// SSE 섹션 생성 공통 훅
"use client";

import { useState, useCallback } from "react";

export type GenStatus = "idle" | "generating" | "done" | "error";

type Options = {
  section: string;
  context: Record<string, unknown>;
  onResult: (data: unknown) => void;
  onError?: (msg: string) => void;
};

export function useGenerateSection() {
  const [status, setStatus] = useState<GenStatus>("idle");

  const generate = useCallback(async ({ section, context, onResult, onError }: Options) => {
    setStatus("generating");
    try {
      const res = await fetch("/api/generate-section", {
        method: "POST",
        body: new Blob(
          [JSON.stringify({ section, context })],
          { type: "application/json" }
        ),
      });
      if (!res.body) throw new Error("No SSE stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let eventName = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) { eventName = line.slice(7).trim(); continue; }
          if (line.startsWith("data: ")) {
            const payload = JSON.parse(line.slice(6));
            if (eventName === "result") { onResult(payload.data); setStatus("done"); }
            if (eventName === "error")  { throw new Error(payload.message); }
          }
        }
      }
    } catch (err) {
      setStatus("error");
      onError?.(err instanceof Error ? err.message : "알 수 없는 오류");
    }
  }, []);

  return { status, generate };
}
