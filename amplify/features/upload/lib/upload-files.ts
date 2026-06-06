export { isSelectableUploadFile } from "@/lib/media-types";

import { isSelectableUploadFile } from "@/lib/media-types";

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
