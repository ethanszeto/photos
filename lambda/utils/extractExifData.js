import exifr from "exifr";
import { EXIF_PARSE_OPTIONS, extractTakenAt, parseMetadataDate } from "./extractTakenAt.js";

export default async function extractExifData(buffer) {
  try {
    const exif = await exifr.parse(buffer, EXIF_PARSE_OPTIONS);

    if (!exif) {
      return {
        takenAt: null,
        modifiedAt: null,
        metadata: {},
      };
    }

    const { takenAt, modifiedAt, source } = extractTakenAt(exif);

    return {
      takenAt,
      modifiedAt,
      metadata: {
        time: {
          takenAt: takenAt ?? null,
          createdAt: parseMetadataDate(exif.CreateDate),
          modifiedAt: modifiedAt ?? null,
          digitizedAt: parseMetadataDate(exif.DateTimeDigitized ?? exif.CreateDate),
          offsetTime: exif.OffsetTimeOriginal ?? exif.OffsetTime ?? null,
          subSecTime: exif.SubSecTimeOriginal ?? exif.SubSecTime ?? null,
          source: source ?? null,
          iptcDateCreated: parseMetadataDate(exif.DateCreated),
          iptcTimeCreated: exif.TimeCreated ?? null,
          gpsDateStamp: exif.GPSDateStamp ?? null,
        },
        gps: {
          latitude: exif.latitude ?? null,
          longitude: exif.longitude ?? null,
          altitude: exif.GPSAltitude ?? null,
          direction: exif.GPSImgDirection ?? null,
        },
        device: {
          make: exif.Make ?? null,
          model: exif.Model ?? null,
          software: exif.Software ?? null,
          owner: exif.OwnerName ?? null,
          serialNumber: exif.BodySerialNumber ?? null,
        },
        camera: {
          iso: exif.ISO ?? null,
          focalLength: exif.FocalLength ?? null,
          fNumber: exif.FNumber ?? null,
          exposureTime: exif.ExposureTime ?? null,
          exposureProgram: exif.ExposureProgram ?? null,
          whiteBalance: exif.WhiteBalance ?? null,
          flash: exif.Flash ?? null,
          meteringMode: exif.MeteringMode ?? null,
          exposureCompensation: exif.ExposureCompensation ?? null,
        },
        geometry: {
          width: exif.ExifImageWidth ?? null,
          height: exif.ExifImageHeight ?? null,
          orientation: exif.Orientation ?? null,
          colorSpace: exif.ColorSpace ?? null,
          bitsPerSample: exif.BitsPerSample ?? null,
        },
        apple: {
          livePhotoIdentifier: exif.BurstUUID ?? null,
          livePhotoIndex: exif.LivePhotoVideoIndex ?? null,
          sceneType: exif.SceneCaptureType ?? null,
          hdrGainMap: exif.HDRGainMapVersion ?? null,
          lensModel: exif.LensModel ?? null,
        },
        editing: {
          software: exif.Software ?? null,
          processingSoftware: exif.ProcessingSoftware ?? null,
          history: exif.History ?? null,
          profileName: exif.ProfileName ?? null,
        },
        media: {
          format: exif.FileType ?? null,
          mimeType: exif.MIMEType ?? null,
          duration: exif.Duration ?? null,
          frameRate: exif.FrameRate ?? null,
          codec: exif.Codec ?? null,
          bitrate: exif.Bitrate ?? null,
          rotation: exif.Rotation ?? null,
        },
      },
    };
  } catch (error) {
    console.error("EXIF extraction failed:", error);

    return {
      takenAt: null,
      modifiedAt: null,
      metadata: {},
    };
  }
}
