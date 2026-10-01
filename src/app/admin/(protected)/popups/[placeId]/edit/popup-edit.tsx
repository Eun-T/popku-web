"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PopupForm, { type PopupDetail } from "../../new/popup-form";

type LoadState = { status: "loading" } | { status: "ready"; detail: PopupDetail } | { status: "error"; message: string };

export default function PopupEdit({ placeId }: { placeId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/admin/api/popups/${placeId}`, { signal: controller.signal, cache: "no-store" });
        if (response.status === 401) {
          window.location.assign("/admin/session/refresh");
          return;
        }
        if (!response.ok) {
          const body = await response.json() as { message?: string };
          throw new Error(body.message || "팝업 정보를 불러오지 못했습니다.");
        }
        const detail = await response.json() as PopupDetail;
        if (detail.place?.id !== Number(placeId) || !detail.popup || !Array.isArray(detail.tags)) {
          throw new Error("팝업 정보 형식을 확인할 수 없습니다.");
        }
        if (!controller.signal.aborted) setState({ status: "ready", detail });
      } catch (cause) {
        if (!controller.signal.aborted) setState({ status: "error", message: cause instanceof Error ? cause.message : "팝업 정보를 불러오지 못했습니다." });
      }
    }
    void load();
    return () => controller.abort();
  }, [placeId]);

  return <section className="max-w-4xl">
    <h1 className="text-2xl font-semibold tracking-tight">팝업 수정</h1>
    <p className="mt-2 text-sm text-slate-600">기본 정보를 수정합니다. 이미지는 이미지 관리 화면에서 변경할 수 있습니다.</p>
    {state.status === "loading" && <p role="status" className="mt-6 text-sm text-slate-600">팝업 정보를 불러오는 중입니다.</p>}
    {state.status === "error" && <div className="mt-6">
      <p role="alert" className="text-sm text-red-700">{state.message}</p>
      <Link href="/admin/popups" className="mt-4 inline-block text-sm font-medium text-blue-700 hover:underline">팝업 목록으로</Link>
    </div>}
    {state.status === "ready" && <PopupForm key={placeId} prefill={null} edit={{ placeId, detail: state.detail }} />}
  </section>;
}
