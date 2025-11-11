// services/geminiService.ts
import { ChatMessage, WardrobeItem } from "../types";

/* ---------- util: File -> dataURL (comprimido) ---------- */
async function fileToCompressedDataUrl(
  file: File,
  maxSide = 1024,
  quality = 0.8
): Promise<string> {
  const img = new Image();
  const blobUrl = URL.createObjectURL(file);
  img.src = blobUrl;
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("No se pudo cargar la imagen"));
  });

  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);

  const out = canvas.toDataURL("image/jpeg", quality);
  URL.revokeObjectURL(blobUrl);
  return out;
}

async function dataUrlToCompressedDataUrl(
  dataUrl: string,
  maxSide = 1024,
  quality = 0.8
): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], "img.jpg", { type: blob.type });
  return fileToCompressedDataUrl(file, maxSide, quality);
}

/* ---------- 1) Generar imagen de modelo ---------- */
export const generateModelImage = async (userImage: File): Promise<string> => {
  const userImageDataUrl = await fileToCompressedDataUrl(userImage, 1024, 0.8);

  const resp = await fetch("/api/model-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userImageDataUrl }),
  });

  if (!resp.ok) throw new Error(await resp.text());
  const { image } = await resp.json();
  return image; // dataURL
};

/* ---------- 2) Recomendación de outfit (JSON) ---------- */
export const getOutfitRecommendation = async (
  wardrobe: WardrobeItem[],
  chatHistory: ChatMessage[]
): Promise<{ outfit: string[]; reasoning: string }> => {
  const resp = await fetch("/api/outfit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wardrobe, chatHistory }),
  });

  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
};

/* ---------- 3) Generar imagen con prendas (enviando DataURLs) ---------- */
export const generateOutfitImage = async (
  modelImageUrl: string,
  garmentFiles: File[]
): Promise<string> => {
  // recomprime la base y limita tamaño
  const compactModel = await dataUrlToCompressedDataUrl(modelImageUrl, 1024, 0.8);
  const garmentDataUrls = await Promise.all(
    garmentFiles.slice(0, 5).map(f => fileToCompressedDataUrl(f, 1024, 0.8))
  );

  const resp = await fetch("/api/outfit-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelImageDataUrl: compactModel, garmentDataUrls }),
  });

  if (!resp.ok) throw new Error(await resp.text());
  const { image } = await resp.json();
  return image;
};

/* ---------- 4) Generar imagen con prendas (enviando URLs) ---------- */
/** Usa este método cuando quieras evitar CORS/canvas en el cliente.
 *  El servidor descargará las imágenes por URL.
 */
export const generateOutfitImageFromUrls = async (
  modelImageUrl: string,
  garmentUrls: string[]
): Promise<string> => {
  // si tu modelImageUrl es un dataURL muy grande y quieres recomprimir:
  // const compactModel = await dataUrlToCompressedDataUrl(modelImageUrl, 1024, 0.8);
  // En muchos casos puedes enviar directamente la URL/dataURL original:
  const compactModel = modelImageUrl;

  const resp = await fetch("/api/outfit-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelImageDataUrl: compactModel, garmentUrls }),
  });

  if (!resp.ok) throw new Error(await resp.text());
  const { image } = await resp.json();
  return image;
};
