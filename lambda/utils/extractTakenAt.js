/**
 * Resolve the best available capture date from parsed exifr output.
 * Checks EXIF, XMP, IPTC, GPS, and nested metadata in priority order.
 */

const TAKEN_AT_FIELD_PRIORITY = [
  "DateTimeOriginal",
  "CreateDate",
  "DateTimeDigitized",
  "MetadataDate",
  "photoshop:DateCreated",
  "xmp:CreateDate",
  "exif:DateTimeOriginal",
  "ModifyDate",
  "ReleaseDate",
];

const MODIFIED_AT_FIELD_PRIORITY = ["ModifyDate", "MetadataDate", "DigitalCreationDate", "DateTimeDigitized", "CreateDate"];

const DEEP_SCAN_KEY_PATTERN =
  /(?:date\s*time\s*original|date\s*time\s*digitized|date\s*created|time\s*created|creation\s*date|metadata\s*date|date\s*time|taken|digitized|original)/i;

/** exifr options tuned for Lambda — full buffer available, parse all segments. */
export const EXIF_PARSE_OPTIONS = {
  tiff: true,
  xmp: true,
  icc: true,
  iptc: true,
  jfif: true,
  ihdr: true,
  ifd0: true,
  ifd1: false,
  exif: true,
  gps: true,
  interop: true,
  makerNote: false,
  userComment: false,
  chunked: false,
  silentErrors: true,
  reviveValues: true,
  mergeOutput: true,
};

function pad2(value) {
  return String(Math.floor(value)).padStart(2, "0");
}

function rationalToNumber(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "object" && value.numerator != null) {
    const denominator = value.denominator || 1;
    return value.numerator / denominator;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseExifDateString(value) {
  const match = String(value).trim().match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseIptcDateString(value) {
  const trimmed = String(value).trim();
  const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const [, year, month, day] = compact;
    const date = new Date(`${year}-${month}-${day}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dashed = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dashed) {
    const [, year, month, day] = dashed;
    const date = new Date(`${year}-${month}-${day}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function parseIptcTimeString(value) {
  const trimmed = String(value).trim();
  const compact = trimmed.match(/^(\d{2})(\d{2})(\d{2})(?:([+-]\d{4}))?$/);
  if (compact) {
    const [, hour, minute, second] = compact;
    return { hour: Number(hour), minute: Number(minute), second: Number(second) };
  }

  const colon = trimmed.match(/^(\d{2}):(\d{2}):(\d{2})/);
  if (colon) {
    const [, hour, minute, second] = colon;
    return { hour: Number(hour), minute: Number(minute), second: Number(second) };
  }

  return null;
}

function toIsoString(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Normalize any metadata date value to ISO 8601, or null if invalid. */
export function parseMetadataDate(value) {
  if (value == null || value === "") return null;

  if (value instanceof Date) {
    return toIsoString(value);
  }

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const ms = value > 1e12 ? value : value * 1000;
    return toIsoString(new Date(ms));
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const exifDate = parseExifDateString(trimmed);
  if (exifDate) return toIsoString(exifDate);

  const iptcDate = parseIptcDateString(trimmed);
  if (iptcDate) return toIsoString(iptcDate);

  const parsed = new Date(trimmed);
  return toIsoString(parsed);
}

function combineDateAndTime(dateValue, timeValue) {
  const date = parseMetadataDate(dateValue) ?? parseIptcDateString(dateValue)?.toISOString();
  if (!date) return null;

  const time = parseIptcTimeString(timeValue);
  if (!time) return date;

  const base = new Date(date);
  base.setHours(time.hour, time.minute, time.second, 0);
  return toIsoString(base);
}

function gpsTimestampToIso(gpsDateStamp, gpsTimeStamp) {
  if (gpsDateStamp == null) return null;

  let year;
  let month;
  let day;

  if (gpsDateStamp instanceof Date) {
    year = gpsDateStamp.getUTCFullYear();
    month = gpsDateStamp.getUTCMonth() + 1;
    day = gpsDateStamp.getUTCDate();
  } else {
    const match = String(gpsDateStamp).trim().match(/^(\d{4})[:/-](\d{2})[:/-](\d{2})/);
    if (!match) return parseMetadataDate(gpsDateStamp);
    [, year, month, day] = match;
  }

  let hour = 0;
  let minute = 0;
  let second = 0;

  if (Array.isArray(gpsTimeStamp)) {
    hour = rationalToNumber(gpsTimeStamp[0]) ?? 0;
    minute = rationalToNumber(gpsTimeStamp[1]) ?? 0;
    second = rationalToNumber(gpsTimeStamp[2]) ?? 0;
  }

  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), hour, minute, second));
  return toIsoString(date);
}

function firstValidDate(values) {
  for (const value of values) {
    const iso = parseMetadataDate(value);
    if (iso) return iso;
  }
  return null;
}

function pickFromFields(exif, fieldNames) {
  return firstValidDate(fieldNames.map((name) => exif?.[name]));
}

function pickCompositeDates(exif) {
  const iptcTaken = combineDateAndTime(exif?.DateCreated, exif?.TimeCreated);
  if (iptcTaken) return iptcTaken;

  const iptcDigital = combineDateAndTime(exif?.DigitalCreationDate, exif?.DigitalCreationTime);
  if (iptcDigital) return iptcDigital;

  const gpsTaken = gpsTimestampToIso(exif?.GPSDateStamp, exif?.GPSTimeStamp);
  if (gpsTaken) return gpsTaken;

  return firstValidDate([exif?.DateCreated, exif?.DigitalCreationDate]);
}

function deepScanForDate(obj, seen = new WeakSet()) {
  if (obj == null || typeof obj !== "object") return null;
  if (seen.has(obj)) return null;
  seen.add(obj);

  if (Array.isArray(obj)) {
    for (const entry of obj) {
      const found = deepScanForDate(entry, seen);
      if (found) return found;
    }
    return null;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (DEEP_SCAN_KEY_PATTERN.test(key)) {
      const iso = parseMetadataDate(value);
      if (iso) return iso;
    }
  }

  for (const value of Object.values(obj)) {
    if (value != null && typeof value === "object") {
      const found = deepScanForDate(value, seen);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Extract the best available capture date from parsed exifr metadata.
 * Returns { takenAt, modifiedAt, source } where source identifies the winning field.
 */
export function extractTakenAt(exif) {
  if (!exif || typeof exif !== "object") {
    return { takenAt: null, modifiedAt: null, source: null };
  }

  const compositeTaken = pickCompositeDates(exif);

  const candidates = [
    ...(compositeTaken ? [{ field: "composite", value: compositeTaken }] : []),
    ...TAKEN_AT_FIELD_PRIORITY.map((field) => ({ field, value: exif[field] })),
    { field: "deepScan", value: deepScanForDate(exif) },
  ];

  let takenAt = null;
  let source = null;

  for (const { field, value } of candidates) {
    const iso = field === "composite" || field === "deepScan" ? value : parseMetadataDate(value);
    if (iso) {
      takenAt = iso;
      source = field;
      break;
    }
  }

  const modifiedAt =
    pickFromFields(exif, MODIFIED_AT_FIELD_PRIORITY) ??
    combineDateAndTime(exif?.DigitalCreationDate, exif?.DigitalCreationTime) ??
    takenAt;

  return { takenAt, modifiedAt, source };
}

/** Extract capture date from ffprobe format/stream tags (videos). */
export function extractVideoTakenAt(probeData) {
  const formatTags = probeData?.format?.tags ?? {};
  const streamTags = probeData?.streams?.[0]?.tags ?? {};

  const candidates = [
    formatTags["com.apple.quicktime.creationdate"],
    formatTags.creation_time,
    formatTags.date,
    streamTags["com.apple.quicktime.creationdate"],
    streamTags.creation_time,
    streamTags.date,
  ];

  return firstValidDate(candidates);
}
