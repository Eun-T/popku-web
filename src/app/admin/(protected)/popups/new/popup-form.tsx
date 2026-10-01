"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AiResult } from "./ai-prefill-panel";
import PendingPopupImages, { type PendingPopupImageFiles } from "./pending-popup-images";
import { uploadPopupImage } from "@/lib/admin/popup-image-upload";

type CountryCode = "KR" | "JP";
type Region = { id: number; countryCode: string; name: string };
type Tag = { id: number; name: string };
export type PopupDetail = {
  place: {
    id: number; name: string; countryCode: CountryCode; regionId: number | null;
    address: string; locationDetail: string | null; latitude: number | string; longitude: number | string;
  };
  popup: {
    startDate: string | null; endDate: string | null;
    operatingHours: string | null; reservationStartAt: string | null; reservationEndAt: string | null;
    reservationUrl: string | null; notice: string | null; benefits: string | null;
    introduction: string | null; socialLinks: unknown;
  };
  tags: { id: number }[];
};

type EditPopup = { placeId: string; detail: PopupDetail };

const fieldClass = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";
const labelClass = "block text-sm font-medium text-slate-800";

async function responseMessage(response: Response, fallback: string) {
  try {
    const body = await response.json() as { message?: string };
    return body.message || fallback;
  } catch {
    return fallback;
  }
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function coordinate(value: string, min: number, max: number, label: string) {
  const trimmed = value.trim();
  if (!/^-?\d+(?:\.\d{1,15})?$/.test(trimmed)) throw new Error(`${label}를 소수점 15자리 이하의 숫자로 입력해 주세요.`);
  const number = Number(trimmed);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${label}는 ${min}~${max} 범위로 입력해 주세요.`);
  return number;
}

function optionalText(value: string) {
  return value.trim() || null;
}

function combinedLocationDetail(placeName: string | null, locationDetail: string | null) {
  const name = placeName?.trim() ?? "";
  const detail = locationDetail?.trim() ?? "";
  if (!name) return detail;
  if (!detail) return name;
  const normalizedName = name.replace(/\s+/g, " ").toLocaleLowerCase();
  const normalizedDetail = detail.replace(/\s+/g, " ").toLocaleLowerCase();
  return normalizedDetail.startsWith(normalizedName) ? detail : `${name} ${detail}`;
}

function localDateTimeInput(value: string | null | undefined) {
  return value?.slice(0, 16) ?? "";
}

export default function PopupForm({ prefill, edit }: { prefill: AiResult | null; edit?: EditPopup }) {
  const router = useRouter();
  const [regions, setRegions] = useState<Region[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(edit?.detail.place.name ?? "");
  const [countryCode, setCountryCode] = useState<CountryCode>(edit?.detail.place.countryCode ?? "KR");
  const [regionId, setRegionId] = useState(edit?.detail.place.regionId == null ? "" : String(edit.detail.place.regionId));
  const [address, setAddress] = useState(edit?.detail.place.address ?? "");
  const [latitude, setLatitude] = useState(edit ? String(edit.detail.place.latitude) : "");
  const [longitude, setLongitude] = useState(edit ? String(edit.detail.place.longitude) : "");
  const [locationDetail, setLocationDetail] = useState(edit?.detail.place.locationDetail ?? "");
  const [startDate, setStartDate] = useState(edit?.detail.popup.startDate ?? "");
  const [endDate, setEndDate] = useState(edit?.detail.popup.endDate ?? "");
  const [operatingHours, setOperatingHours] = useState(edit?.detail.popup.operatingHours ?? "");
  const [reservationStartAt, setReservationStartAt] = useState(localDateTimeInput(edit?.detail.popup.reservationStartAt));
  const [reservationEndAt, setReservationEndAt] = useState(localDateTimeInput(edit?.detail.popup.reservationEndAt));
  const [reservationUrl, setReservationUrl] = useState(edit?.detail.popup.reservationUrl ?? "");
  const [benefits, setBenefits] = useState(edit?.detail.popup.benefits ?? "");
  const [notice, setNotice] = useState(edit?.detail.popup.notice ?? "");
  const [introduction, setIntroduction] = useState(edit?.detail.popup.introduction ?? "");
  const [tagIds, setTagIds] = useState<number[]>(() => edit?.detail.tags.map((tag) => tag.id) ?? []);
  const appliedPrefill = useRef<AiResult | null>(null);
  const appliedTagPrefill = useRef<AiResult | null>(null);
  const appliedRegionPrefill = useRef<AiResult | null>(null);
  const selectedImages = useRef<PendingPopupImageFiles>({ cover: null, contents: [] });

  /* eslint-disable react-hooks/set-state-in-effect -- AI prefill updates the existing form state when analysis completes. */
  useEffect(() => {
    if (!prefill || appliedPrefill.current === prefill) return;
    appliedPrefill.current = prefill;
    if (prefill.name) setName(prefill.name);
    if (prefill.countryCode && prefill.countryCode !== countryCode) {
      setCountryCode(prefill.countryCode);
      setRegionId((current) => current && !regions.some((region) =>
        String(region.id) === current && region.countryCode === prefill.countryCode) ? "" : current);
    }
    if (prefill.address) setAddress(prefill.address);
    const nextLocationDetail = combinedLocationDetail(prefill.placeName, prefill.locationDetail);
    if (nextLocationDetail) setLocationDetail(nextLocationDetail);
    if (prefill.startDate) setStartDate(prefill.startDate);
    if (prefill.endDate) setEndDate(prefill.endDate);
    if (prefill.operatingHours) setOperatingHours(prefill.operatingHours);
    if (prefill.reservationStartAt) setReservationStartAt(localDateTimeInput(prefill.reservationStartAt));
    if (prefill.reservationEndAt) setReservationEndAt(localDateTimeInput(prefill.reservationEndAt));
    if (prefill.reservationUrl) setReservationUrl(prefill.reservationUrl);
    if (prefill.benefits) setBenefits(prefill.benefits);
    if (prefill.notice) setNotice(prefill.notice);
    if (prefill.introduction) setIntroduction(prefill.introduction);
    if (prefill.latitude != null) setLatitude(String(prefill.latitude));
    if (prefill.longitude != null) setLongitude(String(prefill.longitude));
  }, [prefill, countryCode, regions]);

  useEffect(() => {
    if (!prefill || loading || appliedRegionPrefill.current === prefill) return;
    appliedRegionPrefill.current = prefill;
    const targetRegionId = prefill.regionId;
    if (targetRegionId == null) return;
    const expectedCountry = prefill.countryCode ?? countryCode;
    if (regions.some((region) => region.id === targetRegionId && region.countryCode === expectedCountry)) {
      setRegionId(String(targetRegionId));
    }
  }, [prefill, loading, regions, countryCode]);

  useEffect(() => {
    if (!prefill || loading || appliedTagPrefill.current === prefill) return;
    appliedTagPrefill.current = prefill;
    setTagIds([...new Set(prefill.suggestedTagIds.filter((id) => tags.some((tag) => tag.id === id)))]);
  }, [prefill, loading, tags]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [regionResponse, tagResponse] = await Promise.all([
          fetch("/admin/api/regions", { signal: controller.signal, cache: "no-store" }),
          fetch("/admin/api/tags", { signal: controller.signal, cache: "no-store" }),
        ]);
        if (regionResponse.status === 401 || tagResponse.status === 401) {
          window.location.assign("/admin/session/refresh");
          return;
        }
        if (!regionResponse.ok) throw new Error(await responseMessage(regionResponse, "지역 목록을 불러오지 못했습니다."));
        if (!tagResponse.ok) throw new Error(await responseMessage(tagResponse, "태그 목록을 불러오지 못했습니다."));
        const regionItems = await regionResponse.json() as Region[];
        const tagItems = await tagResponse.json() as Tag[];
        if (!Array.isArray(regionItems) || !Array.isArray(tagItems)) throw new Error("지역 또는 태그 목록 형식이 올바르지 않습니다.");
        if (!controller.signal.aborted) { setRegions(regionItems); setTags(tagItems); }
      } catch (cause) {
        if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : "지역과 태그를 불러오지 못했습니다.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  function changeCountry(next: CountryCode) {
    setCountryCode(next);
    if (regionId && !regions.some((region) => String(region.id) === regionId && region.countryCode === next)) setRegionId("");
  }

  function toggleTag(id: number) {
    setTagIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loading || loadError) return;
    setError("");
    let body: object;
    try {
      const trimmedName = name.trim();
      if (!trimmedName || trimmedName.length > 150) throw new Error("팝업명을 1~150자로 입력해 주세요.");
      const trimmedAddress = address.trim();
      if (!trimmedAddress || trimmedAddress.length > 255) throw new Error("주소를 1~255자로 입력해 주세요.");
      if (locationDetail.length > 255) throw new Error("상세 위치를 255자 이하로 입력해 주세요.");
      if (!countryCode) throw new Error("국가를 선택해 주세요.");
      if (regionId && !regions.some((region) => String(region.id) === regionId && region.countryCode === countryCode)) {
        throw new Error("선택한 지역이 국가와 일치하지 않습니다.");
      }
      if (startDate && !validDate(startDate) || endDate && !validDate(endDate)) throw new Error("날짜를 YYYY-MM-DD 형식으로 입력해 주세요.");
      if (startDate && endDate && endDate < startDate) throw new Error("종료일은 시작일보다 빠를 수 없습니다.");
      if (reservationUrl.length > 500) throw new Error("사전예약 URL을 500자 이하로 입력해 주세요.");
      body = {
        ...(edit ? { socialLinks: edit.detail.popup.socialLinks } : {}),
        name: trimmedName, countryCode, regionId: regionId ? Number(regionId) : null,
        address: trimmedAddress,
        locationDetail: locationDetail.trim() || null,
        latitude: coordinate(latitude, -90, 90, "위도"),
        longitude: coordinate(longitude, -180, 180, "경도"),
        startDate: startDate || null, endDate: endDate || null, tagIds,
        operatingHours: optionalText(operatingHours),
        reservationStartAt: reservationStartAt || null,
        reservationEndAt: reservationEndAt || null,
        reservationUrl: optionalText(reservationUrl),
        benefits: optionalText(benefits),
        notice: optionalText(notice),
        introduction: optionalText(introduction),
      };
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "입력값을 확인해 주세요.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(edit ? `/admin/api/popups/${edit.placeId}` : "/admin/api/popups", {
        method: edit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (response.status === 401) {
        window.location.assign("/admin/session/refresh");
        return;
      }
      if (edit) {
        if (!response.ok) throw new Error(await responseMessage(response, "팝업을 수정하지 못했습니다."));
        router.push("/admin/popups");
        return;
      }
      if (response.status !== 201) throw new Error(await responseMessage(response, "팝업을 등록하지 못했습니다."));
      const created = await response.json() as { id?: number };
      if (!Number.isSafeInteger(created.id) || (created.id ?? 0) <= 0) throw new Error("등록 응답을 확인하지 못했습니다. 목록에서 등록 여부를 확인해 주세요.");
      const placeId = created.id as number;
      const pending = selectedImages.current;
      const failures: string[] = [];
      if (pending.cover) {
        try { await uploadPopupImage(placeId, pending.cover, "COVER"); }
        catch (cause) { failures.push(`대표 이미지 (${pending.cover.name}): ${cause instanceof Error ? cause.message : "업로드 실패"}`); }
      }
      for (const [index, file] of pending.contents.entries()) {
        try { await uploadPopupImage(placeId, file, "CONTENT"); }
        catch (cause) { failures.push(`소개 이미지 ${index + 1} (${file.name}): ${cause instanceof Error ? cause.message : "업로드 실패"}`); }
      }
      if (failures.length) {
        sessionStorage.setItem(`popup-image-upload-failures:${placeId}`, JSON.stringify(failures));
        router.push(`/admin/popups/${placeId}/images`);
        return;
      }
      router.push("/admin/popups");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : edit ? "팝업을 수정하지 못했습니다." : "팝업을 등록하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const visibleRegions = regions.filter((region) => region.countryCode === countryCode);
  return <form onSubmit={(event) => void submit(event)} className="mt-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm md:p-6">
    <fieldset className="grid gap-4 md:grid-cols-2">
      <legend className="mb-4 text-base font-semibold">기본 정보</legend>
      <div className="md:col-span-2"><label htmlFor="popup-name" className={labelClass}>팝업명 <span className="text-red-700">*</span></label>
        <input id="popup-name" required maxLength={150} value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} /></div>
      <fieldset><legend className={labelClass}>국가 <span className="text-red-700">*</span></legend>
        <div className="mt-2 flex gap-2">{([ ["KR", "한국"], ["JP", "일본"] ] as const).map(([code, label]) =>
          <label key={code} className={`cursor-pointer rounded-md border px-4 py-2 text-sm ${countryCode === code ? "border-blue-700 bg-blue-50 text-blue-800" : "border-slate-300"}`}>
            <input type="radio" name="countryCode" value={code} checked={countryCode === code} onChange={() => changeCountry(code)} className="sr-only" />{label}
          </label>)}</div></fieldset>
      <div><label htmlFor="popup-region" className={labelClass}>지역</label>
        <select id="popup-region" value={regionId} onChange={(event) => setRegionId(event.target.value)} disabled={loading || !!loadError} className={fieldClass}>
          <option value="">지역 선택 (선택 사항)</option>
          {visibleRegions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
        </select></div>
      <div className="md:col-span-2"><label htmlFor="popup-address" className={labelClass}>주소 <span className="text-red-700">*</span></label>
        <input id="popup-address" required maxLength={255} placeholder="도로명 또는 지번 주소 입력" value={address}
          onChange={(event) => setAddress(event.target.value)} className={fieldClass} /></div>
      <div className="md:col-span-2"><label htmlFor="popup-location-detail" className={labelClass}>상세 위치</label>
        <input id="popup-location-detail" maxLength={255} placeholder="예: 아이파크몰 용산점 4F" value={locationDetail}
          onChange={(event) => setLocationDetail(event.target.value)} className={fieldClass} /></div>
    </fieldset>

    <fieldset className="mt-6 grid gap-4 border-t border-slate-200 pt-5 md:grid-cols-2">
      <legend className="text-base font-semibold">위치 정보</legend>
      <div><label htmlFor="popup-latitude" className={labelClass}>위도 <span className="text-red-700">*</span></label>
        <input id="popup-latitude" type="number" step="any" min={-90} max={90} required placeholder="예: 37.5258"
          value={latitude} onChange={(event) => setLatitude(event.target.value)} className={fieldClass} /></div>
      <div><label htmlFor="popup-longitude" className={labelClass}>경도 <span className="text-red-700">*</span></label>
        <input id="popup-longitude" type="number" step="any" min={-180} max={180} required placeholder="예: 126.9284"
          value={longitude} onChange={(event) => setLongitude(event.target.value)} className={fieldClass} /></div>
    </fieldset>

    <fieldset className="mt-6 grid gap-4 border-t border-slate-200 pt-5 md:grid-cols-2">
      <legend className="text-base font-semibold">운영 기간</legend>
      <div><label htmlFor="popup-start" className={labelClass}>시작일</label>
        <input id="popup-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={fieldClass} /></div>
      <div><label htmlFor="popup-end" className={labelClass}>종료일</label>
        <input id="popup-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={fieldClass} /></div>
    </fieldset>

    <fieldset className="mt-6 border-t border-slate-200 pt-5">
      <legend className="text-base font-semibold">운영 정보</legend>
      <div><label htmlFor="popup-operating-hours" className={labelClass}>운영시간</label>
        <textarea id="popup-operating-hours" rows={3} value={operatingHours} onChange={(event) => setOperatingHours(event.target.value)}
          className={fieldClass} placeholder={"월-금 10:30 ~ 20:00\n토-일 10:00 ~ 21:00"} /></div>
    </fieldset>

    <fieldset className="mt-6 grid gap-4 border-t border-slate-200 pt-5 md:grid-cols-2">
      <legend className="text-base font-semibold">사전예약</legend>
      <div><label htmlFor="popup-reservation-start" className={labelClass}>사전예약 시작일시</label>
        <input id="popup-reservation-start" type="datetime-local" value={reservationStartAt}
          onChange={(event) => setReservationStartAt(event.target.value)} className={fieldClass} /></div>
      <div><label htmlFor="popup-reservation-end" className={labelClass}>사전예약 종료일시</label>
        <input id="popup-reservation-end" type="datetime-local" value={reservationEndAt}
          onChange={(event) => setReservationEndAt(event.target.value)} className={fieldClass} /></div>
      <div className="md:col-span-2"><label htmlFor="popup-reservation-url" className={labelClass}>사전예약 URL</label>
        <input id="popup-reservation-url" maxLength={500} value={reservationUrl}
          onChange={(event) => setReservationUrl(event.target.value)} className={fieldClass} /></div>
    </fieldset>

    <fieldset className="mt-6 grid gap-4 border-t border-slate-200 pt-5 md:grid-cols-2">
      <legend className="text-base font-semibold">상세 정보</legend>
      <div className="md:col-span-2"><label htmlFor="popup-benefits" className={labelClass}>혜택</label>
        <textarea id="popup-benefits" rows={4} value={benefits} onChange={(event) => setBenefits(event.target.value)} className={fieldClass} /></div>
      <div className="md:col-span-2"><label htmlFor="popup-notice" className={labelClass}>공지사항</label>
        <textarea id="popup-notice" rows={4} value={notice} onChange={(event) => setNotice(event.target.value)} className={fieldClass} /></div>
      <div className="md:col-span-2"><label htmlFor="popup-introduction" className={labelClass}>팝업 소개</label>
        <textarea id="popup-introduction" rows={5} value={introduction} onChange={(event) => setIntroduction(event.target.value)} className={fieldClass} /></div>
    </fieldset>

    <fieldset className="mt-6 border-t border-slate-200 pt-5">
      <legend className="text-base font-semibold">태그</legend>
      {loading ? <p className="mt-3 text-sm text-slate-600">태그를 불러오는 중입니다.</p> :
        tags.length === 0 ? <p className="mt-3 text-sm text-slate-600">등록된 태그가 없습니다.</p> :
          <div className="mt-3 flex flex-wrap gap-2">{tags.map((tag) => <label key={tag.id}
            className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${tagIds.includes(tag.id) ? "border-blue-700 bg-blue-50 text-blue-800" : "border-slate-300"}`}>
            <input type="checkbox" checked={tagIds.includes(tag.id)} onChange={() => toggleTag(tag.id)} className="mr-2 align-middle" />{tag.name}
          </label>)}</div>}
    </fieldset>

    {!edit && <PendingPopupImages disabled={busy} onChange={(files) => { selectedImages.current = files; }} />}

    {loadError && <p role="alert" className="mt-5 text-sm text-red-700">{loadError}</p>}
    {error && <p role="alert" className="mt-5 text-sm text-red-700">{error}</p>}
    <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5">
      {edit && <Link href={`/admin/popups/${edit.placeId}/images`} className="mr-auto rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-slate-50">이미지 관리</Link>}
      <Link href="/admin/popups" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">취소</Link>
      <button type="submit" disabled={busy || loading || !!loadError} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-50">
        {busy ? edit ? "수정 중..." : "등록 중..." : edit ? "팝업 수정" : "팝업 등록"}
      </button>
    </div>
  </form>;
}
