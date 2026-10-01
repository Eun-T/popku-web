import { NextResponse } from "next/server";
import { adminAccess } from "@/lib/admin-popup-api";
import { tagRequest, tagResponse } from "@/lib/admin-tag-api";

export async function GET() {
  const access = await adminAccess();
  if (typeof access !== "string") return access;
  try {
    return await tagResponse(await tagRequest("/api/admin/tags", access), "태그 목록을 불러오지 못했습니다.");
  } catch {
    return NextResponse.json({ message: "태그 목록을 불러오지 못했습니다." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const access = await adminAccess();
  if (typeof access !== "string") return access;
  let body: unknown;
  try { body = await request.json(); } catch { body = null; }
  const name = (body as { name?: unknown } | null)?.name;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 50) {
    return NextResponse.json({ message: "태그명을 1~50자로 입력해 주세요." }, { status: 400 });
  }
  try {
    return await tagResponse(await tagRequest("/api/admin/tags", access, "POST", JSON.stringify({ name: name.trim() })), "태그를 추가하지 못했습니다.");
  } catch {
    return NextResponse.json({ message: "태그를 추가하지 못했습니다." }, { status: 502 });
  }
}
