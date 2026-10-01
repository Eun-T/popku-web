"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ACCEPTED_IMAGE_TYPES, MAX_COVER_IMAGES, MAX_CONTENT_IMAGES, popupImageErrorMessage, uploadPopupImage, validatePopupImageFiles } from "@/lib/admin/popup-image-upload";

type PopupImage = { id: number; imageType: "COVER" | "CONTENT"; sortOrder: number; previewUrl: string };
type Busy = "cover" | "content" | "order" | "delete" | null;

const errorMessage = popupImageErrorMessage;

function Preview({ image, className }: { image: PopupImage; className: string }) {
  // Private S3 preview URLs have a dynamic host and query string.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={image.previewUrl} alt={image.imageType === "COVER" ? "대표 이미지" : "팝업 소개 이미지"} className={className} />;
}

export default function PopupImages({ placeId }: { placeId: string }) {
  const [name, setName] = useState("");
  const [images, setImages] = useState<PopupImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadFailures, setUploadFailures] = useState<string[]>([]);
  const [busy, setBusy] = useState<Busy>(null);
  const busyRef = useRef(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const contentInput = useRef<HTMLInputElement>(null);
  const base = `/admin/api/popups/${placeId}`;

  useEffect(() => {
    const key = `popup-image-upload-failures:${placeId}`;
    const saved = sessionStorage.getItem(key);
    if (!saved) return;
    let active = true;
    try {
      const messages = JSON.parse(saved) as unknown;
      queueMicrotask(() => {
        if (!active) return;
        if (Array.isArray(messages)) setUploadFailures(messages.filter((item): item is string => typeof item === "string"));
        sessionStorage.removeItem(key);
      });
    } catch { /* Invalid one-time notice. */ }
    return () => { active = false; };
  }, [placeId]);

  const refreshImages = useCallback(async () => {
    const response = await fetch(`${base}/images`, { cache: "no-store" });
    if (!response.ok) throw new Error(await errorMessage(response, "이미지 목록을 불러오지 못했습니다."));
    setImages(await response.json() as PopupImage[]);
  }, [base]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [detailResponse, imageResponse] = await Promise.all([
          fetch(base, { cache: "no-store" }), fetch(`${base}/images`, { cache: "no-store" }),
        ]);
        if (!detailResponse.ok) throw new Error(await errorMessage(detailResponse, "팝업 정보를 불러오지 못했습니다."));
        if (!imageResponse.ok) throw new Error(await errorMessage(imageResponse, "이미지 목록을 불러오지 못했습니다."));
        const detail = await detailResponse.json() as { place: { name: string } };
        const imageList = await imageResponse.json() as PopupImage[];
        if (active) { setName(detail.place.name); setImages(imageList); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "이미지 정보를 불러오지 못했습니다.");
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [base]);

  const cover = images.find((image) => image.imageType === "COVER");
  const contents = images.filter((image) => image.imageType === "CONTENT").sort((a, b) => a.sortOrder - b.sortOrder);

  async function uploadFiles(files: File[], imageType: "COVER" | "CONTENT") {
    if (busyRef.current || files.length === 0) return;
    setError("");
    const validationError = validatePopupImageFiles(files, imageType, contents.length);
    if (validationError) { setError(validationError); return; }
    busyRef.current = true;
    setBusy(imageType === "COVER" ? "cover" : "content");
    let uploaded = 0;
    try {
      for (const file of files) { await uploadPopupImage(placeId, file, imageType); uploaded++; }
    } catch (cause) {
      setError(`${uploaded + 1}번째 파일: ${cause instanceof Error ? cause.message : "업로드에 실패했습니다."}`);
    } finally {
      try { await refreshImages(); }
      catch (cause) { setError((previous) => `${previous ? `${previous} ` : ""}${cause instanceof Error ? cause.message : "이미지 목록을 다시 불러오지 못했습니다."}`); }
      busyRef.current = false; setBusy(null);
    }
  }

  async function remove(image: PopupImage) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy("delete"); setError("");
    try {
      const response = await fetch(`${base}/images/${image.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await errorMessage(response, "이미지를 삭제하지 못했습니다."));
      await refreshImages();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "이미지를 삭제하지 못했습니다."); }
    finally { busyRef.current = false; setBusy(null); }
  }

  async function move(index: number, offset: number) {
    if (busyRef.current) return;
    const ordered = [...contents];
    const target = index + offset;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    busyRef.current = true; setBusy("order"); setError("");
    try {
      const response = await fetch(`${base}/images/order`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: ordered.map((image) => image.id) }),
      });
      if (!response.ok) throw new Error(await errorMessage(response, "순서를 저장하지 못했습니다."));
      await refreshImages();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "순서를 저장하지 못했습니다."); }
    finally { busyRef.current = false; setBusy(null); }
  }

  function onDrop(event: React.DragEvent<HTMLElement>, imageType: "COVER" | "CONTENT") {
    event.preventDefault();
    void uploadFiles(Array.from(event.dataTransfer.files), imageType);
  }

  return <section className="max-w-4xl">
    <Link href="/admin/popups" className="text-sm font-medium text-blue-700 hover:underline">← 팝업 목록</Link>
    <h1 className="mt-4 text-2xl font-semibold tracking-tight">{name ? `${name} · ` : ""}이미지 관리</h1>
    <p className="mt-2 text-sm text-slate-600">JPEG, PNG, WEBP 파일을 선택하거나 영역에 끌어다 놓으세요.</p>
    {uploadFailures.length > 0 && <div role="alert" className="mt-5 rounded-md bg-red-50 p-3 text-sm text-red-700">
      <p>팝업은 등록되었습니다. 다음 이미지는 등록에 실패했습니다. 성공한 이미지는 이미 목록에 있으니 실패한 파일만 다시 선택해 주세요.</p>
      <ul className="mt-2 list-disc pl-5">{uploadFailures.map((message, index) => <li key={index}>{message}</li>)}</ul>
    </div>}
    {error && <p role="alert" className="mt-5 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading ? <p role="status" className="mt-8 text-sm text-slate-600">이미지를 불러오는 중입니다.</p> : <>
      <section className="mt-8 rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">대표 이미지</h2>
        <p className="mt-1 text-sm text-slate-600">최대 {MAX_COVER_IMAGES}장</p>
        <input ref={coverInput} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden"
          onChange={(event) => { void uploadFiles(Array.from(event.target.files ?? []), "COVER"); event.target.value = ""; }} />
        <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, "COVER")}
          onClick={() => { if (!busyRef.current) coverInput.current?.click(); }}
          className="mt-4 flex min-h-64 flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center">
          {cover && <Preview image={cover} className="max-h-80 w-full rounded object-contain" />}
          {!cover && <p className="text-sm text-slate-600">대표 이미지 업로드 · 파일을 끌어다 놓으세요</p>}
          <div className="mt-4 flex gap-3">
            <button type="button" disabled={busy !== null} onClick={(event) => { event.stopPropagation(); coverInput.current?.click(); }}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
              {busy === "cover" ? "업로드 중..." : cover ? "이미지 교체" : "대표 이미지 업로드"}
            </button>
            {cover && <button type="button" disabled={busy !== null} onClick={(event) => { event.stopPropagation(); void remove(cover); }}
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">이미지 삭제</button>}
          </div>
        </div>
      </section>
      <section className="mt-8 rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">팝업 소개 이미지 ({contents.length}/{MAX_CONTENT_IMAGES})</h2>
        <input ref={contentInput} type="file" multiple accept={ACCEPTED_IMAGE_TYPES} className="hidden"
          onChange={(event) => { void uploadFiles(Array.from(event.target.files ?? []), "CONTENT"); event.target.value = ""; }} />
        <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, "CONTENT")}
          onClick={() => { if (!busyRef.current && contents.length < MAX_CONTENT_IMAGES) contentInput.current?.click(); }}
          className="mt-4 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center">
          <p className="text-sm text-slate-600">여러 이미지를 선택하거나 여기에 끌어다 놓으세요.</p>
          <button type="button" disabled={busy !== null || contents.length >= MAX_CONTENT_IMAGES}
            onClick={(event) => { event.stopPropagation(); contentInput.current?.click(); }}
            className="mt-3 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
            {busy === "content" ? "업로드 중..." : "이미지 추가"}
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contents.map((image, index) => <div key={image.id} className="rounded-md border border-slate-200 p-3">
            <Preview image={image} className="h-40 w-full rounded bg-slate-50 object-contain" />
            <p className="mt-2 text-xs text-slate-600">순서 {index + 1}</p>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <button type="button" disabled={busy !== null || index === 0} onClick={() => void move(index, -1)} className="font-medium text-blue-700 hover:underline disabled:opacity-40">앞으로</button>
              <button type="button" disabled={busy !== null || index === contents.length - 1} onClick={() => void move(index, 1)} className="font-medium text-blue-700 hover:underline disabled:opacity-40">뒤로</button>
              <button type="button" disabled={busy !== null} onClick={() => void remove(image)} className="ml-auto font-medium text-red-700 hover:underline disabled:opacity-40">삭제</button>
            </div>
          </div>)}
        </div>
        {busy === "order" && <p role="status" className="mt-3 text-sm text-slate-600">순서를 저장하는 중입니다.</p>}
        {busy === "delete" && <p role="status" className="mt-3 text-sm text-slate-600">이미지를 삭제하는 중입니다.</p>}
      </section>
    </>}
  </section>;
}
