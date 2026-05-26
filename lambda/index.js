import sharp from "sharp";
import { randomUUID } from "crypto";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

import { extractExifData } from "./extractExifData.mjs";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
});
const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION,
  }),
);

const bufferOptions = {
  limitInputPixels: 10000 * 10000,
};

const THUMBNAIL_BUCKET = process.env.THUMBNAIL_BUCKET;
const TABLE_NAME = process.env.PHOTO_TABLE;

export const handler = async (event) => {
  try {
    const record = event.Records?.[0];

    if (!record) {
      throw new Error("No S3 record found");
    }

    const originalBucket = record.s3.bucket.name;

    const originalKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    // Prevent recursive upload of items to thumbnails bucket
    if (originalKey.startsWith("medium/") || originalKey.startsWith("small/")) {
      console.log("Skipping derived image:", originalKey);
      return;
    }

    console.log("Processing:", originalKey);

    const extension = originalKey.split(".").pop()?.toLowerCase();

    // -----------------------------------
    // Download original image
    // -----------------------------------

    const object = await s3.send(
      new GetObjectCommand({
        Bucket: originalBucket,
        Key: originalKey,
      }),
    );

    if (!object.Body) {
      throw new Error("S3 object body missing");
    }

    const buffer = Buffer.from(await object.Body.transformToByteArray());

    // -----------------------------------
    // Extract metadata
    // -----------------------------------

    const sharpMetadata = await sharp(buffer, bufferOptions).metadata();
    const exifData = await extractExifData(buffer);
    const takenAt = exifData.takenAt || object.LastModified?.toISOString() || new Date().toISOString();
    const uploadedAt = new Date().toISOString();
    const modifiedAt = object.LastModified?.toISOString() ?? uploadedAt;
    const photoId = randomUUID();

    const smallBuffer = await sharp(buffer, bufferOptions)
      .rotate() // respects EXIF orientation
      .resize({
        width: 300,
        height: 300,
        fit: "inside",
        withoutEnlargement: true,
        withoutReduction: true,
      })
      .webp({
        quality: 80,
        effort: 4,
      })
      .toBuffer();

    const mediumBuffer = await sharp(buffer, bufferOptions)
      .rotate()
      .resize({
        width: 1600,
        fit: "inside",
        withoutEnlargement: true,
        withoutReduction: true,
      })
      .webp({
        quality: 85,
        effort: 4,
      })
      .toBuffer();

    const smallKey = `small/${photoId}.webp`;
    const mediumKey = `medium/${photoId}.webp`;

    await Promise.all([
      s3.send(
        new PutObjectCommand({
          Bucket: THUMBNAIL_BUCKET,
          Key: smallKey,
          Body: smallBuffer,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      ),
      s3.send(
        new PutObjectCommand({
          Bucket: THUMBNAIL_BUCKET,
          Key: mediumKey,
          Body: mediumBuffer,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      ),
    ]);

    // Upload Image Record to DynamoDB
    const item = {
      PK: "PHOTOS",
      SK: `${takenAt}#${photoId}`,
      photoId,
      originalKey,
      smallKey,
      mediumKey,
      takenAt,
      uploadedAt: new Date().toISOString(),
      modifiedAt: exifData.modifiedAt || object.LastModified?.toISOString(),
      width: sharpMetadata.width,
      height: sharpMetadata.height,
      mimeType: object.ContentType,
      originalExtension: extension,
      originalBucket,
      thumbnailBucket: THUMBNAIL_BUCKET,
      metadata: exifData.metadata,
    };

    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      }),
    );

    console.log("Successfully processed:", photoId);

    return {
      success: true,
      photoId,
    };
  } catch (error) {
    console.error("Lambda processing error:", error);

    throw error;
  }
};
