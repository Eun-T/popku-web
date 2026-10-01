import { NextResponse } from "next/server";
import { adminAccess, popupApiError } from "@/lib/admin-popup-api";
import { backendUrl } from "@/lib/backend";

export async function imageBackendRequest(
  placeId: string,
  suffix: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  request?: Request,
) {
  const access = await adminAccess();
  if (typeof access !== "string") return access;
  if (!/^[1-9]\d*$/.test(placeId)) {
    return NextResponse.json({ message: "올바르지 않은 팝업 ID입니다." }, { status: 400 });
  }

  let body: string | undefined;
  if (request && (method === "POST" || method === "PUT")) {
    try {
      body = JSON.stringify(await request.json());
    } catch {
      return NextResponse.json({ message: "요청 값을 확인해 주세요." }, { status: 400 });
    }
  }

  const path = `/api/admin/popups/${placeId}/images${suffix}`;
  let response: Response;
  try {
    response = await fetch(backendUrl(path), {
      method,
      headers: {
        Authorization: `Bearer ${access}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body,
      cache: "no-store",
    });
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined;
    const code = cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string"
      ? cause.code : undefined;
    console.error("Admin popup image backend fetch failed", {
      method, path, error: error instanceof Error ? error.name : "UnknownError", code,
      config: error instanceof Error && error.message === "BACKEND_API_URL is required" ? "BACKEND_API_URL missing" : undefined,
    });
    return NextResponse.json({ message: "이미지 요청에 실패했습니다." }, { status: 502 });
  }
  if (!response.ok) {
    if (response.status >= 500) {
      console.error("Admin popup image backend error response", { method, path, status: response.status });
    }
    return popupApiError(response);
  }
  if (response.status === 204) return new Response(null, { status: 204 });
  try {
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    console.error("Admin popup image backend returned invalid JSON", { method, path, status: response.status });
    return NextResponse.json({ message: "이미지 응답을 확인하지 못했습니다." }, { status: 502 });
  }
}
