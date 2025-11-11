/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";
import { ChatMessage, WardrobeItem } from "../types";

const fileToPart = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
};

const dataUrlToParts = (dataUrl: string) => {
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    return { mimeType: mimeMatch[1], data: arr[1] };
}

const dataUrlToPart = (dataUrl: string) => {
    const { mimeType, data } = dataUrlToParts(dataUrl);
    return { inlineData: { mimeType, data } };
}

const handleApiResponse = (response: GenerateContentResponse): string => {
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `La solicitud fue bloqueada. Razón: ${blockReason}. ${blockReasonMessage || ''}`;
        throw new Error(errorMessage);
    }

    // Find the first image part in any candidate
    for (const candidate of response.candidates ?? []) {
        const imagePart = candidate.content?.parts?.find(part => part.inlineData);
        if (imagePart?.inlineData) {
            const { mimeType, data } = imagePart.inlineData;
            return `data:${mimeType};base64,${data}`;
        }
    }

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        const errorMessage = `La generación de la imagen se detuvo inesperadamente. Razón: ${finishReason}. Esto suele estar relacionado con la configuración de seguridad.`;
        throw new Error(errorMessage);
    }
    const textFeedback = response.text?.trim();
    const errorMessage = `El modelo de IA no devolvió una imagen. ` + (textFeedback ? `El modelo respondió con texto: "${textFeedback}"` : "Esto puede ocurrir debido a los filtros de seguridad o si la solicitud es demasiado compleja. Por favor, prueba con una imagen diferente.");
    throw new Error(errorMessage);
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const generateModelImage = async (userImage: File): Promise<string> => {
    const userImagePart = await fileToPart(userImage);
    const prompt = "Eres un IA experta en fotografía de moda. Transforma a la persona en esta imagen en una foto de modelo de moda de cuerpo entero, adecuada para un sitio web de comercio electrónico. Si solo se proporciona una cara, genera un modelo de moda de cuerpo entero realista que preserve los rasgos faciales y la identidad de la persona, colocándola en una pose de modelo estándar y relajada. El fondo debe ser un fondo de estudio limpio y neutro (gris claro, #f0f0f0). La persona debe tener una expresión de modelo neutra y profesional. Preserva la identidad, los rasgos únicos y el tipo de cuerpo de la persona. La imagen final debe ser fotorrealista. Devuelve ÚNICAMENTE la imagen final.";
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [userImagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    return handleApiResponse(response);
};

export const getOutfitRecommendation = async (
    wardrobe: WardrobeItem[], 
    chatHistory: ChatMessage[]
): Promise<{ outfit: string[], reasoning: string }> => {
    const model = 'gemini-2.5-pro';
    const availableItems = wardrobe.map(item => `'${item.name}' (categoría: ${item.category})`).join(', ');

    const historyForPrompt = chatHistory
        .map(msg => {
            if (msg.role === 'user') return `Usuario: ${msg.content}`;
            if (typeof msg.content === 'string') return `Estilista: ${msg.content}`;
            return `Estilista: [Se ha generado una imagen de atuendo]`; // Placeholder for image responses
        }).join('\n');

    const systemInstruction = `Eres 'What2Wear', un experto estilista de moda IA. Tu objetivo es crear atuendos con estilo para el usuario basados en la ropa que posee y sus peticiones.

      Aquí están las prendas disponibles en el armario del usuario:
      [${availableItems}]
      
      Basado en la petición del usuario y el historial del chat, debes recomendar un atuendo completo.
      - Un atuendo completo suele consistir en una parte de arriba y una de abajo, o un vestido. También puedes añadir prendas de abrigo y zapatos.
      - DEBES USAR ÚNICAMENTE los nombres de las prendas tal como aparecen en la lista del armario. No inventes nuevas prendas.
      - Proporciona una explicación breve y amigable de tus elecciones.
      - Debes responder en el formato JSON solicitado.
      - Sé creativo/a y ten un gran sentido del estilo. Si el usuario pide algo vago como 'algo moderno', haz una elección interesante.`;

    const contents = `Este es el historial de la conversación:\n${historyForPrompt}\n\nBasado en el último mensaje del usuario, por favor sugiere un nuevo atuendo.`;

    const response = await ai.models.generateContent({
        model,
        contents,
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    outfit: {
                        type: Type.ARRAY,
                        description: "Un array de strings, donde cada string es el nombre exacto de una prenda del armario para incluir en el atuendo.",
                        items: { type: Type.STRING }
                    },
                    reasoning: {
                        type: Type.STRING,
                        description: "Una explicación corta, amigable y con estilo de por qué se eligió este atuendo."
                    }
                },
                required: ['outfit', 'reasoning'],
            },
        },
    });

    const jsonStr = response.text.trim();
    // A simple validation
    if (!jsonStr.startsWith('{') || !jsonStr.endsWith('}')) {
        throw new Error('La IA devolvió una respuesta JSON no válida.');
    }
    return JSON.parse(jsonStr);
};


export const generateOutfitImage = async (modelImageUrl: string, garmentFiles: File[]): Promise<string> => {
    const modelImagePart = dataUrlToPart(modelImageUrl);
    const garmentParts = await Promise.all(garmentFiles.map(file => fileToPart(file)));

    const prompt = `Eres un experto en prueba de ropa virtual con IA. Se te proporcionará una 'imagen de modelo' y varias 'imágenes de prendas'. Tu tarea es crear una nueva imagen fotorrealista donde la persona de la 'imagen de modelo' lleva TODAS las prendas de las 'imágenes de prendas' para formar un atuendo completo.

    **Reglas Cruciales:**
    1.  **Capas Lógicas:** Coloca las prendas en capas correctamente (p. ej., chaqueta sobre la camisa, camisa sobre los pantalones).
    2.  **Reemplazo Completo:** DEBES QUITAR y REEMPLAZAR completamente cualquier ropa existente en la persona de la 'imagen de modelo' con las nuevas prendas.
    3.  **Preservar Modelo y Fondo:** La cara, el pelo, la forma del cuerpo, la pose de la persona y todo el fondo de la 'imagen de modelo' DEBEN permanecer sin cambios.
    4.  **Ajuste Realista:** Ajusta las nuevas prendas de forma realista a la persona, adaptándolas a su pose con pliegues, sombras e iluminación naturales.
    5.  **Resultado:** Devuelve ÚNICAMENTE la imagen final editada. No incluyas ningún texto.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [modelImagePart, ...garmentParts, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    return handleApiResponse(response);
};