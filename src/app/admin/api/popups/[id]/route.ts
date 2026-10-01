import { NextResponse } from "next/server";
import { adminAccess, popupApiError, popupBackendRequest } from "@/lib/admin-popup-api";
import { backendUrl } from "@/lib/backend";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await adminAccess();
  if (typeof access !== "string") return access;
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) return NextResponse.json({ message: "올바르지 않은 팝업 ID입니다." }, { status: 400 });
  try {
    const response = await popupBackendRequest(`/api/admin/popups/${id}`, access);
    if (!response.ok) return popupApiError(response);
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json({ message: "팝업 정보를 불러오지 못했습니다." }, { status: 502 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await adminAccess();
  if (typeof access !== "string") return access;
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) return NextResponse.json({ message: "올바르지 않은 팝업 ID입니다." }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "입력값을 확인해 주세요." }, { status: 400 });
  }

  try {
    const response = await fetch(backendUrl(`/api/admin/popups/${id}`), {
      method: "PUT",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) return popupApiError(response);
      const result = await response.json().catch(() => ({})) as { message?: string };
      return NextResponse.json({ message: result.message || "팝업을 수정하지 못했습니다. 입력값을 확인해 주세요." },
        { status: response.status >= 500 ? 502 : response.status });
    }
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json({ message: "팝업을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await adminAccess();
  if (typeof access !== "string") return access;

  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) {
    return NextResponse.json({ message: "올바르지 않은 팝업 ID입니다." }, { status: 400 });
  }

  try {
    const response = await popupBackendRequest(`/api/admin/popups/${id}`, access, "DELETE");
    if (!response.ok) return popupApiError(response);
    return new Response(null, { status: 204 });
  } catch {
    return NextResponse.json({ message: "팝업을 삭제하지 못했습니다." }, { status: 502 });
  }
}
