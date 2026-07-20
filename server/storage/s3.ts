import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AllowedImageType } from "@/server/storage/types";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const bucket = required("S3_BUCKET");
const region = process.env.S3_REGION ?? "us-east-1";
const credentials = {
  accessKeyId: required("S3_ACCESS_KEY"),
  secretAccessKey: required("S3_SECRET_KEY"),
};
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== "false";

function createClient(endpoint: string) {
  return new S3Client({ endpoint, region, credentials, forcePathStyle });
}

const storageEndpoint = required("S3_ENDPOINT");
const storageClient = createClient(storageEndpoint);
const browserClient = createClient(
  process.env.S3_PUBLIC_ENDPOINT ?? storageEndpoint,
);

const extensionByType: Record<AllowedImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function createStorageKey(
  attachmentId: string,
  mimeType: AllowedImageType,
) {
  return `attachments/${attachmentId}.${extensionByType[mimeType]}`;
}

export async function createUploadUrl(input: {
  storageKey: string;
  mimeType: string;
  byteSize: number;
}) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: input.storageKey,
    ContentType: input.mimeType,
    ContentLength: input.byteSize,
  });
  return getSignedUrl(browserClient, command, { expiresIn: 5 * 60 });
}

export async function inspectObject(storageKey: string) {
  const metadata = await storageClient.send(
    new HeadObjectCommand({ Bucket: bucket, Key: storageKey }),
  );
  const sample = await storageClient.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Range: "bytes=0-15",
    }),
  );
  const bytes = sample.Body
    ? Buffer.from(await sample.Body.transformToByteArray())
    : Buffer.alloc(0);

  return {
    byteSize: metadata.ContentLength ?? 0,
    mimeType: metadata.ContentType ?? "",
    etag: metadata.ETag?.replaceAll('"', "") ?? null,
    signatureValid: hasImageSignature(bytes, metadata.ContentType ?? ""),
  };
}

export async function getObjectAsDataUrl(
  storageKey: string,
  mimeType: string,
) {
  const object = await storageClient.send(
    new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
  );
  if (!object.Body) throw new Error("Stored image has no body");
  const bytes = Buffer.from(await object.Body.transformToByteArray());
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

export async function createDownloadUrl(storageKey: string) {
  return getSignedUrl(
    browserClient,
    new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
    { expiresIn: 15 * 60 },
  );
}

export async function deleteStoredObject(storageKey: string) {
  await storageClient.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }),
  );
}

function hasImageSignature(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }
  if (mimeType === "image/png") {
    return (
      bytes.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ) && bytes.subarray(12, 16).toString("ascii") === "IHDR"
    );
  }
  if (mimeType === "image/gif") {
    const signature = bytes.subarray(0, 6).toString("ascii");
    return signature === "GIF87a" || signature === "GIF89a";
  }
  if (mimeType === "image/webp") {
    return (
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}
