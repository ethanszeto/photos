import type { UploadInitResponse, UploadResult } from "@/types";

const SUPPORTED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif"]);

export function isSupportedImageType(type: string): boolean {
  return SUPPORTED_TYPES.has(type.split(";")[0].trim().toLowerCase());
}

export async function initUpload(contentType: string): Promise<UploadInitResponse> {
  const response = await fetch("/api/upload/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(data.error ?? "Failed to initialize upload");
  }

  return response.json() as Promise<UploadInitResponse>;
}

export async function uploadFileToS3(file: File, onProgress?: (progress: number) => void): Promise<UploadResult> {
  const contentType = file.type || "image/jpeg";
  if (!isSupportedImageType(contentType)) {
    throw new Error(`Unsupported file type: ${contentType || "unknown"}`);
  }

  const { uploadUrl, photoId } = await initUpload(contentType);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });

  // Media URLs are written to DynamoDB by the processing pipeline after upload.
  return { id: photoId };
}
