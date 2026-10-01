"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { ACCEPTED_IMAGE_TYPES, MAX_CONTENT_IMAGES, validatePopupImageFiles } from "@/lib/admin/popup-image-upload";

type PendingImage = { id: number; file: File; previewUrl: string };
export type PendingPopupImageFiles = { cover: File | null; contents: File[] };

export default function PendingPopupImages({ disabled, onChange }: { disabled: boolean; onChange: (files: PendingPopupImageFiles) => void }) {
  const [cover, setCover] = useState<PendingImage | null>(null);
  const [contents, setContents] = useState<PendingImage[]>([]);
  const [error, setError] = useState("");
  const coverInput = useRef<HTMLInputElement>(null);
  const contentInput = useRef<HTMLInputElement>(null);
  const current = useRef<{ cover: PendingImage | null; contents: PendingImage[] }>({ cover: null, contents: [] });
  const nextId = useRef(0);

  useEffect(() => () => {
    if (current.current.cover) URL.revokeObjectURL(current.current.cover.previewUrl);
    current.current.contents.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  }, []);

  function update(nextCover: PendingImage | null, nextContents: PendingImage[]) {
    current.current = { cover: nextCover, contents: nextContents };
    setCover(nextCover);
    setContents(nextContents);
    onChange({ cover: nextCover?.file ?? null, contents: nextContents.map((image) => image.file) });
  }

  function add(files: File[], imageType: "COVER" | "CONTENT") {
    if (disabled || files.length === 0) return;
    const validation = validatePopupImageFiles(files, imageType, current.current.contents.length);
    if (validation) { setError(validation); return; }
    setError("");
    const images = files.map((file) => ({ id: ++nextId.current, file, previewUrl: URL.createObjectURL(file) }));
    if (imageType === "COVER") {
      if (current.current.cover) URL.revokeObjectURL(current.current.cover.previewUrl);
      update(images[0], current.current.contents);
    } else update(current.current.cover, [...current.current.contents, ...images]);
  }

  function removeCover() {
    if (disabled) return;
    if (current.current.cover) URL.revokeObjectURL(current.current.cover.previewUrl);
    update(null, current.current.contents);
  }

  function removeContent(id: number) {
    if (disabled) return;
    const image = current.current.contents.find((item) => item.id === id);
    if (image) URL.revokeObjectURL(image.previewUrl);
    update(current.current.cover, current.current.contents.filter((item) => item.id !== id));
  }

  function move(index: number, offset: number) {
    if (disabled) return;
    const ordered = [...current.current.contents];
    const target = index + offset;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    update(current.current.cover, ordered);
  }

  function drop(event: DragEvent<HTMLElement>, imageType: "COVER" | "CONTENT") {
    event.preventDefault();
    add(Array.from(event.dataTransfer.files), imageType);
  }

  return <fieldset className="mt-6 border-t border-slate-200 pt-5">
    <legend className="text-base font-semibold">이미지</legend>
    <p className="mt-2 text-sm text-slate-600">JPEG, PNG, WEBP 파일을 선택하거나 영역에 끌어다 놓으세요. 등록 전에는 브라우저에서만 미리 봅니다.</p>
    {error && <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <section className="mt-5 rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">대표 이미지</h2>
      <p className="mt-1 text-sm text-slate-600">최대 1장</p>
      <input ref={coverInput} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={(event) => { add(Array.from(event.target.files ?? []), "COVER"); event.target.value = ""; }} />
      <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, "COVER")}
        onClick={() => { if (!disabled) coverInput.current?.click(); }}
        className="mt-4 flex min-h-64 flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {cover ? <img src={cover.previewUrl} alt="대표 이미지 미리보기" className="max-h-80 w-full rounded object-contain" /> : <p className="text-sm text-slate-600">대표 이미지를 선택하거나 파일을 끌어다 놓으세요</p>}
        <div className="mt-4 flex gap-3">
          <button type="button" disabled={disabled} onClick={(event) => { event.stopPropagation(); coverInput.current?.click(); }} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{cover ? "이미지 교체" : "대표 이미지 선택"}</button>
          {cover && <button type="button" disabled={disabled} onClick={(event) => { event.stopPropagation(); removeCover(); }} className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">선택 취소</button>}
        </div>
      </div>
    </section>
    <section className="mt-8 rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">팝업 소개 이미지 ({contents.length}/{MAX_CONTENT_IMAGES})</h2>
      <input ref={contentInput} type="file" multiple accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={(event) => { add(Array.from(event.target.files ?? []), "CONTENT"); event.target.value = ""; }} />
      <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, "CONTENT")}
        onClick={() => { if (!disabled && contents.length < MAX_CONTENT_IMAGES) contentInput.current?.click(); }}
        className="mt-4 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center">
        <p className="text-sm text-slate-600">여러 이미지를 선택하거나 여기에 끌어다 놓으세요.</p>
        <button type="button" disabled={disabled || contents.length >= MAX_CONTENT_IMAGES} onClick={(event) => { event.stopPropagation(); contentInput.current?.click(); }} className="mt-3 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">이미지 추가</button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {contents.map((image, index) => <div key={image.id} className="rounded-md border border-slate-200 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.previewUrl} alt={`팝업 소개 이미지 ${index + 1} 미리보기`} className="h-40 w-full rounded bg-slate-50 object-contain" />
          <p className="mt-2 truncate text-xs text-slate-600">순서 {index + 1} · {image.file.name}</p>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <button type="button" disabled={disabled || index === 0} onClick={() => move(index, -1)} className="font-medium text-blue-700 hover:underline disabled:opacity-40">앞으로</button>
            <button type="button" disabled={disabled || index === contents.length - 1} onClick={() => move(index, 1)} className="font-medium text-blue-700 hover:underline disabled:opacity-40">뒤로</button>
            <button type="button" disabled={disabled} onClick={() => removeContent(image.id)} className="ml-auto font-medium text-red-700 hover:underline disabled:opacity-40">삭제</button>
          </div>
        </div>)}
      </div>
    </section>
  </fieldset>;
}
