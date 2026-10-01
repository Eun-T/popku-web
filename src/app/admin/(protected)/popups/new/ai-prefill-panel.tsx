"use client";

import { useEffect, useRef, useState } from "react";

export type AiResult = {
  name: string | null;
  countryCode: "KR" | "JP" | null;
  placeName: string | null;
  address: string | null;
  locationDetail: string | null;
  startDate: string | null;
  endDate: string | null;
  operatingHours: string | null;
  reservationStartAt: string | null;
  reservationEndAt: string | null;
  reservationUrl: string | null;
  benefits: string | null;
  notice: string | null;
  introduction: string | null;
  suggestedTagIds: number[];
  latitude: number | null;
  longitude: number | null;
  regionId: number | null;
};
type Tag = { id: number; name: string };
type SelectedImage = { id: number; file: File; url: string };
const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function AiPrefillPanel({ onAnalyzed }: { onAnalyzed: (result: AiResult) => void }) {
  const [notice, setNotice] = useState("");
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [result, setResult] = useState<AiResult | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const inFlight = useRef(false);
  const editVersion = useRef(0);
  const nextImageId = useRef(0);
  const objectUrls = useRef(new Set<string>());

  useEffect(() => {
    const urls = objectUrls.current;
    return () => { for (const url of urls) URL.revokeObjectURL(url); urls.clear(); };
  }, []);

  function addImages(files: FileList | null) {
    if (!files?.length || busy) return;
    const chosen = Array.from(files);
    if (images.length + chosen.length > MAX_IMAGES) {
      setError("공지 이미지는 최대 5장까지 선택할 수 있습니다.");
      return;
    }
    if (chosen.some((file) => !IMAGE_TYPES.has(file.type) || file.size === 0 || file.size > MAX_IMAGE_BYTES)) {
      setError("JPEG, PNG, WEBP 이미지만 선택할 수 있으며 각 10MB 이하여야 합니다.");
      return;
    }
    const added = chosen.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrls.current.add(url);
      return { id: nextImageId.current++, file, url };
    });
    editVersion.current += 1;
    setImages((current) => [...current, ...added]);
    setResult(null);
    setError("");
  }

  function removeImage(id: number) {
    if (busy) return;
    const removed = images.find((image) => image.id === id);
    if (!removed) return;
    URL.revokeObjectURL(removed.url);
    objectUrls.current.delete(removed.url);
    editVersion.current += 1;
    setImages((current) => current.filter((image) => image.id !== id));
    setResult(null);
    setError("");
  }

  async function analyze() {
    const text = notice.trim();
    if ((!text && images.length === 0) || text.length > 10000 || inFlight.current) return;
    inFlight.current = true;
    const version = editVersion.current;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const body = new FormData();
      if (text) body.append("text", text);
      for (const image of images) body.append("images", image.file);
      const response = await fetch("/admin/api/popups/ai-extract", {
        method: "POST", body,
      });
      if (response.status === 401) { window.location.assign("/admin/session/refresh"); return; }
      if (!response.ok) {
        let message = "AI 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.";
        try { message = (await response.json() as { message?: string }).message || message; } catch { /* Keep safe message. */ }
        throw new Error(message);
      }
      const extracted = await response.json() as AiResult;
      if (version !== editVersion.current) return;
      setResult(extracted);
      onAnalyzed(extracted);
      try {
        const tagResponse = await fetch("/admin/api/tags", { cache: "no-store" });
        if (tagResponse.status === 401) { window.location.assign("/admin/session/refresh"); return; }
        if (tagResponse.ok) {
          const listed = await tagResponse.json() as Tag[];
          if (Array.isArray(listed)) setTags(listed);
        }
      } catch { /* Keep the extraction result if tag labels cannot load. */ }
    } catch (cause) {
      if (version === editVersion.current) {
        setError(cause instanceof Error ? cause.message : "AI 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const show = (value: string | null) => value || "확인 필요";
  const country = result?.countryCode === "KR" ? "한국" : result?.countryCode === "JP" ? "일본" : "확인 필요";
  const suggested = result?.suggestedTagIds.map((id) => tags.find((tag) => tag.id === id)?.name || `ID ${id}`).join(", ") || "확인 필요";

  return <section aria-labelledby="ai-prefill-heading" className="mt-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm md:p-6">
    <h2 id="ai-prefill-heading" className="text-base font-semibold">AI로 팝업 정보 채우기</h2>
    <p className="mt-2 text-sm text-slate-600">팝업 공지 내용을 분석해 등록 전에 확인할 정보를 보여줍니다.</p>
    <div className="mt-5">
      <label htmlFor="ai-popup-notice" className="block text-sm font-medium text-slate-800">공지 텍스트 (선택)</label>
      <textarea id="ai-popup-notice" rows={6} maxLength={10000} value={notice} disabled={busy} onChange={(event) => {
        editVersion.current += 1; setNotice(event.target.value); setResult(null); setError("");
      }} placeholder="예: 원피스 팝업스토어&#10;2026년 10월 1일부터 10월 15일까지&#10;더현대 서울 B2F에서 진행됩니다."
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600" />
      <p className="mt-1 text-right text-xs text-slate-500">{notice.length}/10000</p>
    </div>
    <div>
      <label htmlFor="ai-popup-images" className="block text-sm font-medium text-slate-800">공지 이미지 (선택)</label>
      <input id="ai-popup-images" type="file" accept="image/jpeg,image/png,image/webp" multiple
        disabled={busy || images.length >= MAX_IMAGES}
        onChange={(event) => { addImages(event.target.files); event.target.value = ""; }}
        className="sr-only" />
      <label htmlFor="ai-popup-images"
        onDragEnter={(event) => { event.preventDefault(); dragDepth.current += 1; if (!busy) setDragging(true); }}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = busy ? "none" : "copy"; }}
        onDragLeave={(event) => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); dragDepth.current = 0; setDragging(false); addImages(event.dataTransfer.files); }}
        className={`mt-2 flex h-32 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-4 text-center text-sm focus-within:ring-2 focus-within:ring-blue-600 ${dragging ? "border-blue-600 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-400"} ${busy || images.length >= MAX_IMAGES ? "cursor-not-allowed opacity-60" : ""}`}>
        <span className="font-semibold text-slate-800">이미지 추가</span>
        <span className="mt-1 text-slate-600">클릭하거나 이미지를 여기로 드래그</span>
        <span className="mt-2 text-xs text-slate-500">JPEG · PNG · WEBP / 최대 5장</span>
      </label>
      <p className="mt-1 text-xs text-slate-500">JPEG, PNG, WEBP · 각 10MB 이하 · {images.length}/5장{images.length === MAX_IMAGES ? " (최대 개수)" : ""}</p>
      {images.length > 0 && <ul className="mt-3 flex flex-wrap gap-3">{images.map((image) =>
        <li key={image.id} className="w-28 rounded-md border border-slate-200 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt={image.file.name} className="h-24 w-full rounded object-cover" />
          <p className="mt-1 truncate text-xs" title={image.file.name}>{image.file.name}</p>
          <button type="button" disabled={busy} onClick={() => removeImage(image.id)}
            aria-label={`${image.file.name} 삭제`} className="mt-1 text-xs text-red-700 disabled:opacity-50">삭제</button>
        </li>)}</ul>}
    </div>
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    <div className="mt-5 flex justify-end">
      <button type="button" disabled={(!notice.trim() && images.length === 0) || busy} onClick={() => void analyze()}
        className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? "분석 중..." : "정보 분석하기"}</button>
    </div>
    {result && <div aria-live="polite" className="mt-6 border-t border-slate-200 pt-5">
      <h3 className="text-base font-semibold">분석 결과</h3>
      <dl className="mt-3 grid gap-x-5 gap-y-3 text-sm md:grid-cols-[110px_1fr]">
        <dt className="font-medium text-slate-600">팝업명</dt><dd>{show(result.name)}</dd>
        <dt className="font-medium text-slate-600">국가</dt><dd>{country}</dd>
        <dt className="font-medium text-slate-600">장소</dt><dd>{show(result.placeName)}</dd>
        <dt className="font-medium text-slate-600">주소</dt><dd>{show(result.address)}</dd>
        <dt className="font-medium text-slate-600">상세 위치</dt><dd>{show(result.locationDetail)}</dd>
        <dt className="font-medium text-slate-600">기간</dt><dd>{show(result.startDate)} ~ {show(result.endDate)}</dd>
        <dt className="font-medium text-slate-600">추천 태그</dt><dd>{suggested}</dd>
      </dl>
    </div>}
  </section>;
}
