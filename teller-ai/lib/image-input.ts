export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function parseImageDataUrl(value: unknown) {
  if (typeof value !== "string") return null;

  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]*={0,2})$/i);
  if (
    !match ||
    match[2].length % 4 !== 0 ||
    match[2].length > (MAX_IMAGE_BYTES * 4) / 3
  ) {
    return null;
  }

  const mediaType = match[1].toLowerCase();
  if (!SUPPORTED_IMAGE_TYPES.has(mediaType)) return null;

  const bytes = Buffer.from(match[2], "base64");
  if (
    bytes.length === 0 ||
    bytes.length > MAX_IMAGE_BYTES ||
    bytes.toString("base64") !== match[2]
  ) {
    return null;
  }

  return { dataUrl: value, mediaType, bytes };
}
