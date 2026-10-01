import { imageBackendRequest } from "@/lib/admin-popup-image-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return imageBackendRequest((await params).id, "/presign", "POST", request);
}
