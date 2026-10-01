import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminCookies } from "@/lib/admin-session";
import { backendUrl, getMe, type UserResponse } from "@/lib/backend";

export type PopupSummary = {
  id: number;
  name: string;
  countryCode: string;
  regionId: number | null;
  regionName: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string | null;
};

export type PopupListItem = PopupSummary & { tags: string[] };

export async function adminAccess(): Promise<string | NextResponse> {
  const token = (await cookies()).get(adminCookies.access)?.value;
  if (!token) return NextResponse.json({ message: "관리자 로그인이 필요합니다." }, { status: 401 });

  try {
    const response = await getMe(token);
    if (response.status === 401) {
      return NextResponse.json({ message: "관리자 세션이 만료되었습니다." }, { status: 401 });
    }
    if (!response.ok) throw new Error("Could not verify admin");
    const user = (await response.json()) as UserResponse;
    if (user.role !== "ADMIN") {
      return NextResponse.json({ message: "관리자 권한이 필요합니다." }, { status: 403 });
    }
    return token;
  } catch {
    return NextResponse.json({ message: "관리자 정보를 확인할 수 없습니다." }, { status: 502 });
  }
}

export function popupBackendRequest(path: string, token: string, method = "GET") {
  return fetch(backendUrl(path), {
    method,
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

export function popupApiError(response: Response) {
  if (response.status === 401) {
    return NextResponse.json({ message: "관리자 세션이 만료되었습니다." }, { status: 401 });
  }
  return NextResponse.json(
    { message: response.status === 403 ? "관리자 권한이 필요합니다." : "팝업 요청에 실패했습니다." },
    { status: response.status === 403 ? 403 : response.status >= 500 ? 502 : response.status },
  );
}
