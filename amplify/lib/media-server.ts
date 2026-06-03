import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { DEFAULT_PAGE_SIZE } from "@/lib/media-constants";
import type { DynamoGalleryItem, DynamoMediaItem, MediaDetail, MediaItem } from "@/types";

const MAX_PAGE_SIZE = 200;

const GALLERY_PROJECTION_NAMES = {
  "#id": "id",
  "#duration": "duration",
} as const;

const GALLERY_PROJECTION = [
  "#id",
  "mediaType",
  "takenAt",
  "smallUrl",
  "mediumUrl",
  "width",
  "height",
  "#duration",
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

/** Map a GALLERY / YEAR record to the client-facing grid shape. */
export function toGalleryItem(item: DynamoGalleryItem): MediaItem {
  return {
    id: item.id,
    mediaType: item.mediaType,
    takenAt: item.takenAt,
    smallUrl: item.smallUrl,
    mediumUrl: item.mediumUrl,
    width: item.width ?? undefined,
    height: item.height ?? undefined,
    duration: item.duration ?? undefined,
  };
}

/** Map a canonical MEDIA record to the client-facing detail shape. */
export function toMediaDetail(item: DynamoMediaItem): MediaDetail {
  const geometryWidth = item.image_metadata?.geometry?.width;
  const geometryHeight = item.image_metadata?.geometry?.height;
  const videoWidth = item.video_metadata?.width;
  const videoHeight = item.video_metadata?.height;

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
    duration: item.video_metadata?.duration ?? undefined,
    mimeType: item.mimeType,
    image_metadata: item.image_metadata,
    video_metadata: item.video_metadata,
  };
}

export type FetchGalleryPageOptions = {
  cursor?: string | null;
  limit?: number;
  year?: number;
};

export type FetchGalleryPageResult = {
  items: MediaItem[];
  nextCursor: string | null;
};

/**
 * Query gallery items sorted by takenAt descending (newest first).
 * Uses SK `{takenAt}#{mediaHash}` with ScanIndexForward=false.
 */
export async function fetchGalleryPage(options: FetchGalleryPageOptions = {}): Promise<FetchGalleryPageResult> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const exclusiveStartKey = options.cursor ? decodeMediaCursor(options.cursor) : undefined;
  const pk = options.year != null ? `YEAR#${options.year}` : "GALLERY";

  const response = await getDocClient().send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": pk },
      ProjectionExpression: GALLERY_PROJECTION,
      ExpressionAttributeNames: GALLERY_PROJECTION_NAMES,
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey ?? undefined,
    }),
  );

  const items = (response.Items ?? []).map((item) => toGalleryItem(item as DynamoGalleryItem));

  const nextCursor = response.LastEvaluatedKey ? encodeMediaCursor(response.LastEvaluatedKey as MediaPageCursor) : null;

  return { items, nextCursor };
}

/** Newest `takenAt` in the archive (first GALLERY page, descending sort). */
export async function fetchLatestTakenAt(): Promise<string | null> {
  const page = await fetchGalleryPage({ limit: 1 });
  return page.items[0]?.takenAt ?? null;
}

/** Fetch the canonical MEDIA record by id (mediaHash). */
export async function fetchMediaById(id: string): Promise<MediaDetail | null> {
  const response = await getDocClient().send(
    new GetCommand({
      TableName: getTableName(),
      Key: {
        PK: "MEDIA",
        SK: id,
      },
    }),
  );

  if (!response.Item) {
    return null;
  }

  return toMediaDetail(response.Item as DynamoMediaItem);
}
