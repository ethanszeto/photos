import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const PRESIGN_UPLOAD_EXPIRY_SECONDS = 300;
const PRESIGN_VIEW_EXPIRY_SECONDS = 3600;

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

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

export function getPublicObjectUrl(key: string): string {
  const region = process.env.AWS_REGION!;
  const bucket = getBucketName();
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(key).replace(/%2F/g, "/")}`;
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

export async function createPresignedViewUrl(key: string): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });

  return getSignedUrl(client, command, {
    expiresIn: PRESIGN_VIEW_EXPIRY_SECONDS,
  });
}

export async function listOriginalPhotos(): Promise<{ photoId: string; key: string; lastModified?: Date }[]> {
  const client = getS3Client();
  const bucket = getBucketName();
  const photos: { photoId: string; key: string; lastModified?: Date }[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "originals/",
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of response.Contents ?? []) {
      if (!object.Key || object.Key.endsWith("/")) continue;
      const match = object.Key.match(/^originals\/([^.]+)\.([a-z0-9]+)$/i);
      if (!match) continue;
      photos.push({
        photoId: match[1],
        key: object.Key,
        lastModified: object.LastModified,
      });
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  photos.sort((a, b) => (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0));

  return photos;
}
