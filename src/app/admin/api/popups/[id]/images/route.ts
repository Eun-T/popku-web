import { imageBackendRequest } from "@/lib/admin-popup-image-api";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  return imageBackendRequest((await params).id, "", "GET");
}

export async function POST(request: Request, { params }: Context) {
  return imageBackendRequest((await params).id, "", "POST", request);
}
