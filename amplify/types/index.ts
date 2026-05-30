export type UploadInitResponse = {
  uploadUrl: string;
  photoId: string;
  key: string;
};

/** Returned after a successful S3 upload; URLs arrive via DynamoDB once processing completes. */
export type UploadResult = {
  id: string;
};

export type MediaType = "image" | "video" | "gif";

export type ImageMetadataTime = {
  takenAt?: string | null;
  createdAt?: string | null;
  modifiedAt?: string | null;
  offsetTime?: string | null;
  subSecTime?: string | null;
};

export type ImageMetadataGps = {
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
  direction?: number | null;
};

export type ImageMetadataDevice = {
  make?: string | null;
  model?: string | null;
  software?: string | null;
  owner?: string | null;
  serialNumber?: string | null;
};

export type ImageMetadataCamera = {
  iso?: number | null;
  focalLength?: number | null;
  fNumber?: number | null;
  exposureTime?: number | null;
  exposureProgram?: number | null;
  whiteBalance?: number | null;
  flash?: number | null;
  meteringMode?: number | null;
  exposureCompensation?: number | null;
};

export type ImageMetadataGeometry = {
  width?: number | null;
  height?: number | null;
  orientation?: number | null;
  colorSpace?: number | null;
  bitsPerSample?: number | null;
};

export type ImageMetadataApple = {
  livePhotoIdentifier?: string | null;
  livePhotoIndex?: number | null;
  sceneType?: number | null;
  hdrGainMap?: string | null;
  lensModel?: string | null;
};

export type ImageMetadataEditing = {
  software?: string | null;
  processingSoftware?: string | null;
  history?: unknown;
  profileName?: string | null;
};

export type ImageMetadataMedia = {
  format?: string | null;
  mimeType?: string | null;
  duration?: number | null;
  frameRate?: number | null;
  codec?: string | null;
  bitrate?: number | null;
  rotation?: number | null;
};

/** EXIF-derived metadata stored as `image_metadata` in DynamoDB */
export type ImageMetadata = {
  time?: ImageMetadataTime;
  gps?: ImageMetadataGps;
  device?: ImageMetadataDevice;
  camera?: ImageMetadataCamera;
  geometry?: ImageMetadataGeometry;
  apple?: ImageMetadataApple;
  editing?: ImageMetadataEditing;
  media?: ImageMetadataMedia;
};

/** ffprobe-derived metadata stored as `video_metadata` in DynamoDB (videos only) */
export type VideoMetadata = {
  duration: number | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  bitRate: number | null;
  rotation: number | null;
};

/** DynamoDB photo record (full write shape or slim list projection). */
export type DynamoPhotoItem = {
  PK: "PHOTOS";
  SK: string;
  id: string;
  mediaType: MediaType;
  smallUrl: string;
  mediumUrl: string;
  originalUrl: string;
  takenAt: string;
  uploadedAt: string;
  modifiedAt: string;
  mimeType: string;
  image_metadata?: Pick<ImageMetadata, "geometry">;
  video_metadata?: VideoMetadata | null;
};

/** Client-facing media item for the gallery grid and detail viewer. */
export type MediaItem = {
  id: string;
  mediaType: MediaType;
  takenAt: string;
  uploadedAt: string;
  modifiedAt: string;
  smallUrl: string;
  mediumUrl: string;
  originalUrl: string;
  width?: number;
  height?: number;
  duration?: number;
  mimeType: string;
};

export type MediaListResponse = {
  items: MediaItem[];
  nextCursor: string | null;
};

export type LatestMediaResponse = {
  latestTakenAt: string | null;
};
