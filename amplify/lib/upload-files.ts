const IMAGE_NAME_PATTERN = /\.(jpe?g|png|heic|heif)$/i;

export function isSelectableUploadFile(file: File): boolean {
  return file.type.startsWith("image/") || IMAGE_NAME_PATTERN.test(file.name);
}

export function filterSelectableFiles(files: Iterable<File>): File[] {
  return Array.from(files).filter(isSelectableUploadFile);
}

/**
 * Keep files newer than the archive's latest `takenAt`.
 * Uses lastModified (camera-roll picks on mobile are usually capture-ordered).
 */
export function filterFilesNewerThan(files: File[], sinceTakenAt: string | null): File[] {
  if (!sinceTakenAt) return files;

  const sinceMs = new Date(sinceTakenAt).getTime();
  if (Number.isNaN(sinceMs)) return files;

  return files.filter((file) => file.lastModified > sinceMs);
}

export function formatTakenAtLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
