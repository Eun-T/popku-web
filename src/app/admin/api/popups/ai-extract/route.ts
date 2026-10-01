import { NextResponse } from "next/server";
import { adminAccess } from "@/lib/admin-popup-api";
import { backendUrl } from "@/lib/backend";

const failure = "AI 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.";
const invalid = "공지 텍스트 또는 JPEG/PNG/WEBP 이미지 1~5장을 확인해 주세요. 이미지는 각 10MB 이하입니다.";
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const access = await adminAccess();
  if (typeof access !== "string") return access;
  let body: BodyInit;
  const headers: Record<string, string> = { Authorization: `Bearer ${access}` };
  try {
    if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      const form = await request.formData();
      const text = form.get("text");
      const images = form.getAll("images");
      if (text !== null && typeof text !== "string" || typeof text === "string" && text.length > 10000
        || images.length > 5 || images.some((image) => !(image instanceof File)
          || !imageTypes.has(image.type) || image.size === 0 || image.size > 10 * 1024 * 1024)
        || (!String(text || "").trim() && images.length === 0)) {
        return NextResponse.json({ message: invalid }, { status: 400 });
      }
      const upstream = new FormData();
      if (typeof text === "string" && text.trim()) upstream.append("text", text.trim());
      for (const image of images) upstream.append("images", image);
      body = upstream;
    } else if (request.headers.get("content-type")?.includes("application/json")) {
      const text = (await request.json() as { text?: unknown }).text;
      if (typeof text !== "string" || !text.trim() || text.length > 10000) {
        return NextResponse.json({ message: invalid }, { status: 400 });
      }
      headers["Content-Type"] = "application/json";
      body = JSON.stringify({ text: text.trim() });
    } else {
      return NextResponse.json({ message: invalid }, { status: 400 });
    }
    const response = await fetch(backendUrl("/api/admin/popups/ai-extract"), {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(70000),
    });
    if (response.status === 401) return NextResponse.json({ message: "관리자 세션이 만료되었습니다." }, { status: 401 });
    if (response.status === 403) return NextResponse.json({ message: "관리자 권한이 필요합니다." }, { status: 403 });
    if (!response.ok) return NextResponse.json({ message: response.status === 400 ? invalid : failure },
      { status: response.status === 400 ? 400 : 502 });
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json({ message: failure }, { status: 502 });
  }
}
