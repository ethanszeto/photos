import sharp from "sharp";
import { writeFile, readFile } from "fs/promises";
import { execFileAsync } from "../utils/config.js";

export default async function processVideo(buffer, photoId, extension = "mp4") {
  const safeExt = extension.replace(/[^a-z0-9]/gi, "") || "mp4";
  const inputPath = `/tmp/${photoId}.${safeExt}`;
  const framePath = `/tmp/${photoId}.jpg`;

  await writeFile(inputPath, buffer);

  let duration = null;
  let width = null;
  let height = null;
  let codec = null;
  let bitRate = null;
  let rotation = null;

  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,codec_name,bit_rate:stream_tags=rotate",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      inputPath,
    ]);

    const data = JSON.parse(stdout);

    const stream = data.streams?.[0] || {};
    const format = data.format || {};

    width = stream.width ?? null;
    height = stream.height ?? null;
    codec = stream.codec_name ?? null;
    bitRate = stream.bit_rate ? Number(stream.bit_rate) : null;
    duration = format.duration ? parseFloat(format.duration) : null;

    rotation = stream.tags?.rotate ? parseInt(stream.tags.rotate, 10) : null;
  } catch (err) {
    console.warn("ffprobe metadata failed:", err);
  }

  const midTime = duration ? duration / 2 : 1;
  const midTimestamp = new Date(midTime * 1000).toISOString().substring(11, 23); // HH:MM:SS.mmm format

  // extract thumbnail from middle of video
  await execFileAsync("ffmpeg", ["-i", inputPath, "-auto-orient", "-ss", midTimestamp, "-vframes", "1", "-q:v", "3", framePath]);

  const frameBuffer = await readFile(framePath);

  const small = await sharp(frameBuffer).resize(300, 300, { fit: "inside" }).webp({ quality: 80 }).toBuffer();
  const medium = await sharp(frameBuffer).resize(1600, null, { withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();

  return {
    small,
    medium,
    video_metadata: {
      duration,
      width,
      height,
      codec,
      bitRate,
      rotation,
    },
  };
}
