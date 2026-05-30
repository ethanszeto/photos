/** MIME types accepted for direct-to-S3 uploads (images + videos). */
export const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/svg+xml": "svg",
  "image/x-canon-cr2": "cr2",
  "image/x-canon-cr3": "cr3",
  "image/x-nikon-nef": "nef",
  "image/x-nikon-nrw": "nrw",
  "image/x-sony-arw": "arw",
  "image/x-adobe-dng": "dng",
  "image/dng": "dng",
  "image/x-fuji-raf": "raf",
  "image/x-olympus-orf": "orf",
  "image/x-panasonic-rw2": "rw2",
  "image/x-panasonic-raw": "raw",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
  "video/x-m4v": "m4v",
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  svg: "image/svg+xml",
  cr2: "image/x-canon-cr2",
  cr3: "image/x-canon-cr3",
  nef: "image/x-nikon-nef",
  nrw: "image/x-nikon-nrw",
  arw: "image/x-sony-arw",
  dng: "image/x-adobe-dng",
  raf: "image/x-fuji-raf",
  orf: "image/x-olympus-orf",
  rw2: "image/x-panasonic-rw2",
  raw: "image/x-panasonic-raw",
  mp4: "video/mp4",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  m4v: "video/x-m4v",
};

const SUPPORTED_MIMES = new Set(Object.keys(MIME_TO_EXT));

/** File picker + drag-drop hint (mobile may ignore unknown MIME — include extensions). */
export const UPLOAD_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/svg+xml",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/x-matroska",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".avif",
  ".heic",
  ".heif",
  ".svg",
  ".gif",
  ".arw",
  ".cr2",
  ".cr3",
  ".nef",
  ".nrw",
  ".dng",
  ".orf",
  ".raf",
  ".rw2",
  ".raw",
  ".mp4",
  ".mov",
  ".mkv",
  ".m4v",
].join(",");

const UPLOAD_EXTENSION_PATTERN =
  /\.(jpe?g|png|gif|webp|avif|heic|heif|svg|arw|cr2|cr3|nef|nrw|dng|orf|raf|rw2|raw|mp4|mov|m4v|mkv)$/i;

export function extensionFromContentType(contentType: string): string | null {
  const normalized = contentType.split(";")[0].trim().toLowerCase();
  return MIME_TO_EXT[normalized] ?? null;
}

export function mimeFromFilename(filename: string): string | null {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!match) return null;
  return EXT_TO_MIME[match[1]] ?? null;
}

/** Resolve a supported MIME for upload (handles empty / octet-stream from mobile RAW picks). */
export function resolveUploadMimeType(file: File): string | null {
  const fromName = mimeFromFilename(file.name);
  const raw = file.type.split(";")[0].trim().toLowerCase();

  if (raw && SUPPORTED_MIMES.has(raw)) return raw;
  if (fromName && SUPPORTED_MIMES.has(fromName)) return fromName;
  if ((raw === "" || raw === "application/octet-stream") && fromName) return fromName;

  return null;
}

export function isSupportedUploadMimeType(contentType: string): boolean {
  const normalized = contentType.split(";")[0].trim().toLowerCase();
  return SUPPORTED_MIMES.has(normalized);
}

export function isSelectableUploadFile(file: File): boolean {
  if (resolveUploadMimeType(file)) return true;
  return UPLOAD_EXTENSION_PATTERN.test(file.name);
}
