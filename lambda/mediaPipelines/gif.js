import sharp from "sharp";
import { SHARP_OPTIONS } from "../utils/config.js";

export default async function processGif(buffer, photoId) {
  const image = sharp(buffer, SHARP_OPTIONS);
  const small = await image.resize(300, 300, { fit: "inside" }).webp({ quality: 80 }).toBuffer();
  const medium = await image.resize(1600, null, { withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  return { small, medium };
}
