import { NextResponse } from "next/server";
import { adminAccess } from "@/lib/admin-popup-api";
import { regionRequest, regionResponse, validRegionBody } from "@/lib/admin-region-api";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  const access = await adminAccess();
  if (typeof access !== "string") return access;
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) return NextResponse.json({ message: "올바르지 않은 지역 ID입니다." }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { body = null; }
  const region = validRegionBody(body);
  if (!region) return NextResponse.json({ message: "국가와 1~100자의 지역명을 입력해 주세요." }, { status: 400 });
  try {
    return await regionResponse(await regionRequest(`/api/admin/regions/${id}`, access, "PUT", JSON.stringify(region)), "지역을 수정하지 못했습니다.");
  } catch {
    return NextResponse.json({ message: "지역을 수정하지 못했습니다." }, { status: 502 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const access = await adminAccess();
  if (typeof access !== "string") return access;
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) return NextResponse.json({ message: "올바르지 않은 지역 ID입니다." }, { status: 400 });
  try {
    return await regionResponse(await regionRequest(`/api/admin/regions/${id}`, access, "DELETE"), "지역을 삭제하지 못했습니다.");
  } catch {
    return NextResponse.json({ message: "지역을 삭제하지 못했습니다." }, { status: 502 });
  }
}
