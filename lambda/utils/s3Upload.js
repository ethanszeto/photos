import { PutObjectCommand } from "@aws-sdk/client-s3";

export default async function upload(s3, bucket, key, body, contentType) {
  return s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}
