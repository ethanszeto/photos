import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { DEFAULT_PAGE_SIZE } from "@/lib/media-constants";
import {
  decodeMediaCursor,
  encodeMediaCursor,
  toGalleryItem,
  type FetchGalleryPageResult,
  type MediaPageCursor,
} from "@/lib/media-server";
import type { Album, AlbumType, DynamoAlbumMetaItem, DynamoGalleryItem } from "@/types";

const MAX_PAGE_SIZE = 200;
const YEAR_PK_PREFIX = "YEAR#";
const ALBUM_META_PK = "ALBUM";
const USER_ALBUM_PK_PREFIX = "ALBUM#";

const GALLERY_PROJECTION_NAMES = {
  "#id": "id",
  "#duration": "duration",
} as const;

const GALLERY_PROJECTION = [
  "#id",
  "mediaType",
  "takenAt",
  "miniUrl",
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

export function isYearAlbumId(albumId: string): boolean {
  const year = Number.parseInt(albumId, 10);
  return /^\d{4}$/.test(albumId) && year >= 1970 && year <= 2100;
}

export function resolveAlbumType(albumId: string): AlbumType {
  return isYearAlbumId(albumId) ? "year" : "user";
}

/** Maps an album id + type to the Dynamo partition used for membership queries. */
export function resolveAlbumMediaPk(albumId: string, type: AlbumType): string {
  if (type === "year") {
    return `${YEAR_PK_PREFIX}${albumId}`;
  }
  return `${USER_ALBUM_PK_PREFIX}${albumId}`;
}

async function discoverYearPartitionKeys(): Promise<string[]> {
  const partitionKeys = new Set<string>();
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const response = await getDocClient().send(
      new ScanCommand({
        TableName: getTableName(),
        FilterExpression: "begins_with(PK, :prefix)",
        ExpressionAttributeValues: { ":prefix": YEAR_PK_PREFIX },
        ProjectionExpression: "PK",
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    for (const item of response.Items ?? []) {
      if (typeof item.PK === "string") {
        partitionKeys.add(item.PK);
      }
    }

    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return Array.from(partitionKeys).sort((a, b) => {
    const yearA = Number.parseInt(a.replace(YEAR_PK_PREFIX, ""), 10);
    const yearB = Number.parseInt(b.replace(YEAR_PK_PREFIX, ""), 10);
    return yearB - yearA;
  });
}

async function getPartitionCover(pk: string): Promise<{ coverUrl: string | null; hasItems: boolean }> {
  const response = await getDocClient().send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": pk },
      ProjectionExpression: "miniUrl, smallUrl",
      ScanIndexForward: false,
      Limit: 1,
    }),
  );

  const coverItem = response.Items?.[0] as Pick<DynamoGalleryItem, "miniUrl" | "smallUrl"> | undefined;

  return {
    hasItems: coverItem != null,
    coverUrl: coverItem?.smallUrl ?? coverItem?.miniUrl ?? null,
  };
}

/** Future user-created albums: metadata at PK = ALBUM. */
async function fetchUserAlbums(): Promise<Album[]> {
  const response = await getDocClient().send(
    new QueryCommand({
      TableName: getTableName(),
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": ALBUM_META_PK },
    }),
  );

  const albums: Album[] = [];

  for (const item of response.Items ?? []) {
    const meta = item as DynamoAlbumMetaItem;
    const pk = resolveAlbumMediaPk(meta.id, "user");
    const coverUrl = meta.coverUrl ?? (await getPartitionCover(pk)).coverUrl;

    albums.push({
      id: meta.id,
      name: meta.name,
      coverUrl,
      type: "user",
    });
  }

  return albums.sort((a, b) => a.name.localeCompare(b.name));
}

/** List all albums (year partitions today; user albums when metadata exists). */
export async function fetchAlbumList(): Promise<Album[]> {
  const yearPks = await discoverYearPartitionKeys();

  const yearAlbums = await Promise.all(
    yearPks.map(async (pk) => {
      const year = pk.replace(YEAR_PK_PREFIX, "");
      const { coverUrl } = await getPartitionCover(pk);
      return {
        id: year,
        name: year,
        coverUrl,
        type: "year" as const,
      };
    }),
  );

  const userAlbums = await fetchUserAlbums();

  return [...yearAlbums, ...userAlbums];
}

export type FetchAlbumMediaPageOptions = {
  albumId: string;
  cursor?: string | null;
  limit?: number;
};

/** Paginated media for a single album partition (YEAR# or ALBUM#). */
export async function fetchAlbumMediaPage(options: FetchAlbumMediaPageOptions): Promise<FetchGalleryPageResult> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const exclusiveStartKey = options.cursor ? decodeMediaCursor(options.cursor) : undefined;
  const type = resolveAlbumType(options.albumId);
  const pk = resolveAlbumMediaPk(options.albumId, type);

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

/** Resolve display name for an album detail header. */
export async function fetchAlbumById(albumId: string): Promise<Album | null> {
  const type = resolveAlbumType(albumId);
  const pk = resolveAlbumMediaPk(albumId, type);

  if (type === "user") {
    const response = await getDocClient().send(
      new QueryCommand({
        TableName: getTableName(),
        KeyConditionExpression: "PK = :pk AND SK = :sk",
        ExpressionAttributeValues: { ":pk": ALBUM_META_PK, ":sk": albumId },
        Limit: 1,
      }),
    );

    const meta = response.Items?.[0] as DynamoAlbumMetaItem | undefined;
    if (!meta) {
      return null;
    }

    const { coverUrl } = await getPartitionCover(pk);
    return {
      id: meta.id,
      name: meta.name,
      coverUrl: meta.coverUrl ?? coverUrl,
      type: "user",
    };
  }

  const { coverUrl, hasItems } = await getPartitionCover(pk);
  if (!hasItems) {
    return null;
  }

  return {
    id: albumId,
    name: albumId,
    coverUrl,
    type: "year",
  };
}
