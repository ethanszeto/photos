import { promisify } from "util";
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

export const execFileAsync = promisify(execFile);
