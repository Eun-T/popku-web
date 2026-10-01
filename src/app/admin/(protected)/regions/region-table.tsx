"use client";

import { useEffect, useState, type FormEvent } from "react";

type Region = { id: number; countryCode: string; name: string; parentId: number | null; level: string; sortOrder: number };
type Editor = { kind: "add" } | { kind: "edit"; id: number } | null;
const countries = [{ code: "KR", label: "한국" }, { code: "JP", label: "일본" }] as const;

function handleExpired(status: number) {
  if (status !== 401) return false;
  window.location.assign("/admin/session/refresh");
  return true;
}

async function errorMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message || fallback;
  } catch { return fallback; }
}

export default function RegionTable() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [countryCode, setCountryCode] = useState<"KR" | "JP">("KR");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/admin/api/regions", { signal: controller.signal, cache: "no-store" });
        if (handleExpired(response.status)) return;
        if (!response.ok) throw new Error(await errorMessage(response, "지역 목록을 불러오지 못했습니다."));
        const items = (await response.json()) as Region[];
        if (!controller.signal.aborted) setRegions(items);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "지역 목록을 불러오지 못했습니다.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  function startAdd() {
    setError(""); setCountryCode("KR"); setName(""); setEditor({ kind: "add" });
  }

  function startEdit(region: Region) {
    setError(""); setCountryCode(region.countryCode === "JP" ? "JP" : "KR");
    setName(region.name); setEditor({ kind: "edit", id: region.id });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) { setError("지역명을 1~100자로 입력해 주세요."); return; }
    setError(""); setBusy(true);
    try {
      const editingId = editor.kind === "edit" ? editor.id : null;
      const response = await fetch(editingId === null ? "/admin/api/regions" : `/admin/api/regions/${editingId}`, {
        method: editingId === null ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode, name: trimmed }),
      });
      if (handleExpired(response.status)) return;
      if (!response.ok) throw new Error(await errorMessage(response, "지역을 저장하지 못했습니다."));
      const saved = (await response.json()) as Region;
      setRegions((current) => editingId === null ? [...current, saved] : current.map((item) => item.id === editingId ? saved : item));
      setEditor(null); setName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "지역을 저장하지 못했습니다.");
    } finally { setBusy(false); }
  }

  async function remove(region: Region) {
    if (!window.confirm(`'${region.name}' 지역을 삭제하시겠습니까?`)) return;
    setError(""); setBusy(true);
    try {
      const response = await fetch(`/admin/api/regions/${region.id}`, { method: "DELETE" });
      if (handleExpired(response.status)) return;
      if (!response.ok) throw new Error(await errorMessage(response, "지역을 삭제하지 못했습니다."));
      setRegions((current) => current.filter((item) => item.id !== region.id));
      if (editor?.kind === "edit" && editor.id === region.id) setEditor(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "지역을 삭제하지 못했습니다.");
    } finally { setBusy(false); }
  }

  return <section>
    <div>
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">지역 관리</h1>
        <button type="button" onClick={startAdd} disabled={busy}
          className="shrink-0 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">+ 지역 추가</button>
      </div>
      <p className="mt-2 text-sm text-slate-600">팝업에 사용할 지역을 관리합니다.</p>
    </div>

    {editor && <form onSubmit={(event) => void save(event)} className="mt-6 flex flex-wrap items-end gap-4 border-y border-slate-200 bg-white p-4">
      <fieldset>
        <legend className="mb-1 text-sm font-medium">국가</legend>
        <div className="flex gap-2">{countries.map(({ code, label }) => <label key={code}
          className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${countryCode === code ? "border-blue-700 bg-blue-50 text-blue-800" : "border-slate-300"}`}>
          <input type="radio" name="country" value={code} checked={countryCode === code}
            onChange={() => setCountryCode(code)} disabled={busy} className="sr-only" />{label}
        </label>)}</div>
      </fieldset>
      <div>
        <label htmlFor="region-name" className="mb-1 block text-sm font-medium">지역명</label>
        <input id="region-name" autoFocus required maxLength={100} value={name} onChange={(event) => setName(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <button type="button" disabled={busy} onClick={() => setEditor(null)} className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">취소</button>
      <button type="submit" disabled={busy} className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "저장 중..." : editor.kind === "add" ? "추가" : "수정"}
      </button>
    </form>}

    {error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}
    {loading ? <p role="status" className="mt-8 text-sm text-slate-600">지역 목록을 불러오는 중입니다.</p> :
      countries.map(({ code, label }) => {
        const items = regions.filter((region) => region.countryCode === code);
        return <div key={code} className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">{label}</h2>
          {items.length === 0 ? <p className="rounded-md border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600">등록된 지역이 없습니다.</p> :
            <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50"><tr>
                  <th scope="col" className="border-b border-slate-200 px-4 py-3">ID</th>
                  <th scope="col" className="border-b border-slate-200 px-4 py-3">지역명</th>
                  <th scope="col" className="border-b border-slate-200 px-4 py-3">관리</th>
                </tr></thead>
                <tbody>{items.map((region) => <tr key={region.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-4 py-3 text-slate-600">{region.id}</td>
                  <td className="px-4 py-3">{region.name}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <button type="button" disabled={busy} onClick={() => startEdit(region)} className="font-medium text-blue-700 hover:underline disabled:opacity-50">수정</button>
                    <button type="button" disabled={busy} onClick={() => void remove(region)} className="ml-4 font-medium text-red-700 hover:underline disabled:opacity-50">삭제</button>
                  </td>
                </tr>)}</tbody>
              </table>
            </div>}
        </div>;
      })}
  </section>;
}
