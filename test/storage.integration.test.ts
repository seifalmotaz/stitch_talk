import { afterEach, describe, expect, it } from "vitest";
import {
  createStorageKey,
  createUploadUrl,
  deleteStoredObject,
  inspectObject,
} from "@/server/storage/s3";

const keys: string[] = [];

afterEach(async () => {
  await Promise.all(keys.splice(0).map((key) => deleteStoredObject(key)));
});

describe("S3-compatible image storage", () => {
  it("presigns, stores, and verifies a private PNG", async () => {
    const bytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);
    const key = createStorageKey(crypto.randomUUID(), "image/png");
    keys.push(key);
    const url = await createUploadUrl({
      storageKey: key,
      mimeType: "image/png",
      byteSize: bytes.length,
    });
    const response = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "image/png" },
      body: bytes,
    });
    expect(response.ok).toBe(true);

    await expect(inspectObject(key)).resolves.toMatchObject({
      byteSize: bytes.length,
      mimeType: "image/png",
      signatureValid: true,
    });
  });
});
