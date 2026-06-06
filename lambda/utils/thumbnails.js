/** Thumbnail tier definitions — single source of truth for resize, WebP, and S3 layout. */
export const THUMBNAIL_TIERS = [
  { name: "mini", maxPx: 64, quality: 75, s3Folder: "mini" },
  { name: "small", maxPx: 300, quality: 80, s3Folder: "small" },
  { name: "medium", maxPx: 1600, quality: 85, s3Folder: "medium" },
];

/** WebP encoder effort (0–6); used for still-image pipeline. */
export const THUMBNAIL_WEBP_EFFORT = 4;

/** S3 key prefixes for derived thumbs — used to skip re-processing in the handler. */
export const THUMBNAIL_S3_PREFIXES = THUMBNAIL_TIERS.map((tier) => tier.s3Folder);

export function thumbnailS3Key(tier, mediaHash) {
  return `${tier.s3Folder}/${mediaHash}.webp`;
}

export function thumbnailUrlField(tier) {
  return `${tier.name}Url`;
}

function resizeOptions(maxPx) {
  return {
    width: maxPx,
    height: maxPx,
    fit: "inside",
    withoutEnlargement: true,
  };
}

function webpOptions(tier, effort) {
  const options = { quality: tier.quality };
  if (effort != null) {
    options.effort = effort;
  }
  return options;
}

/**
 * Render every configured thumbnail tier from a Sharp instance.
 * @param {import("sharp").Sharp} image
 * @param {{ prepare?: (instance: import("sharp").Sharp) => import("sharp").Sharp, effort?: number }} [options]
 */
export async function renderThumbnails(image, { prepare, effort } = {}) {
  const prep = prepare ?? ((instance) => instance);
  const result = {};

  for (const tier of THUMBNAIL_TIERS) {
    result[tier.name] = await prep(image.clone())
      .resize(resizeOptions(tier.maxPx))
      .webp(webpOptions(tier, effort))
      .toBuffer();
  }

  return result;
}

export function thumbnailsComplete(result) {
  return THUMBNAIL_TIERS.every((tier) => result?.[tier.name]);
}

export function isDerivedThumbnailKey(objectKey) {
  return THUMBNAIL_S3_PREFIXES.some((prefix) => objectKey.startsWith(`${prefix}/`));
}

export function buildThumbnailUrls(cdnDomain, mediaHash) {
  const urls = {};
  for (const tier of THUMBNAIL_TIERS) {
    urls[thumbnailUrlField(tier)] = `${cdnDomain}${thumbnailS3Key(tier, mediaHash)}`;
  }
  return urls;
}
