import { imageBackendRequest } from "@/lib/admin-popup-image-api";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return imageBackendRequest((await params).id, "/order", "PUT", request);
}
