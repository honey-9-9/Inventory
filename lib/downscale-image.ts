/**
 * Shrinks a photo in the browser before it is uploaded.
 *
 * A modern phone camera produces 4-12MB files, which are slow to send over
 * Wi-Fi and pointless for a thumbnail on a card. Resizing client-side keeps
 * uploads small and fast, and means the request comfortably fits inside the
 * server action body limit.
 *
 * If anything goes wrong (an exotic format, a browser without canvas support)
 * the original file is returned rather than failing the upload.
 */

const MAX_EDGE_PX = 1280;
const JPEG_QUALITY = 0.82;

export async function downscaleImage(file: File): Promise<File> {
  // GIFs may be animated; re-encoding would flatten them to a single frame.
  if (file.type === "image/gif") return file;
  if (typeof document === "undefined") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));

    // Already small enough - sending the original avoids a needless re-encode.
    if (scale === 1 && file.size <= 1_000_000) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );

    if (!blob || blob.size >= file.size) return file;

    return new File([blob], "photo.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
