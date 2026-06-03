import extractExifData from "./utils/extractExifData.js";
import getMediaType, { resolveContentType, videoTempExtension } from "./utils/mediaTypes.js";
import processGif from "./mediaPipelines/gif.js";
import processImage from "./mediaPipelines/image.js";
import processVideo from "./mediaPipelines/video.js";
import crypto from "crypto";
import upload from "./utils/s3Upload.js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import {
  AWS_REGION,
  THUMBNAIL_BUCKET,
  TABLE_NAME,
  CLOUDFRONT_THUMBNAIL_DOMAIN,
  CLOUDFRONT_ORIGINAL_DOMAIN,
} from "./utils/config.js";

const s3 = new S3Client({ region: AWS_REGION });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));

export const handler = async (event) => {
  try {
    for (const record of event.Records || []) {
      const body = JSON.parse(record.body);
      const s3Record = body.Records?.[0];

      if (!s3Record) {
        console.warn("Missing S3 record in SQS message");
        continue;
      }

      const originalBucket = s3Record.s3.bucket.name;
      const originalKey = decodeURIComponent(s3Record.s3.object.key.replace(/\+/g, " "));

      const mediaHash = crypto.createHash("sha256").update(`${originalBucket}:${originalKey}`).digest("hex");

      if (originalKey.startsWith("small/") || originalKey.startsWith("medium/") || originalKey.startsWith("video/")) {
        console.log("Skipping derived file:", originalKey);
        continue;
      }

      const existing = await dynamo.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: "MEDIA",
            SK: mediaHash,
          },
        }),
      );

      if (existing.Item) {
        console.log("Already exists", originalKey);
        continue;
      }

      console.log("Processing:", originalKey);

      const object = await s3.send(
        new GetObjectCommand({
          Bucket: originalBucket,
          Key: originalKey,
        }),
      );

      if (!object.Body) {
        throw new Error(`Missing object body for ${originalKey}`);
      }

      const buffer = Buffer.from(await object.Body.transformToByteArray());
      const contentType = resolveContentType(object.ContentType || "", originalKey);
      const mediaType = getMediaType(contentType, originalKey);

      if (mediaType === "unknown") {
        console.log("Unsupported media type:", contentType);
        continue;
      }

      const now = new Date().toISOString();
      const lastModified = object.LastModified?.toISOString() ?? now;

      let exifData = { takenAt: null, modifiedAt: null, metadata: {} };
      if (mediaType === "image" || mediaType === "gif") {
        exifData = await extractExifData(buffer);
      }

      const takenAt = exifData.takenAt || lastModified || now;
      const modifiedAt = exifData.modifiedAt || lastModified || now;

      let result;
      if (mediaType === "image") {
        result = await processImage(buffer, mediaHash, originalKey, contentType);
      } else if (mediaType === "video") {
        result = await processVideo(buffer, mediaHash, videoTempExtension(originalKey));
      } else if (mediaType === "gif") {
        result = await processGif(buffer, mediaHash);
      }

      if (!result?.small || !result?.medium) {
        throw new Error(`Thumbnail generation failed for ${originalKey} (${mediaType})`);
      }

      const smallKey = `small/${mediaHash}.webp`;
      const mediumKey = `medium/${mediaHash}.webp`;

      await Promise.all([
        upload(s3, THUMBNAIL_BUCKET, smallKey, result.small, "image/webp"),
        upload(s3, THUMBNAIL_BUCKET, mediumKey, result.medium, "image/webp"),
      ]);

      const smallUrl = `${CLOUDFRONT_THUMBNAIL_DOMAIN}${smallKey}`;
      const mediumUrl = `${CLOUDFRONT_THUMBNAIL_DOMAIN}${mediumKey}`;
      const originalUrl = `${CLOUDFRONT_ORIGINAL_DOMAIN}${originalKey}`;

      const geometryWidth = exifData.metadata?.geometry?.width ?? result.image_metadata?.width ?? null;
      const geometryHeight = exifData.metadata?.geometry?.height ?? result.image_metadata?.height ?? null;
      const videoMeta = mediaType === "video" ? (result.video_metadata ?? {}) : null;
      const width = videoMeta?.width ?? geometryWidth ?? null;
      const height = videoMeta?.height ?? geometryHeight ?? null;
      const duration = videoMeta?.duration ?? null;

      const sortKey = `${takenAt}#${mediaHash}`;
      const year = new Date(takenAt).getUTCFullYear();

      const galleryFields = {
        id: mediaHash,
        mediaType,
        takenAt,
        smallUrl,
        mediumUrl,
        ...(width != null ? { width } : {}),
        ...(height != null ? { height } : {}),
        ...(duration != null ? { duration } : {}),
      };

      const mediaItem = {
        PK: "MEDIA",
        SK: mediaHash,
        id: mediaHash,
        mediaType,
        takenAt,
        uploadedAt: now,
        modifiedAt,
        originalUrl,
        smallUrl,
        mediumUrl,
        mimeType: contentType,
        image_metadata: mediaType === "video" ? {} : exifData.metadata,
        video_metadata: mediaType === "video" ? (result.video_metadata ?? {}) : undefined,
      };

      const galleryItem = {
        PK: "GALLERY",
        SK: sortKey,
        ...galleryFields,
      };

      const yearItem = {
        PK: `YEAR#${year}`,
        SK: sortKey,
        ...galleryFields,
      };

      await dynamo.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: TABLE_NAME,
                Item: mediaItem,
                ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
              },
            },
            {
              Put: {
                TableName: TABLE_NAME,
                Item: galleryItem,
                ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
              },
            },
            {
              Put: {
                TableName: TABLE_NAME,
                Item: yearItem,
                ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
              },
            },
          ],
        }),
      );

      console.log("Processed:", mediaHash);
    }

    return { success: true };
  } catch (err) {
    console.error("Lambda processing error:", err);
    throw err;
  }
};
