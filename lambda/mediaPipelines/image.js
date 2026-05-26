import sharp from "sharp";
import { SHARP_OPTIONS } from "../utils/config.js";

export default async function processImage(buffer, photoId) {
  const image = sharp(buffer, SHARP_OPTIONS);
  const metadata = await image.metadata();

  const small = await image
    .clone()
    .rotate()
    .resize({ width: 300, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toBuffer();

  const medium = await image
    .clone()
    .rotate()
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
