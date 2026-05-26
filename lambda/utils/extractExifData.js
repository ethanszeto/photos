import exifr from "exifr";

export default async function extractExifData(buffer) {
  try {
    const exif = await exifr.parse(buffer, {
      tiff: true,
      ifd0: true,
      exif: true,
      gps: true,
      xmp: true,
      icc: true,
    });

    if (!exif) {
      return {
        takenAt: null,
        modifiedAt: null,
        metadata: {},
      };
    }

    // Best possible "taken at" date
    const takenDate = exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate || null;

    const modifiedDate = exif.ModifyDate || null;

    return {
      takenAt: takenDate ? new Date(takenDate).toISOString() : null,

      modifiedAt: modifiedDate ? new Date(modifiedDate).toISOString() : null,

      metadata: {
        time: {
          takenAt: exif.DateTimeOriginal ? new Date(exif.DateTimeOriginal).toISOString() : null,
          createdAt: exif.CreateDate ? new Date(exif.CreateDate).toISOString() : null,
          modifiedAt: exif.ModifyDate ? new Date(exif.ModifyDate).toISOString() : null,
          offsetTime: exif.OffsetTimeOriginal ?? null,
          subSecTime: exif.SubSecTimeOriginal ?? null,
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
