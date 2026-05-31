import extractExifData from "./utils/extractExifData.js";
import getMediaType, { resolveContentType, videoTempExtension } from "./utils/mediaTypes.js";
import processGif from "./mediaPipelines/gif.js";
import processImage from "./mediaPipelines/image.js";
import processVideo from "./mediaPipelines/video.js";
import sharp from "sharp";
import upload from "./utils/s3Upload.js";
import { randomUUID } from "crypto";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
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

      // prevent recursion
      if (originalKey.startsWith("small/") || originalKey.startsWith("medium/") || originalKey.startsWith("video/")) {
        console.log("Skipping derived file:", originalKey);
        continue;
      }

      console.log("Processing:", originalKey);

      // download original
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

      const id = randomUUID();
      const now = new Date().toISOString();
      const lastModified = object.LastModified?.toISOString() ?? now;

      // exifr on video/MOV buffers can scan the entire file and hang — images/gifs only.
      let exifData = { takenAt: null, modifiedAt: null, metadata: {} };
      if (mediaType === "image" || mediaType === "gif") {
        exifData = await extractExifData(buffer);
      }

      const takenAt = exifData.takenAt || lastModified || now;
      const modifiedAt = exifData.modifiedAt || lastModified || now;

      let result;
      if (mediaType === "image") {
        result = await processImage(buffer, id, originalKey, contentType);
      } else if (mediaType === "video") {
        result = await processVideo(buffer, id, videoTempExtension(originalKey));
      } else if (mediaType === "gif") {
        result = await processGif(buffer, id);
      }

      if (!result?.small || !result?.medium) {
        throw new Error(`Thumbnail generation failed for ${originalKey} (${mediaType})`);
      }

      /**
       * Upload both previews to S3
       */
      const smallKey = `small/${id}.webp`;
      const mediumKey = `medium/${id}.webp`;

      await Promise.all([
        upload(s3, THUMBNAIL_BUCKET, smallKey, result.small, "image/webp"),
        upload(s3, THUMBNAIL_BUCKET, mediumKey, result.medium, "image/webp"),
      ]);

      const smallUrl = `${CLOUDFRONT_THUMBNAIL_DOMAIN}${smallKey}`;
      const mediumUrl = `${CLOUDFRONT_THUMBNAIL_DOMAIN}${mediumKey}`;
      const originalUrl = `${CLOUDFRONT_ORIGINAL_DOMAIN}${originalKey}`;

      /**
       * Upload unified record to DynamoDB
       */
      const item = {
        PK: "PHOTOS",
        SK: `${takenAt}#${id}`,
        id,
        mediaType,
        smallUrl,
        mediumUrl,
        originalUrl,
        takenAt,
        uploadedAt: now,
        modifiedAt,
        mimeType: contentType,
        image_metadata: mediaType === "video" ? {} : exifData.metadata,
        video_metadata: mediaType === "video" ? (result.video_metadata ?? {}) : undefined,
      };

      await dynamo.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: item,
        }),
      );

      console.log("Processed:", id);
    }

    return { success: true };
  } catch (err) {
    console.error("Lambda processing error:", err);
    throw err;
  }
};
