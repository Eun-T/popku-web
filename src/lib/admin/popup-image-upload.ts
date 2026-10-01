export const MAX_COVER_IMAGES = 1;
export const MAX_CONTENT_IMAGES = 15;
export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";
export const WEBP_QUALITY = 0.82;
export const COVER_MAX_DIMENSION = 1600;
export const CONTENT_MAX_DIMENSION = 1920;

export type PopupImageType = "COVER" | "CONTENT";
const acceptedTypes = new Set(ACCEPTED_IMAGE_TYPES.split(","));

function logImageOptimization(
  original: File, optimized: File, imageType: PopupImageType,
  originalWidth: number, originalHeight: number,
  optimizedWidth: number, optimizedHeight: number, reEncoded: boolean,
) {
  if (process.env.NODE_ENV !== "development") return;
  const formatSize = (bytes: number) => bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(0)} KB`;
  const savedBytes = original.size - optimized.size;
  const reduction = original.size === 0 ? 0 : (savedBytes / original.size) * 100;
  console.log(`[POPKU Image Optimization]
type: ${imageType}
original: ${formatSize(original.size)}
original dimensions: ${originalWidth} × ${originalHeight}
original format: ${original.type}

optimized: ${formatSize(optimized.size)}
optimized dimensions: ${optimizedWidth} × ${optimizedHeight}
optimized format: ${optimized.type}

saved: ${formatSize(savedBytes)}
reduction: ${reduction.toFixed(1)}%
re-encoded: ${reEncoded}`);
}

export async function optimizePopupImage(file: File, imageType: PopupImageType): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    // Apply EXIF orientation while decoding so the canvas receives upright pixels.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("이미지를 읽거나 WebP로 변환하지 못했습니다.");
  }

  try {
    const maximum = imageType === "COVER" ? COVER_MAX_DIMENSION : CONTENT_MAX_DIMENSION;
    const longest = Math.max(bitmap.width, bitmap.height);
    if (!longest) throw new Error("이미지 크기가 올바르지 않습니다.");
    // Keep an already-small WebP as-is to avoid another lossy encode.
    if (file.type === "image/webp" && longest <= maximum) {
      logImageOptimization(file, file, imageType, bitmap.width, bitmap.height, bitmap.width, bitmap.height, false);
      return file;
    }

    const scale = Math.min(1, maximum / longest);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지 변환을 시작하지 못했습니다.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
    if (!blob || blob.type !== "image/webp") throw new Error("WebP 이미지 변환에 실패했습니다.");
    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    const optimized = new File([blob], name, { type: "image/webp", lastModified: file.lastModified });
    logImageOptimization(file, optimized, imageType, bitmap.width, bitmap.height, canvas.width, canvas.height, true);
    return optimized;
  } finally {
    bitmap.close();
  }
}

export function validatePopupImageFiles(files: File[], imageType: PopupImageType, existingCount: number) {
  const maximum = imageType === "COVER" ? MAX_COVER_IMAGES : MAX_CONTENT_IMAGES;
  if (imageType === "COVER" && files.length > maximum) return `대표 이미지는 한 번에 ${maximum}장만 선택할 수 있습니다.`;
  if (imageType === "CONTENT" && existingCount + files.length > maximum) return `팝업 소개 이미지는 최대 ${maximum}장입니다. 현재 ${existingCount}장 선택되어 있습니다.`;
  if (files.some((file) => !acceptedTypes.has(file.type))) return "JPEG, PNG, WEBP 파일만 업로드할 수 있습니다.";
  return null;
}

export async function popupImageErrorMessage(response: Response, fallback: string) {
  if (response.status === 401) window.location.assign("/admin/session/refresh");
  try {
    const result = await response.json() as { message?: string };
    return result.message || fallback;
  } catch { return fallback; }
}

export async function uploadPopupImage(placeId: string | number, file: File, imageType: PopupImageType) {
  const base = `/admin/api/popups/${placeId}/images`;
  const optimized = await optimizePopupImage(file, imageType);
  let presignResponse: Response;
  try {
    presignResponse = await fetch(`${base}/presign`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageType, contentType: optimized.type }),
    });
  } catch { throw new Error("Presign 요청 실패: 서버에 연결하지 못했습니다."); }
  if (!presignResponse.ok) throw new Error(`Presign 요청 실패: ${await popupImageErrorMessage(presignResponse, "업로드 주소를 받지 못했습니다.")}`);
  const upload = await presignResponse.json() as { uploadUrl: string; imageKey: string; contentType: string };
  if (!upload.uploadUrl || !upload.imageKey || upload.contentType !== optimized.type || !upload.imageKey.endsWith(".webp")) throw new Error("Presign 응답의 업로드 정보가 올바르지 않습니다.");
  let putResponse: Response;
  try {
    putResponse = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": upload.contentType }, body: optimized });
  } catch { throw new Error("S3 PUT 실패: 네트워크 또는 S3 CORS 설정을 확인해 주세요."); }
  if (!putResponse.ok) throw new Error(`S3 PUT 실패: HTTP ${putResponse.status}`);
  let registerResponse: Response;
  try {
    registerResponse = await fetch(base, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageType, imageKey: upload.imageKey }),
    });
  } catch { throw new Error("이미지 등록 실패: 서버에 연결하지 못했습니다."); }
  if (!registerResponse.ok) throw new Error(`이미지 등록 실패: ${await popupImageErrorMessage(registerResponse, "서버에 이미지를 등록하지 못했습니다.")}`);
}
