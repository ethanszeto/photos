import sharp from "sharp";
import { SHARP_OPTIONS } from "../utils/config.js";
import { renderThumbnails } from "../utils/thumbnails.js";

export default async function processGif(buffer) {
  const image = sharp(buffer, SHARP_OPTIONS);
  return renderThumbnails(image);
}
