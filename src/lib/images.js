"use client";

/**
 * Shrinking photos before they leave the browser.
 *
 * Vercel rejects request bodies over about 4.5MB before the app ever runs, so
 * a phone photo of a page — routinely 3–8MB — used to die as a blank
 * "Something went wrong". A 2200px JPEG is more than the model needs to read
 * handwriting, at a tenth of the size.
 */
const TARGET_BYTES = 3 * 1024 * 1024;
const MAX_DIMENSION = 2200;

export async function shrinkImage(file) {
  if (!file.type.startsWith("image/") || file.size <= TARGET_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    // HEIC and friends may not decode in this browser; send the original and
    // let the server say what it thinks.
    return file;
  }
}
