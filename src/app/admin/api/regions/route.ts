import { NextResponse } from "next/server";
import { adminAccess } from "@/lib/admin-popup-api";
import { regionRequest, regionResponse, validRegionBody } from "@/lib/admin-region-api";

export async function GET() {
  const access = await adminAccess();
  if (typeof access !== "string") return access;
  try {
    return await regionResponse(await regionRequest("/api/admin/regions", access), "지역 목록을 불러오지 못했습니다.");
  } catch {
    return NextResponse.json({ message: "지역 목록을 불러오지 못했습니다." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const access = await adminAccess();
  if (typeof access !== "string") return access;
  let body: unknown;
  try { body = await request.json(); } catch { body = null; }
  const region = validRegionBody(body);
  if (!region) return NextResponse.json({ message: "국가와 1~100자의 지역명을 입력해 주세요." }, { status: 400 });
  try {
    return await regionResponse(await regionRequest("/api/admin/regions", access, "POST", JSON.stringify(region)), "지역을 추가하지 못했습니다.");
  } catch {
    return NextResponse.json({ message: "지역을 추가하지 못했습니다." }, { status: 502 });
  }
}
