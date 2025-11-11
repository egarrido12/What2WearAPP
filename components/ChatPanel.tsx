/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WardrobeItem, ChatMessage, Outfit } from '../types';
import { ShirtIcon, SparklesIcon, MessageCircleIcon } from './icons';
import WardrobeModal from './WardrobeModal';

interface ChatPanelProps {
    chatHistory: ChatMessage[];
    onSendMessage: (prompt: string) => void;
    isLoading: boolean;
    wardrobe: WardrobeItem[];
    onAddToWardrobe: (item: WardrobeItem) => void;
    error: string | null;
    chatContainerRef: React.RefObject<HTMLDivElement>;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ chatHistory, onSendMessage, isLoading, wardrobe, onAddToWardrobe, error, chatContainerRef }) => {
    const [prompt, setPrompt] = useState('');
    const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
    const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
    
    const quickPrompts = [
        "Hazlo más formal.",
        "Algo para salir de noche.",
        "¿Qué me pongo en un día frío?",
        "Dame una opción con más color."
    ];

    const handleSend = () => {
        if (prompt.trim() && !isLoading) {
            onSendMessage(prompt.trim());
            setPrompt('');
        }
    };
    
    const handleQuickPrompt = (p: string) => {
        if (!isLoading) {
            onSendMessage(p);
        }
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    const renderMessageContent = (content: string | Outfit) => {
        if (typeof content === 'string') {
            return <p>{content}</p>;
        }
        
        // Render Outfit object
        return (
            <div className="bg-gray-200/50 p-2 rounded-lg">
                <img src={content.imageUrl} alt="Generated outfit" className="rounded-md w-full aspect-[2/3] object-cover" />
                <div className="mt-2 text-xs">
                    <p className="font-bold mb-1">Prendas:</p>
                    <ul className="grid grid-cols-2 gap-1">
                        {content.items.map(item => (
                            <li key={item.id} className="flex items-center gap-1.5">
                                <img src={item.url} alt={item.name} className="w-5 h-5 rounded-sm object-cover" />
                                <span className="truncate">{item.name}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    };

    return (
        <aside 
            className={`absolute md:relative md:flex-shrink-0 bottom-0 right-0 h-auto md:h-full w-full md:w-1/3 md:max-w-sm bg-white/80 backdrop-blur-md flex flex-col border-t md:border-t-0 md:border-l border-gray-200/60 transition-transform duration-500 ease-in-out ${isSheetCollapsed ? 'translate-y-[calc(100%-4.5rem)]' : 'translate-y-0'} md:translate-y-0`}
            style={{ transitionProperty: 'transform' }}
        >
            <button 
                onClick={() => setIsSheetCollapsed(!isSheetCollapsed)} 
                className="md:hidden w-full h-8 flex items-center justify-center bg-gray-100/50"
                aria-label={isSheetCollapsed ? 'Expandir panel' : 'Contraer panel'}
            >
                {isSheetCollapsed ? <MessageCircleIcon className="w-6 h-6 text-gray-500" /> : <span className="font-serif text-gray-700">Chat con Estilista</span>}
            </button>
            <div className="p-4 md:p-6 pb-4 flex-shrink-0 border-b border-gray-200/80">
                <h2 className="text-xl font-serif tracking-wider text-gray-800">Estilista IA</h2>
                <p className="text-sm text-gray-500 mt-1">Chatea con tu estilista personal para crear el look perfecto.</p>
            </div>
            
            <div ref={chatContainerRef} className="overflow-y-auto flex-grow p-4 md:p-6 space-y-4">
                {chatHistory.map(msg => (
                    <div key={msg.id} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-5 h-5 text-white"/></div>}
                        <div className={`p-3 rounded-2xl max-w-[85%] text-sm ${msg.role === 'user' ? 'bg-gray-900 text-white rounded-br-lg' : 'bg-gray-100 text-gray-800 rounded-bl-lg'}`}>
                            {renderMessageContent(msg.content)}
                        </div>
                    </div>
                ))}
            </div>

            {error && (
                <div className="p-4 md:px-6">
                    <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm" role="alert">
                        <p>{error}</p>
                    </div>
                </div>
            )}
            
            <div className="p-4 md:p-6 border-t border-gray-200/80 bg-white/50">
                <div className="flex flex-wrap gap-2 mb-3">
                    {quickPrompts.map(p => (
                        <button key={p} onClick={() => handleQuickPrompt(p)} disabled={isLoading} className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-200/70 rounded-full hover:bg-gray-300 disabled:opacity-50">
                            {p}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsWardrobeOpen(true)} className="p-2.5 bg-gray-200/80 rounded-md hover:bg-gray-300/80 transition-colors">
                        <ShirtIcon className="w-5 h-5 text-gray-700"/>
                    </button>
                    <input 
                        type="text" 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ej: 'Un look profesional para el trabajo'"
                        className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-800 focus:outline-none"
                        disabled={isLoading}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={isLoading || !prompt.trim()}
                        className="p-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-400 transition-colors"
                    >
                        Enviar
                    </button>
                </div>
            </div>
            
            <WardrobeModal 
                isOpen={isWardrobeOpen}
                onClose={() => setIsWardrobeOpen(false)}
                wardrobe={wardrobe}
                onAddToWardrobe={onAddToWardrobe}
                isLoading={isLoading}
            />
        </aside>
    );
};

export default ChatPanel;