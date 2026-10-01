import { NextResponse } from "next/server";
import { adminAccess } from "@/lib/admin-popup-api";
import { backendUrl } from "@/lib/backend";

async function forward(request: Request, method: string) {
  const access = await adminAccess();
  if (typeof access !== "string") return access;
  const url = new URL(request.url);
  const country = url.searchParams.get("countryCode");
  if (country !== "KR" && country !== "JP") return NextResponse.json({ message: "국가를 선택해주세요." }, { status: 400 });
  const base = "/api/admin/home-curations/NOW_HOT";
  const search = url.searchParams.get("search");
  const placeId = url.searchParams.get("placeId");
  if (method === "DELETE" && (!placeId || !/^[1-9]\d*$/.test(placeId)))
    return NextResponse.json({ message: "팝업을 선택해주세요." }, { status: 400 });
  const path = method === "GET" && search !== null
    ? `${base}/search?countryCode=${country}&name=${encodeURIComponent(search)}`
    : method === "GET" ? `${base}?countryCode=${country}`
      : method === "DELETE" ? `${base}/${placeId}?countryCode=${country}`
        : method === "PUT" ? `${base}/order` : base;
  try {
    const response = await fetch(backendUrl(path), {
      method,
      headers: { Authorization: `Bearer ${access}`, ...(method === "POST" || method === "PUT" ? { "Content-Type": "application/json" } : {}) },
      body: method === "POST" || method === "PUT" ? await request.text() : undefined,
      cache: "no-store",
    });
    if (response.status === 204 || response.status === 201) return new NextResponse(null, { status: response.status });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ message: "서버에 연결할 수 없습니다." }, { status: 502 });
  }
}

export async function GET(request: Request) { return forward(request, "GET"); }
export async function POST(request: Request) { return forward(request, "POST"); }
export async function PUT(request: Request) { return forward(request, "PUT"); }
export async function DELETE(request: Request) { return forward(request, "DELETE"); }
