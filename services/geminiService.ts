/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { ChatMessage, WardrobeItem } from "../types";

/**
 * Convierte un File → DataURL
 */
const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (e) => reject(e);
  });

/* ============================================================
   1) generateModelImage
   ------------------------------------------------------------
   Antes → llamaba GoogleGenAI desde el navegador
   Ahora → hace fetch a /api/model-image
   ============================================================ */
export const generateModelImage = async (userImage: File): Promise<string> => {
  const userImageDataUrl = await fileToDataUrl(userImage);

  const resp = await fetch("/api/model-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userImageDataUrl }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || "Error generando modelo");
  }

  const { image } = await resp.json();
  return image; // dataUrl
};

/* ============================================================
   2) getOutfitRecommendation
   ------------------------------------------------------------
   Antes → GoogleGenAI directo
   Ahora → /api/outfit
   ============================================================ */
export const getOutfitRecommendation = async (
  wardrobe: WardrobeItem[],
  chatHistory: ChatMessage[]
): Promise<{ outfit: string[]; reasoning: string }> => {
  const resp = await fetch("/api/outfit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wardrobe, chatHistory }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || "Error generando outfit");
  }

  return resp.json();
};

/* ============================================================
   3) generateOutfitImage
   ------------------------------------------------------------
   Antes → GoogleGenAI directo
   Ahora → /api/outfit-image
   ============================================================ */
export const generateOutfitImage = async (
  modelImageUrl: string,
  garmentFiles: File[]
): Promise<string> => {
  // Convert garments to dataURL
  const garmentDataUrls = await Promise.all(
    garmentFiles.map((file) => fileToDataUrl(file))
  );

  const resp = await fetch("/api/outfit-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelImageDataUrl: modelImageUrl, garmentDataUrls }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || "Error generando outfit con imagen");
  }

  const { image } = await resp.json();
  return image;
};
