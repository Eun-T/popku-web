import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/backend";

export function regionRequest(path: string, token: string, method = "GET", body?: string) {
  return fetch(backendUrl(path), {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body,
    cache: "no-store",
  });
}

export async function regionResponse(response: Response, fallback: string) {
  if (response.status === 401) return NextResponse.json({ message: "관리자 세션이 만료되었습니다." }, { status: 401 });
  if (response.status === 403) return NextResponse.json({ message: "관리자 권한이 필요합니다." }, { status: 403 });
  if (response.status === 409) {
    let message = "같은 국가에 동일한 지역명이 이미 있습니다.";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error === "region_in_use") message = "사용 중인 지역은 삭제하거나 국가를 변경할 수 없습니다.";
    } catch { /* Keep the readable fallback. */ }
    return NextResponse.json({ message }, { status: 409 });
  }
  if (!response.ok) return NextResponse.json({ message: fallback }, { status: response.status >= 500 ? 502 : response.status });
  if (response.status === 204) return new Response(null, { status: 204 });
  return NextResponse.json(await response.json(), { status: response.status });
}

export function validRegionBody(body: unknown): { countryCode: "KR" | "JP"; name: string } | null {
  if (!body || typeof body !== "object") return null;
  const { countryCode, name } = body as { countryCode?: unknown; name?: unknown };
  if ((countryCode !== "KR" && countryCode !== "JP") || typeof name !== "string") return null;
  const trimmed = name.trim();
  return trimmed && trimmed.length <= 100 ? { countryCode, name: trimmed } : null;
}
