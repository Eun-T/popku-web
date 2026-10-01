import { NextResponse } from "next/server";
import { adminAccess, popupApiError, popupBackendRequest, type PopupListItem, type PopupSummary } from "@/lib/admin-popup-api";
import { backendUrl } from "@/lib/backend";

type PopupDetail = { tags: { id: number; name: string; category: string }[] };

class SessionExpired extends Error {}

const backendErrors: Record<string, string> = {
  "Invalid popup data": "입력값을 확인해 주세요.",
  "Invalid request body": "날짜와 숫자 형식을 확인해 주세요.",
  "Invalid regionId for countryCode": "선택한 지역이 국가와 일치하지 않습니다. 지역을 다시 선택해 주세요.",
  "Invalid tagIds": "선택한 태그가 유효하지 않습니다. 태그 목록을 새로고침해 주세요.",
  "Invalid popup references or values": "지역, 태그 또는 입력값을 확인해 주세요.",
};

export async function GET() {
  const access = await adminAccess();
  if (typeof access !== "string") return access;

  try {
    const response = await popupBackendRequest("/api/admin/popups", access);
    if (!response.ok) return popupApiError(response);
    const summaries = (await response.json()) as PopupSummary[];
    if (!Array.isArray(summaries)) throw new Error("Invalid popup list");

    // The backend list DTO has no tags; the detail DTO supplies them.
    const items: PopupListItem[] = await Promise.all(summaries.map(async (summary) => {
      const detailResponse = await popupBackendRequest(`/api/admin/popups/${summary.id}`, access);
      if (detailResponse.status === 401) throw new SessionExpired();
      if (!detailResponse.ok) throw new Error(`Popup detail failed: ${detailResponse.status}`);
      const detail = (await detailResponse.json()) as PopupDetail;
      return { ...summary, tags: detail.tags.map((tag) => tag.name) };
    }));
    return NextResponse.json(items);
  } catch (error) {
    if (error instanceof SessionExpired) {
      return NextResponse.json({ message: "관리자 세션이 만료되었습니다." }, { status: 401 });
    }
    return NextResponse.json({ message: "팝업 목록을 불러오지 못했습니다." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const access = await adminAccess();
  if (typeof access !== "string") return access;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "입력값을 확인해 주세요." }, { status: 400 });
  }

  try {
    const response = await fetch(backendUrl("/api/admin/popups"), {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (response.status === 401) return NextResponse.json({ message: "관리자 세션이 만료되었습니다." }, { status: 401 });
    if (response.status === 403) return NextResponse.json({ message: "관리자 권한이 필요합니다." }, { status: 403 });
    const result = await response.json() as { id?: number; message?: string };
    if (!response.ok) {
      return NextResponse.json({ message: backendErrors[result.message ?? ""] ?? "팝업을 등록하지 못했습니다. 입력값을 확인해 주세요." },
        { status: response.status >= 500 ? 502 : response.status });
    }
    if (response.status !== 201 || !Number.isSafeInteger(result.id) || (result.id ?? 0) <= 0) {
      return NextResponse.json({ message: "등록 응답을 확인하지 못했습니다. 목록에서 등록 여부를 확인해 주세요." }, { status: 502 });
    }
    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "팝업을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}
