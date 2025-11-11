/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Helper to convert image URL to a File object using the Fetch API for better CORS handling.
export const urlToFile = async (url: string, filename: string): Promise<File> => {
    try {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText} from ${url}`);
        }
        const blob = await response.blob();
        const mimeType = blob.type;
        // Add a fallback extension if the filename doesn't have one
        const finalFilename = filename.includes('.') ? filename : `${filename}.${mimeType.split('/')[1] || 'png'}`;
        return new File([blob], finalFilename, { type: mimeType });
    } catch (error) {
        console.error(`[Fetch Error] Failed to load and convert wardrobe item from URL: ${url}.`, error);
        throw new Error(`No se pudo cargar la imagen desde la URL. Suele ser un problema de CORS. Revisa la consola de desarrollador para más detalles.`);
    }
};