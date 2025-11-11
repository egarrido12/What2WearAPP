export function dataUrlToPart(dataUrl: string) {
  const arr = dataUrl.split(",");
  if (arr.length < 2) throw new Error("Invalid data URL");
  const mimeMatch = arr[0].match(/:(.*?);/);
  if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type");
  return { inlineData: { mimeType: mimeMatch[1], data: arr[1] } };
}

export function handleImageResponse(resp: any): string {
  if (resp?.promptFeedback?.blockReason) {
    const { blockReason, blockReasonMessage } = resp.promptFeedback;
    throw new Error(`Bloqueado: ${blockReason}. ${blockReasonMessage || ""}`);
  }
  for (const c of resp.candidates ?? []) {
    const img = c.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
    if (img?.mimeType && img?.data) {
      return `data:${img.mimeType};base64,${img.data}`;
    }
  }
  const finish = resp.candidates?.[0]?.finishReason;
  if (finish && finish !== "STOP") {
    throw new Error(`La generación se detuvo: ${finish}`);
  }
  const text = resp.text?.trim?.();
  throw new Error(
    `El modelo no devolvió imagen.` + (text ? ` Texto: "${text}"` : "")
  );
}

