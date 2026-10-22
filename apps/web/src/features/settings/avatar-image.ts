// Turns a picked photo into an avatar file (SPEC §7.2): centre-cropped to a
// square, resized to 256×256 and re-encoded, which drops EXIF and other
// metadata. WebP where the browser can encode it, JPEG otherwise; at most
// 300 KB, the bucket's limit.

export const AVATAR_SIZE = 256;
const MAX_BYTES = 300 * 1024;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

export class AvatarImageError extends Error {}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });

export async function toAvatarFile(file: File): Promise<{ blob: Blob; extension: "webp" | "jpg" }> {
  if (!file.type.startsWith("image/") || file.size > MAX_INPUT_BYTES) {
    throw new AvatarImageError("unsupported");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new AvatarImageError("unreadable");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new AvatarImageError("unsupported");
  context.imageSmoothingQuality = "high";
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );
  bitmap.close();

  for (const quality of [0.86, 0.72, 0.58]) {
    const webp = await toBlob(canvas, "image/webp", quality);
    // Browsers that can't encode WebP silently return PNG.
    const [blob, extension] =
      webp?.type === "image/webp"
        ? [webp, "webp" as const]
        : [await toBlob(canvas, "image/jpeg", quality), "jpg" as const];
    if (blob && blob.size <= MAX_BYTES) return { blob, extension };
  }
  throw new AvatarImageError("too large");
}
