"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PopupListItem } from "@/lib/admin-popup-api";

function sessionExpired(status: number) {
  if (status === 401) {
    window.location.assign("/admin/session/refresh");
    return true;
  }
  return false;
}

async function errorMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message || fallback;
  } catch {
    return fallback;
  }
}

export default function PopupTable() {
  const [popups, setPopups] = useState<PopupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/admin/api/popups", { signal: controller.signal, cache: "no-store" });
        if (sessionExpired(response.status)) return;
        if (!response.ok) throw new Error(await errorMessage(response, "팝업 목록을 불러오지 못했습니다."));
        const items = (await response.json()) as PopupListItem[];
        if (!controller.signal.aborted) setPopups(items);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "팝업 목록을 불러오지 못했습니다.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  async function remove(popup: PopupListItem) {
    if (!window.confirm(`'${popup.name}' 팝업을 삭제하시겠습니까?`)) return;
    setError("");
    setDeletingId(popup.id);
    try {
      const response = await fetch(`/admin/api/popups/${popup.id}`, { method: "DELETE" });
      if (sessionExpired(response.status)) return;
      if (!response.ok) throw new Error(await errorMessage(response, "팝업을 삭제하지 못했습니다."));
      setPopups((current) => current.filter((item) => item.id !== popup.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "팝업을 삭제하지 못했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-8">
      {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
      {loading ? <p role="status" className="text-sm text-slate-600">팝업 목록을 불러오는 중입니다.</p> :
        !error && popups.length === 0 ? <p className="border-y border-slate-200 py-8 text-center text-sm text-slate-600">등록된 팝업이 없습니다.</p> :
          popups.length > 0 && <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
            <table className="w-full min-w-[880px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  {['ID', '팝업명', '국가', '지역', '시작일', '종료일', '태그', '관리'].map((heading) =>
                    <th key={heading} scope="col" className="border-b border-slate-200 px-4 py-3 font-semibold">{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {popups.map((popup) => <tr key={popup.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-4 py-3 text-slate-600">{popup.id}</td>
                  <td className="px-4 py-3 font-medium">{popup.name}</td>
                  <td className="px-4 py-3">{popup.countryCode || '—'}</td>
                  <td className="px-4 py-3">{popup.regionName || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3">{popup.startDate || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3">{popup.endDate || '—'}</td>
                  <td className="px-4 py-3">{popup.tags.length ? popup.tags.join(', ') : '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link href={`/admin/popups/${popup.id}/edit`} className="font-medium text-blue-700 hover:underline">수정</Link>
                    <Link href={`/admin/popups/${popup.id}/images`} className="ml-4 font-medium text-blue-700 hover:underline">이미지 관리</Link>
                    <button type="button" disabled={deletingId !== null} onClick={() => void remove(popup)}
                      className="ml-4 font-medium text-red-700 hover:underline disabled:cursor-wait disabled:opacity-50">
                      {deletingId === popup.id ? '삭제 중...' : '삭제'}
                    </button>
                  </td>
                </tr>)}
              </tbody>
            </table>
          </div>}
    </div>
  );
}
