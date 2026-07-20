export const MAX_ATTACHMENTS_PER_MESSAGE = 4;
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export function isAllowedImageType(value: string): value is AllowedImageType {
  return ALLOWED_IMAGE_TYPES.includes(value as AllowedImageType);
}
