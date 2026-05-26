export default function getMediaType(contentType = "") {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType === "image/gif") return "gif";
  return "unknown";
}
