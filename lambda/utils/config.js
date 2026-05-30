import { execFile } from "child_process";

export const THUMBNAIL_BUCKET = process.env.THUMBNAIL_BUCKET;
export const TABLE_NAME = process.env.PHOTO_TABLE;
export const AWS_REGION = process.env.AWS_REGION;
export const CLOUDFRONT_THUMBNAIL_DOMAIN = process.env.CLOUDFRONT_THUMBNAIL_DOMAIN;
export const CLOUDFRONT_ORIGINAL_DOMAIN = process.env.CLOUDFRONT_ORIGINAL_DOMAIN;

export const SHARP_OPTIONS = {
  limitInputPixels: 10000 * 10000,
  failOn: "none",
};

/** Prevent ffmpeg/ffprobe from hanging until Lambda/SQS visibility timeout. */
const EXEC_TIMEOUT_MS = 120_000;

export function execFileAsync(cmd, args, timeoutMs = EXEC_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) reject(err);
        else resolve({ stdout: stdout?.toString() ?? "", stderr: stderr?.toString() ?? "" });
      },
    );
  });
}
