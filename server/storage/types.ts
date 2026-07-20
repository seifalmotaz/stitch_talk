import "server-only";

import {
  type AllowedImageType,
  MAX_ATTACHMENT_BYTES,
  isAllowedImageType,
} from "@/types/uploads";

export * from "@/types/uploads";

export function assertValidUpload(input: {
  mimeType: string;
  byteSize: number;
}): asserts input is { mimeType: AllowedImageType; byteSize: number } {
  if (!isAllowedImageType(input.mimeType)) {
    throw new Error("Unsupported image type");
  }
  if (input.byteSize <= 0 || input.byteSize > MAX_ATTACHMENT_BYTES) {
    throw new Error("Image must be 8MB or smaller");
  }
}
