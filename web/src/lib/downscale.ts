/**
 * Shrink an image in the browser before it is uploaded.
 *
 * Photos go into the config blob as data URLs, so an unresized 4MB phone
 * photo would blow the row limit and slow every page that renders it. A
 * 1000px long edge at quality 0.82 is indistinguishable on a product card.
 */
export async function downscaleImage(
  file: File,
  maxEdge = 1000,
  quality = 0.82,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");

  // White ground, so transparent PNGs do not become black rectangles.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", quality);
}
