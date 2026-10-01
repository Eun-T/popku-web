import { NextResponse } from "next/server";
import { imageBackendRequest } from "@/lib/admin-popup-image-api";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  const { id, imageId } = await params;
  if (!/^[1-9]\d*$/.test(imageId)) {
    return NextResponse.json({ message: "올바르지 않은 이미지 ID입니다." }, { status: 400 });
  }
  return imageBackendRequest(id, `/${imageId}`, "DELETE");
}
