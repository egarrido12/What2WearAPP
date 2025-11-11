/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import type { WardrobeItem } from '../types';
import { UploadCloudIcon, XIcon } from './icons';
import { AnimatePresence, motion } from 'framer-motion';

interface WardrobeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToWardrobe: (item: WardrobeItem) => void;
  isLoading: boolean;
  wardrobe: WardrobeItem[];
}

const WardrobeModal: React.FC<WardrobeModalProps> = ({ isOpen, onClose, onAddToWardrobe, isLoading, wardrobe }) => {
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) {
                setError('Por favor, selecciona un archivo de imagen.');
                return;
            }
            const customGarmentInfo: WardrobeItem = {
                id: `custom-${Date.now()}`,
                name: file.name,
                url: URL.createObjectURL(file),
                // Simple category detection based on filename, could be improved
                category: file.name.toLowerCase().includes('dress') ? 'dress' : 
                          file.name.toLowerCase().includes('jacket') ? 'outerwear' :
                          file.name.toLowerCase().includes('jeans') || file.name.toLowerCase().includes('pants') || file.name.toLowerCase().includes('skirt') ? 'bottom' :
                          'top'
            };
            onAddToWardrobe(customGarmentInfo);
        }
    };

  return (
    <AnimatePresence>
        {isOpen && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-center justify-center p-4"
            >
                <motion.div
                    initial={{ scale: 0.95, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl"
                >
                    <div className="flex items-center justify-between p-4 border-b">
                        <h2 className="text-2xl font-serif tracking-wider text-gray-800">Mi Armario</h2>
                        <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800">
                            <XIcon className="w-6 h-6"/>
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                            {wardrobe.map((item) => (
                                <div
                                key={item.id}
                                className="relative aspect-square border rounded-lg overflow-hidden group"
                                >
                                <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p className="text-white text-xs font-bold text-center p-1">{item.name}</p>
                                </div>
                                </div>
                            ))}
                            <label htmlFor="custom-garment-upload" className={`relative aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-500 transition-colors ${isLoading ? 'cursor-not-allowed bg-gray-100' : 'hover:border-gray-400 hover:text-gray-600 cursor-pointer'}`}>
                                <UploadCloudIcon className="w-6 h-6 mb-1"/>
                                <span className="text-xs text-center">Subir</span>
                                <input id="custom-garment-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp, image/avif, image/heic, image/heif" onChange={handleFileChange} disabled={isLoading}/>
                            </label>
                        </div>
                        {wardrobe.length === 0 && (
                            <p className="text-center text-sm text-gray-500 mt-4">Las prendas que subas aparecerán aquí.</p>
                        )}
                        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
                    </div>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
  );
};

export default WardrobeModal;