"use client";

import type { GenStatus } from "@/lib/useGenerateSection";

type Props = {
  id: string;
  label: string;
  badge?: string;
  status: GenStatus;
  children: React.ReactNode;
};

const statusConfig: Record<GenStatus, { icon: string; text: string; color: string }> = {
  idle:       { icon: "○",  text: "대기",        color: "text-gray-400" },
  generating: { icon: "⟳",  text: "생성 중…",    color: "text-blue-500" },
  done:       { icon: "✓",  text: "완료",        color: "text-green-600" },
  error:      { icon: "✕",  text: "오류",        color: "text-red-500" },
};

export function SectionCard({ id, label, badge, status, children }: Props) {
  const cfg = statusConfig[status];

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all ${
      status === "done"      ? "border-gray-200" :
      status === "generating"? "border-blue-300 shadow-blue-50" :
      status === "error"     ? "border-red-200" :
      "border-gray-100 opacity-70"
    }`}>
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">{id}</span>
          <span className="text-sm font-semibold text-gray-800">{label}</span>
          {badge && (
            <span className="text-xs bg-blue-50 text-blue-600 font-medium px-2 py-0.5 rounded-full">{badge}</span>
          )}
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
          <span className={status === "generating" ? "animate-spin inline-block" : ""}>{cfg.icon}</span>
          <span>{cfg.text}</span>
        </div>
      </div>

      {/* 섹션 컨텐츠 */}
      <div className="p-6">{children}</div>
    </div>
  );
}
