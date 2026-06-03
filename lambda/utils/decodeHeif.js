import { writeFile, readFile, unlink } from "fs/promises";
import { execFileAsync } from "./config.js";

/**
 * Decode HEIC/HEIF to JPEG for Sharp. libheif applies ICC/NCLX (e.g. Display P3) correctly;
 * ffmpeg fallback forces RGB + bt709 conversion when libheif is unavailable.
 */
export async function decodeHeifToRaster(buffer, photoId, extension) {
  const safeExt = extension.replace(/[^a-z0-9]/gi, "") || "heic";
  const inputPath = `/tmp/${photoId}.${safeExt}`;
  const outputPath = `/tmp/${photoId}-decoded.jpg`;

  await writeFile(inputPath, buffer);
  try {
    try {
      await execFileAsync("heif-convert", ["--quality", "95", inputPath, outputPath]);
    } catch (heifErr) {
      console.warn("heif-convert failed, trying ffmpeg:", heifErr?.message ?? heifErr);
      await decodeHeifWithFfmpeg(inputPath, outputPath);
    }
    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

async function decodeHeifWithFfmpeg(inputPath, outputPath) {
  await execFileAsync("ffmpeg", [
    "-i",
    inputPath,
    "-frames:v",
    "1",
    "-vf",
    "scale=in_range=full:in_color_matrix=bt709:out_range=full:out_color_matrix=bt709,colorspace=bt709:iall=bt709:rangein=full:range=full,format=rgb24",
    "-pix_fmt",
    "rgb24",
    "-q:v",
    "2",
    "-y",
    outputPath,
  ]);
}
