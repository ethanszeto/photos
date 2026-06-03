import sharp from "sharp";
import { SHARP_OPTIONS } from "../utils/config.js";
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

  const small = await thumb(image.clone())
    .resize({ width: 300, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toBuffer();

  const medium = await thumb(image.clone())
    .resize({ width: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85, effort: 4 })
    .toBuffer();

  return {
    small,
    medium,
    image_metadata: {
      width: metadata.width,
      height: metadata.height,
    },
  };
}
