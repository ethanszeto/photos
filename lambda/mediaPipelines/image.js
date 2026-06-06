import sharp from "sharp";
import { SHARP_OPTIONS } from "../utils/config.js";
import { renderThumbnails, THUMBNAIL_WEBP_EFFORT } from "../utils/thumbnails.js";
import { decodeHeifToRaster } from "../utils/decodeHeif.js";
import { heifTempExtension, isHeifImage } from "../utils/mediaTypes.js";

export default async function processImage(buffer, photoId, objectKey = "", contentType = "") {
  const isHeif = isHeifImage(contentType, objectKey);
  const pipelineBuffer = isHeif
    ? await decodeHeifToRaster(buffer, photoId, heifTempExtension(objectKey))
    : buffer;

  let image = sharp(pipelineBuffer, SHARP_OPTIONS);
  if (isHeif) {
    image = image.rotate().toColorspace("srgb");
  }

  const metadata = await image.metadata();
  const thumb = (instance) => (isHeif ? instance : instance.rotate());

  const thumbnails = await renderThumbnails(image, {
    prepare: thumb,
    effort: THUMBNAIL_WEBP_EFFORT,
  });

  return {
    ...thumbnails,
    image_metadata: {
      width: metadata.width,
      height: metadata.height,
    },
  };
}
