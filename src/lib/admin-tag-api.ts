import { NextResponse } from "next/server";
import { backendUrl } from "@/lib/backend";

export async function tagRequest(path: string, token: string, method = "GET", body?: string) {
  return fetch(backendUrl(path), {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body,
    cache: "no-store",
  });
}

export async function tagResponse(response: Response, fallback: string) {
  if (response.status === 401) return NextResponse.json({ message: "관리자 세션이 만료되었습니다." }, { status: 401 });
  if (response.status === 403) return NextResponse.json({ message: "관리자 권한이 필요합니다." }, { status: 403 });
  if (response.status === 409) {
    let message = "동일한 태그명이 이미 있습니다.";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error === "tag_in_use") message = "사용 중인 태그는 삭제할 수 없습니다.";
    } catch { /* Keep the readable fallback. */ }
    return NextResponse.json({ message }, { status: 409 });
  }
  if (!response.ok) return NextResponse.json({ message: fallback }, { status: response.status >= 500 ? 502 : response.status });
  if (response.status === 204) return new Response(null, { status: 204 });
  return NextResponse.json(await response.json(), { status: response.status });
}
