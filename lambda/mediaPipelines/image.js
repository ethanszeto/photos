import sharp from "sharp";
import { writeFile, readFile, unlink } from "fs/promises";
import { SHARP_OPTIONS, execFileAsync } from "../utils/config.js";
import { heifTempExtension, isHeifImage } from "../utils/mediaTypes.js";

/** Lambda libvips lacks HEVC HEIF — decode with ffmpeg (same stack as video thumbs). */
async function decodeHeifToJpeg(buffer, photoId, extension) {
  const safeExt = extension.replace(/[^a-z0-9]/gi, "") || "heic";
  const inputPath = `/tmp/${photoId}.${safeExt}`;
  const outputPath = `/tmp/${photoId}-decoded.jpg`;

  await writeFile(inputPath, buffer);
  try {
    await execFileAsync("ffmpeg", ["-i", inputPath, "-frames:v", "1", "-q:v", "2", "-y", outputPath]);
    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

export default async function processImage(buffer, photoId, objectKey = "", contentType = "") {
  let pipelineBuffer = buffer;
  if (isHeifImage(contentType, objectKey)) {
    pipelineBuffer = await decodeHeifToJpeg(buffer, photoId, heifTempExtension(objectKey));
  }

  const image = sharp(pipelineBuffer, SHARP_OPTIONS);
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
