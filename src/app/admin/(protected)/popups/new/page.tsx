"use client";

import { useState } from "react";
import PopupForm from "./popup-form";
import AiPrefillPanel, { type AiResult } from "./ai-prefill-panel";

export default function NewPopupPage() {
  const [prefill, setPrefill] = useState<AiResult | null>(null);
  return (
    <section className="max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">팝업 등록</h1>
      <p className="mt-2 text-sm text-slate-600">새로운 팝업 정보를 등록합니다.</p>
      <AiPrefillPanel onAnalyzed={setPrefill} />
      <PopupForm prefill={prefill} />
    </section>
  );
}
