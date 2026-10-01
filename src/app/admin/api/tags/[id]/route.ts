import { NextResponse } from "next/server";
import { adminAccess } from "@/lib/admin-popup-api";
import { tagRequest, tagResponse } from "@/lib/admin-tag-api";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  const access = await adminAccess();
  if (typeof access !== "string") return access;
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) return NextResponse.json({ message: "올바르지 않은 태그 ID입니다." }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { body = null; }
  const name = (body as { name?: unknown } | null)?.name;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 50) {
    return NextResponse.json({ message: "태그명을 1~50자로 입력해 주세요." }, { status: 400 });
  }
  try {
    return await tagResponse(await tagRequest(`/api/admin/tags/${id}`, access, "PUT", JSON.stringify({ name: name.trim() })), "태그를 수정하지 못했습니다.");
  } catch {
    return NextResponse.json({ message: "태그를 수정하지 못했습니다." }, { status: 502 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const access = await adminAccess();
  if (typeof access !== "string") return access;
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) return NextResponse.json({ message: "올바르지 않은 태그 ID입니다." }, { status: 400 });
  try {
    return await tagResponse(await tagRequest(`/api/admin/tags/${id}`, access, "DELETE"), "태그를 삭제하지 못했습니다.");
  } catch {
    return NextResponse.json({ message: "태그를 삭제하지 못했습니다." }, { status: 502 });
  }
}
