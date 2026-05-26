import { createPresignedViewUrl, getPublicObjectUrl, listOriginalPhotos } from "@/lib/s3";
import type { GalleryPhoto } from "@/types";

export async function fetchGalleryPhotos(): Promise<GalleryPhoto[]> {
  const objects = await listOriginalPhotos();
  const usePresigned = process.env.S3_USE_PRESIGNED_VIEW !== "false";

  return Promise.all(
    objects.map(async (item) => ({
      photoId: item.photoId,
      key: item.key,
      url: usePresigned ? await createPresignedViewUrl(item.key) : getPublicObjectUrl(item.key),
      uploadedAt: item.lastModified?.toISOString(),
    })),
  );
}
