/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface WardrobeItem {
  id: string;
  name: string;
  url: string;
  category: 'top' | 'bottom' | 'outerwear' | 'shoes' | 'dress' | 'accessory';
}

// Represents a generated outfit image with its corresponding items
export interface Outfit {
  imageUrl: string;
  items: WardrobeItem[];
}

// FIX: Define missing OutfitLayer type for components/CurrentOutfitPanel.tsx.
export interface OutfitLayer {
  garment?: WardrobeItem;
}

export type ChatMessageContent = string | Outfit;

export interface ChatMessage {
  role: 'user' | 'model';
  content: ChatMessageContent;
  id: string;
}