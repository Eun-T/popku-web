"use client";

import { useEffect, useState, type FormEvent } from "react";

type Tag = { id: number; name: string; category: string };
type Editor = { kind: "add" } | { kind: "edit"; id: number } | null;

function handleExpired(status: number) {
  if (status !== 401) return false;
  window.location.assign("/admin/session/refresh");
  return true;
}

async function resultError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message || fallback;
  } catch {
    return fallback;
  }
}

export default function TagTable() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/admin/api/tags", { signal: controller.signal, cache: "no-store" });
        if (handleExpired(response.status)) return;
        if (!response.ok) throw new Error(await resultError(response, "태그 목록을 불러오지 못했습니다."));
        const items = (await response.json()) as Tag[];
        if (!controller.signal.aborted) setTags(items);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "태그 목록을 불러오지 못했습니다.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  function startAdd() {
    setError("");
    setName("");
    setEditor({ kind: "add" });
  }

  function startEdit(tag: Tag) {
    setError("");
    setName(tag.name);
    setEditor({ kind: "edit", id: tag.id });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 50) {
      setError("태그명을 1~50자로 입력해 주세요.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const editingId = editor.kind === "edit" ? editor.id : null;
      const response = await fetch(editingId === null ? "/admin/api/tags" : `/admin/api/tags/${editingId}`, {
        method: editingId === null ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (handleExpired(response.status)) return;
      if (!response.ok) throw new Error(await resultError(response, "태그를 저장하지 못했습니다."));
      const saved = (await response.json()) as Tag;
      setTags((current) => editingId === null
        ? [...current, saved]
        : current.map((tag) => tag.id === editingId ? saved : tag));
      setEditor(null);
      setName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "태그를 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(tag: Tag) {
    if (!window.confirm(`'${tag.name}' 태그를 삭제하시겠습니까?`)) return;
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`/admin/api/tags/${tag.id}`, { method: "DELETE" });
      if (handleExpired(response.status)) return;
      if (!response.ok) throw new Error(await resultError(response, "태그를 삭제하지 못했습니다."));
      setTags((current) => current.filter((item) => item.id !== tag.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "태그를 삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return <section>
    <div>
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">태그 관리</h1>
        <button type="button" onClick={startAdd} disabled={busy}
          className="shrink-0 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">+ 태그 추가</button>
      </div>
      <p className="mt-2 text-sm text-slate-600">팝업에 사용할 태그를 관리합니다.</p>
    </div>

    {editor && <form onSubmit={(event) => void save(event)} className="mt-6 flex items-end gap-3 border-y border-slate-200 bg-white p-4">
      <div>
        <label htmlFor="tag-name" className="mb-1 block text-sm font-medium">태그명</label>
        <input id="tag-name" autoFocus required maxLength={50} value={name} onChange={(event) => setName(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <button type="button" disabled={busy} onClick={() => setEditor(null)} className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">취소</button>
      <button type="submit" disabled={busy} className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "저장 중..." : editor.kind === "add" ? "추가" : "저장"}
      </button>
    </form>}

    {error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}
    <div className="mt-8">
      {loading ? <p role="status" className="text-sm text-slate-600">태그 목록을 불러오는 중입니다.</p> :
        !error && tags.length === 0 ? <p className="border-y border-slate-200 py-8 text-center text-sm text-slate-600">등록된 태그가 없습니다.</p> :
          tags.length > 0 && <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50"><tr>
                <th scope="col" className="border-b border-slate-200 px-4 py-3">태그 ID</th>
                <th scope="col" className="border-b border-slate-200 px-4 py-3">태그명</th>
                <th scope="col" className="border-b border-slate-200 px-4 py-3">관리</th>
              </tr></thead>
              <tbody>{tags.map((tag) => <tr key={tag.id} className="border-b border-slate-100 last:border-b-0">
                <td className="px-4 py-3 text-slate-600">{tag.id}</td>
                <td className="px-4 py-3">{tag.name}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <button type="button" disabled={busy} onClick={() => startEdit(tag)} className="font-medium text-blue-700 hover:underline disabled:opacity-50">수정</button>
                  <button type="button" disabled={busy} onClick={() => void remove(tag)} className="ml-4 font-medium text-red-700 hover:underline disabled:opacity-50">삭제</button>
                </td>
              </tr>)}</tbody>
            </table>
          </div>}
    </div>
  </section>;
}
