"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Country = "KR" | "JP";
type Popup = { placeId: number; name: string; countryCode: Country; regionName: string | null;
  startDate: string | null; endDate: string | null; coverImageUrl: string | null };

function expired(p: Popup) {
  if (!p.endDate || !/^\d{4}-\d{2}-\d{2}$/.test(p.endDate)) return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const today = `${value("year")}-${value("month")}-${value("day")}`;
  return p.endDate < today;
}
function meta(p: Popup) { return `${p.regionName ?? "지역 미등록"} · ${p.startDate ?? "날짜 미정"} ~ ${p.endDate ?? "날짜 미정"}`; }
function cover(p: Popup) {
  // Presigned S3 hosts vary by environment, so use a regular image element.
  // eslint-disable-next-line @next/next/no-img-element
  return p.coverImageUrl ? <img src={p.coverImageUrl} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
    : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-slate-100 text-xs text-slate-500">COVER 없음</div>;
}
export default function HomeCurationManager() {
  const router = useRouter();
  const api = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(path, { cache: "no-store", ...init });
    if (response.status === 401) router.push("/admin/session/refresh");
    if (!response.ok) {
      let message = "요청을 처리하지 못했습니다.";
      try { message = ((await response.json()) as { message?: string }).message || message; } catch { /* fallback */ }
      throw new Error(message);
    }
    return response;
  }, [router]);
  const [country, setCountry] = useState<Country>("KR");
  const [selected, setSelected] = useState<Popup[]>([]);
  const [results, setResults] = useState<Popup[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const base = `/admin/api/home-curations?countryCode=${country}`;
        const [current, available] = await Promise.all([
          api(base, { signal: controller.signal }), api(`${base}&search=${encodeURIComponent(query)}`, { signal: controller.signal }),
        ]);
        const [items, matches] = await Promise.all([current.json(), available.json()]) as [Popup[], Popup[]];
        if (!controller.signal.aborted) { setSelected(items); setResults(matches); }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "목록을 불러오지 못했습니다.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, query ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [api, country, query]);

  async function refresh() {
    const base = `/admin/api/home-curations?countryCode=${country}`;
    const [current, available] = await Promise.all([api(base), api(`${base}&search=${encodeURIComponent(query)}`)]);
    setSelected((await current.json()) as Popup[]); setResults((await available.json()) as Popup[]);
  }
  async function change(action: () => Promise<Response>) {
    setBusy(true); setError("");
    try { await action(); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "변경하지 못했습니다."); }
    finally { setBusy(false); }
  }
  function add(placeId: number) {
    void change(() => api(`/admin/api/home-curations?countryCode=${country}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ countryCode: country, placeId }),
    }));
  }
  function remove(placeId: number) {
    void change(() => api(`/admin/api/home-curations?countryCode=${country}&placeId=${placeId}`, { method: "DELETE" }));
  }
  function move(index: number, delta: number) {
    const ids = selected.map((p) => p.placeId);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    void change(() => api(`/admin/api/home-curations?countryCode=${country}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ countryCode: country, placeIds: ids }),
    }));
  }
  const chosen = new Set(selected.map((p) => p.placeId));
  return <div className="mt-8 space-y-8">
    <div className="flex gap-2" role="group" aria-label="국가 선택">{(["KR", "JP"] as const).map((code) => <button key={code}
      type="button" aria-pressed={country === code} onClick={() => { setCountry(code); setSelected([]); setResults([]); setQuery(""); }}
      className={`rounded-md px-4 py-2 text-sm font-semibold ${country === code ? "bg-blue-700 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>
      {code === "KR" ? "한국" : "일본"}</button>)}</div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <section aria-label="현재 노출 목록">
      <div className="flex items-center gap-3"><h2 className="text-lg font-semibold">현재 노출 목록</h2><span className="text-sm text-slate-600">{selected.length} / 10</span></div>
      {loading ? <p className="mt-3 text-sm text-slate-600">불러오는 중...</p> : selected.length === 0
        ? <p className="mt-3 rounded-md border border-slate-200 p-5 text-sm text-slate-600">선택한 팝업이 없습니다.</p>
        : <ol className="mt-3 space-y-2">{selected.map((p, i) => <li key={p.placeId} className="flex flex-wrap items-center gap-4 rounded-md border border-slate-200 bg-white p-3">
          <strong className="w-8 text-center text-blue-800">{i + 1}위</strong>{cover(p)}
          <div className="min-w-0 flex-1"><p className="font-medium">{p.name} {expired(p) && <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700">종료됨</span>}</p>
            <p className="text-sm text-slate-600">{meta(p)}</p></div>
          <div className="flex gap-2 text-sm">
            <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} className="rounded border px-2 py-1 disabled:opacity-40">위로</button>
            <button type="button" disabled={busy || i === selected.length - 1} onClick={() => move(i, 1)} className="rounded border px-2 py-1 disabled:opacity-40">아래로</button>
            <button type="button" disabled={busy} onClick={() => remove(p.placeId)} className="rounded border border-red-300 px-2 py-1 text-red-700 disabled:opacity-40">제거</button>
          </div></li>)}</ol>}
    </section>
    <section aria-label="팝업 선택">
      <h2 className="text-lg font-semibold">팝업 선택</h2>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="팝업명 검색" aria-label="팝업명 검색"
        className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      {selected.length >= 10 && <p className="mt-2 text-sm text-amber-700">최대 10개까지 선택할 수 있습니다.</p>}
      {loading ? <p className="mt-3 text-sm text-slate-600">불러오는 중...</p> : results.length === 0
        ? <p className="mt-3 text-sm text-slate-600">검색 결과가 없습니다.</p>
        : <ul className="mt-3 max-h-[600px] space-y-2 overflow-y-auto">{results.map((p) => <li key={p.placeId} className="flex items-center gap-4 rounded-md border border-slate-200 bg-white p-3">
          {cover(p)}<div className="min-w-0 flex-1"><p className="font-medium">{p.name} {expired(p) && <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs">종료됨</span>}</p>
            <p className="text-sm text-slate-600">{meta(p)}</p></div>
          <button type="button" disabled={busy || chosen.has(p.placeId) || selected.length >= 10} onClick={() => add(p.placeId)}
            className="shrink-0 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-500">
            {chosen.has(p.placeId) ? "선택됨" : "+ 추가"}</button></li>)}</ul>}
    </section>
  </div>;
}
