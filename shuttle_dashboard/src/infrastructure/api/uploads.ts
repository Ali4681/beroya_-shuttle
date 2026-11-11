import type { CompleteUploadResult, PresignResult, UploadPurpose } from "@/domain/models/entities";
import { ApiError } from "@/infrastructure/http/client";

export const UPLOAD_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const STUDENT_PHOTO_MAX_BYTES = 1024 * 1024;

const API_PATH = "/api/v1/shuttle/";
const OBJECTS_PATH = `${API_PATH}local-storage/objects/`;
const MANAGED_ROOTS = ["institutions/", "platform/app-branding/"];

/**
 * Stored media URLs point at the public bucket or at the API's own localhost origin.
 * The public host can 404 while the object still exists, and the API sends
 * `Cross-Origin-Resource-Policy: same-origin`, so the browser only displays the file
 * through the same-origin `/api/v1/shuttle/*` rewrite (next.config.ts).
 */
export function mediaUrl(url: string): string;
export function mediaUrl(url: string | null | undefined): string | undefined;
export function mediaUrl(url: string | null | undefined) {
  if (!url) return undefined;
  const key = managedObjectKey(url);
  if (key) return `${OBJECTS_PATH}${key}`;
  const index = url.indexOf(API_PATH);
  return index > 0 ? url.slice(index) : url;
}

function managedObjectKey(url: string): string | null {
  let path: string;
  try {
    path = new URL(url, "http://local").pathname;
  } catch {
    return null;
  }
  path = decodeURIComponent(path).replace(/^\/+/, "");
  const marker = "local-storage/objects/";
  const at = path.indexOf(marker);
  if (at >= 0) path = path.slice(at + marker.length);
  if (!MANAGED_ROOTS.some((root) => path.startsWith(root))) {
    const slash = path.indexOf("/");
    if (slash > 0) path = path.slice(slash + 1);
  }
  if (!MANAGED_ROOTS.some((root) => path.startsWith(root)) || path.includes("..")) return null;
  return path;
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve(image);
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ApiError("UPLOAD_INVALID_IMAGE", 400));
    };
    image.src = url;
  });
}

export async function readImageSize(file: File) {
  const image = await loadImage(file);
  return { width: image.naturalWidth, height: image.naturalHeight };
}

const LOGO_MAX_SIDE = 1024;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * The backend only accepts square JPEG/PNG/WebP logos up to 2MB, so any image the browser can
 * decode is centred on a transparent square canvas (never cropped) and re-encoded to fit.
 */
export async function normalizeLogo(file: File): Promise<File> {
  const image = await loadImage(file);
  const width = image.naturalWidth || LOGO_MAX_SIDE;
  const height = image.naturalHeight || LOGO_MAX_SIDE;
  const allowedType = UPLOAD_MIME.includes(file.type as (typeof UPLOAD_MIME)[number]);
  if (allowedType && width === height && width <= LOGO_MAX_SIDE && file.size <= LOGO_MAX_BYTES) {
    return file;
  }

  for (const side of [Math.min(Math.max(width, height), LOGO_MAX_SIDE), 512, 256]) {
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext("2d");
    if (!context) break;
    const scale = side / Math.max(width, height);
    const drawWidth = Math.round(width * scale);
    const drawHeight = Math.round(height * scale);
    context.imageSmoothingQuality = "high";
    context.drawImage(image, (side - drawWidth) / 2, (side - drawHeight) / 2, drawWidth, drawHeight);

    for (const [type, quality] of [["image/webp", 0.92], ["image/png", undefined]] as const) {
      const blob = await canvasToBlob(canvas, type, quality);
      if (blob && blob.type === type && blob.size <= LOGO_MAX_BYTES) {
        const name = `${file.name.replace(/\.[^.]+$/, "") || "logo"}.${type === "image/webp" ? "webp" : "png"}`;
        return new File([blob], name, { type });
      }
    }
  }
  throw new ApiError("UPLOAD_TOO_LARGE", 400);
}

/** Client-side checks mirroring the backend limits; throws ApiError with the backend code. */
export async function assertUploadable(file: File, purpose: "logo" | "student_photo") {
  if (!UPLOAD_MIME.includes(file.type as (typeof UPLOAD_MIME)[number])) {
    throw new ApiError("UPLOAD_MIME_NOT_ALLOWED", 400);
  }
  const max = purpose === "logo" ? LOGO_MAX_BYTES : STUDENT_PHOTO_MAX_BYTES;
  if (file.size > max) throw new ApiError("UPLOAD_TOO_LARGE", 400);
  if (purpose === "logo") {
    const { width, height } = await readImageSize(file);
    if (width !== height) throw new ApiError("LOGO_NOT_SQUARE", 400);
  }
}

/** presign → PUT to storage → complete. Returns the managed public URL. */
export async function uploadImage(
  file: File,
  purpose: "logo" | "student_photo",
  presign: (contentType: string, byteSize: number) => Promise<PresignResult>,
  complete: (objectKey: string) => Promise<CompleteUploadResult>,
) {
  if (purpose === "logo") file = await normalizeLogo(file);
  await assertUploadable(file, purpose);
  const ticket = await presign(file.type, file.size);
  let response: Response;
  try {
    response = await fetch(mediaUrl(ticket.uploadUrl), {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
  } catch {
    throw new ApiError("STORAGE_UNAVAILABLE", 0);
  }
  if (!response.ok) throw new ApiError("STORAGE_UNAVAILABLE", response.status);
  const result = await complete(ticket.objectKey);
  return result.url;
}

const BRANDING_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/json",
] as const;

const BLOCKED_EXT = ["exe", "dll", "apk", "aab", "ipa", "php", "js", "html", "htm"];
const GIF_MAX_BYTES = 5 * 1024 * 1024;

export function assertBrandingUploadable(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (BLOCKED_EXT.includes(ext)) throw new ApiError("BRANDING_UPLOAD_MIME_NOT_ALLOWED", 400);
  if (!(BRANDING_MIME as readonly string[]).includes(file.type) && ext !== "json") {
    throw new ApiError("BRANDING_UPLOAD_MIME_NOT_ALLOWED", 400);
  }
  const max = file.type === "image/gif" ? GIF_MAX_BYTES : LOGO_MAX_BYTES;
  if (file.size > max) throw new ApiError("UPLOAD_TOO_LARGE", 400);
}

export async function uploadBrandingAsset(
  file: File,
  purpose: Exclude<UploadPurpose, "student_photo">,
  presign: (contentType: string, byteSize: number, fileName: string) => Promise<PresignResult>,
  complete: (objectKey: string) => Promise<CompleteUploadResult>,
) {
  assertBrandingUploadable(file);
  const contentType =
    file.type ||
    (file.name.toLowerCase().endsWith(".json") ? "application/json" : "application/octet-stream");
  if (contentType === "application/octet-stream") {
    throw new ApiError("BRANDING_UPLOAD_MIME_NOT_ALLOWED", 400);
  }
  const ticket = await presign(contentType, file.size, file.name);
  let response: Response;
  try {
    response = await fetch(mediaUrl(ticket.uploadUrl), {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
  } catch {
    throw new ApiError("STORAGE_UNAVAILABLE", 0);
  }
  if (!response.ok) throw new ApiError("STORAGE_UNAVAILABLE", response.status);
  return complete(ticket.objectKey);
}
