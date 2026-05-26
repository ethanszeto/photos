import extractExifData from "./utils/extractExifData.js";
import getMediaType from "./utils/getMediaType.js";
import processGif from "./mediaPipelines/gif.js";
import processImage from "./mediaPipelines/image.js";
import processVideo from "./mediaPipelines/video.js";
import sharp from "sharp";
import upload from "./utils/s3Upload.js";
import { randomUUID } from "crypto";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { AWS_REGION, THUMBNAIL_BUCKET, TABLE_NAME } from "./utils/config.js";

const s3 = new S3Client({ region: AWS_REGION });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));

export const handler = async (event) => {
  try {
    for (const record of event.Records || []) {
      const originalBucket = record.s3.bucket.name;

      const originalKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

      // prevent recursion
      if (originalKey.startsWith("small/") || originalKey.startsWith("medium/") || originalKey.startsWith("video/")) {
        console.log("Skipping derived file:", originalKey);
        continue;
      }

      // download original
      const object = await s3.send(
        new GetObjectCommand({
          Bucket: originalBucket,
          Key: originalKey,
        }),
      );

      const buffer = Buffer.from(await object.Body.transformToByteArray());
      const contentType = object.ContentType || "";
      const mediaType = getMediaType(contentType);

      if (mediaType === "unknown") {
        console.log("Unsupported media type:", contentType);
        continue;
      }

      const id = randomUUID(); // media ID
      const now = new Date().toISOString();
      const exifData = await extractExifData(buffer);
      const takenAt = exifData.takenAt || object.LastModified?.toISOString() || now;
      const modifiedAt = exifData.modifiedAt || object.LastModified?.toISOString() || now;

      /**
       * Generate Thumbnails for Media
       */
      let result;
      if (mediaType === "image") {
        result = await processImage(buffer, id);
      }

      if (mediaType === "video") {
        result = await processVideo(buffer, id);
      }

      if (mediaType === "gif") {
        result = await processGif(buffer, id);
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

      /**
       * Upload unified record to DynamoDB
       */
      const item = {
        PK: "PHOTOS",
        SK: `${takenAt}#${id}`,
        id,
        mediaType,
        originalKey,
        originalBucket,
        smallKey,
        mediumKey,
        thumbnailBucket: THUMBNAIL_BUCKET,
        takenAt,
        uploadedAt: now,
        modifiedAt,
        mimeType: contentType,
        image_metadata: exifData.metadata,
        video_metadata: result.video_metadata,
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
