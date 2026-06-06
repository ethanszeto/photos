import { mkdir, appendFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import pLimit from "p-limit";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const TABLE_NAME = process.env.PHOTO_TABLE;
const THUMBNAIL_BUCKET = process.env.THUMBNAIL_BUCKET;
const AWS_REGION = process.env.AWS_REGION;

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));

const s3 = new S3Client({
  region: AWS_REGION,
});

const limit = pLimit(20);

/** Mirror mini tier in utils/thumbnails.js — keep in sync if that spec changes. */
const MINI_THUMBNAIL_PX = 64;
const MINI_WEBP_QUALITY = 75;
const MINI_WEBP_EFFORT = 4;

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "mini-backfill.log");

async function log(entry) {
  await appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`);
}

async function createMini(buffer) {
  return sharp(buffer)
    .resize({
      width: MINI_THUMBNAIL_PX,
      height: MINI_THUMBNAIL_PX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: MINI_WEBP_QUALITY, effort: MINI_WEBP_EFFORT })
    .toBuffer();
}

async function download(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download ${url}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function updateRecord(pk, sk, miniUrl) {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: pk,
        SK: sk,
      },
      UpdateExpression: "SET miniUrl = :url",
      ExpressionAttributeValues: {
        ":url": miniUrl,
      },
    }),
  );
}

async function processMedia(item) {
  if (item.miniUrl) {
    await log({
      id: item.id,
      status: "skipped",
    });

    return;
  }

  try {
    const smallBuffer = await download(item.smallUrl);

    const miniBuffer = await createMini(smallBuffer);

    const miniKey = `mini/${item.id}.webp`;
    const miniUrl = `${process.env.CLOUDFRONT_THUMBNAIL_DOMAIN}${miniKey}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: THUMBNAIL_BUCKET,
        Key: miniKey,
        Body: miniBuffer,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    //
    // MEDIA
    //
    await updateRecord("MEDIA", item.id, miniUrl);

    //
    // GALLERY
    //
    await updateRecord("GALLERY", `${item.takenAt}#${item.id}`, miniUrl);

    //
    // YEAR
    //
    const year = new Date(item.takenAt).getUTCFullYear();

    await updateRecord(`YEAR#${year}`, `${item.takenAt}#${item.id}`, miniUrl);

    await log({
      id: item.id,
      status: "success",
    });

    console.log("✓", item.id);
  } catch (error) {
    console.error("✗", item.id, error);

    await log({
      id: item.id,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function getAllMedia() {
  const items = [];

  let lastKey;

  do {
    const response = await dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": "MEDIA",
        },
        ExclusiveStartKey: lastKey,
      }),
    );

    items.push(...(response.Items ?? []));

    lastKey = response.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

async function main() {
  await mkdir(LOG_DIR, {
    recursive: true,
  });

  console.log("Loading MEDIA records...");

  const media = await getAllMedia();

  console.log(`Found ${media.length} media items`);

  await Promise.all(media.map((item) => limit(() => processMedia(item))));

  console.log("Done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
