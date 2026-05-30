import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { DEFAULT_PAGE_SIZE } from "@/lib/media-constants";
import type { DynamoPhotoItem, MediaItem } from "@/types";

const MAX_PAGE_SIZE = 200;

/**
 * Slim projection for gallery list queries — omits bulky EXIF subtrees
 * (device, GPS, camera, apple, editing, etc.) while keeping geometry + video stats.
 */
const MEDIA_LIST_PROJECTION = [
  "id",
  "mediaType",
  "takenAt",
  "uploadedAt",
  "modifiedAt",
  "mimeType",
  "smallUrl",
  "mediumUrl",
  "originalUrl",
  "image_metadata.geometry",
  "video_metadata",
].join(", ");

let docClient: DynamoDBDocumentClient | null = null;

function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const region = process.env.REGION;
    const accessKeyId = process.env.DYNAMO_PHOTOS_KEY;
    const secretAccessKey = process.env.DYNAMO_PHOTOS_SECRET;

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error("AWS credentials are not configured");
    }

    docClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      }),
      { marshallOptions: { removeUndefinedValues: true } },
    );
  }
  return docClient;
}

function getTableName(): string {
  const table = process.env.PHOTO_TABLE ?? process.env.DYNAMODB_TABLE_NAME;
  if (!table) {
    throw new Error("PHOTO_TABLE is not configured");
  }
  return table;
}

export type MediaPageCursor = {
  PK: string;
  SK: string;
};

export function encodeMediaCursor(cursor: MediaPageCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeMediaCursor(raw: string): MediaPageCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as MediaPageCursor;
    if (typeof parsed.PK === "string" && typeof parsed.SK === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** Map a DynamoDB record to the client-facing MediaItem shape. */
export function toMediaItem(item: DynamoPhotoItem): MediaItem {
  const geometryWidth = item.image_metadata?.geometry?.width;
  const geometryHeight = item.image_metadata?.geometry?.height;
  const videoWidth = item.video_metadata?.width;
  const videoHeight = item.video_metadata?.height;
  const duration = item.video_metadata?.duration;

  return {
    id: item.id,
    mediaType: item.mediaType,
    takenAt: item.takenAt,
    uploadedAt: item.uploadedAt,
    modifiedAt: item.modifiedAt,
    smallUrl: item.smallUrl,
    mediumUrl: item.mediumUrl,
    originalUrl: item.originalUrl,
    width: videoWidth ?? geometryWidth ?? undefined,
    height: videoHeight ?? geometryHeight ?? undefined,
    duration: duration ?? undefined,
    mimeType: item.mimeType,
  };
}

export type FetchMediaPageOptions = {
  cursor?: string | null;
  limit?: number;
};

export type FetchMediaPageResult = {
  items: MediaItem[];
  nextCursor: string | null;
};

/**
 * Query media sorted by takenAt descending (newest first).
 * Uses DynamoDB SK (`{takenAt}#{id}`) with ScanIndexForward=false.
 */
export async function fetchMediaPage(options: FetchMediaPageOptions = {}): Promise<FetchMediaPageResult> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const exclusiveStartKey = options.cursor ? decodeMediaCursor(options.cursor) : undefined;

  const response = await getDocClient().send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": "PHOTOS" },
      ProjectionExpression: MEDIA_LIST_PROJECTION,
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey ?? undefined,
    }),
  );

  const items = (response.Items ?? []).map((item) => toMediaItem(item as DynamoPhotoItem));

  const nextCursor = response.LastEvaluatedKey ? encodeMediaCursor(response.LastEvaluatedKey as MediaPageCursor) : null;

  return { items, nextCursor };
}

/** Newest `takenAt` in the archive (first page, descending sort). */
export async function fetchLatestTakenAt(): Promise<string | null> {
  const page = await fetchMediaPage({ limit: 1 });
  return page.items[0]?.takenAt ?? null;
}
