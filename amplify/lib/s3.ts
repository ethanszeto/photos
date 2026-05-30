import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const PRESIGN_UPLOAD_EXPIRY_SECONDS = 300;

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const region = process.env.REGION;
    const accessKeyId = process.env.S3_PHOTO_ORIGINALS_KEY;
    const secretAccessKey = process.env.S3_PHOTO_ORIGINALS_SECRET;

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error("AWS credentials are not configured");
    }

    s3Client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return s3Client;
}

export function getBucketName(): string {
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) {
    throw new Error("S3_BUCKET_NAME is not configured");
  }
  return bucket;
}

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function extensionFromContentType(contentType: string): string | null {
  const normalized = contentType.split(";")[0].trim().toLowerCase();
  return MIME_TO_EXT[normalized] ?? null;
}

export function buildOriginalKey(photoId: string, extension: string): string {
  return `originals/${photoId}.${extension}`;
}

export async function createPresignedUpload(contentType: string): Promise<{ uploadUrl: string; photoId: string; key: string }> {
  const extension = extensionFromContentType(contentType);
  if (!extension) {
    throw new Error("Unsupported content type");
  }

  const photoId = randomUUID();
  const key = buildOriginalKey(photoId, extension);
  const bucket = getBucketName();
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGN_UPLOAD_EXPIRY_SECONDS,
  });

  return { uploadUrl, photoId, key };
}
