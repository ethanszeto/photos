/** Keep in sync with amplify/lib/media-types.ts */

export const MIME_TO_EXT = {
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

const EXT_TO_MIME = {
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

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "mkv", "m4v"]);

export function extensionFromKey(key) {
  const match = key.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? null;
}

export function resolveContentType(contentType, objectKey) {
  const normalized = (contentType || "").split(";")[0].trim().toLowerCase();
  if (normalized && normalized !== "application/octet-stream" && MIME_TO_EXT[normalized]) {
    return normalized;
  }

  const ext = extensionFromKey(objectKey);
  if (ext && EXT_TO_MIME[ext]) {
    return EXT_TO_MIME[ext];
  }

  return normalized || "application/octet-stream";
}

export default function getMediaType(contentType = "", objectKey = "") {
  const resolved = resolveContentType(contentType, objectKey);

  if (resolved === "image/gif") return "gif";
  if (resolved.startsWith("video/")) return "video";
  if (resolved.startsWith("image/")) return "image";

  const ext = extensionFromKey(objectKey);
  if (ext && VIDEO_EXTENSIONS.has(ext)) return "video";
  if (ext === "gif") return "gif";
  if (ext && EXT_TO_MIME[ext]?.startsWith("image/")) return "image";

  return "unknown";
}

export function videoTempExtension(objectKey) {
  const ext = extensionFromKey(objectKey);
  if (ext && VIDEO_EXTENSIONS.has(ext)) return ext;
  return "mp4";
}
