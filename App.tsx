/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StartScreen from './components/StartScreen';
import Canvas from './components/Canvas';
import ChatPanel from './components/ChatPanel';
import { getOutfitRecommendation, generateOutfitImage } from './services/geminiService';
import { WardrobeItem, ChatMessage, Outfit } from './types';
import { defaultWardrobe } from './wardrobe';
import Footer from './components/Footer';
import { getFriendlyErrorMessage } from './lib/utils';
import { urlToFile } from './lib/urlToFile';

const App: React.FC = () => {
  const [modelImageUrl, setModelImageUrl] = useState<string | null>(null);
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>(defaultWardrobe);
  const isRequestPending = useRef(false);

  // Auto-scroll chat to bottom
  const chatContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);


  const handleModelFinalized = (url: string) => {
    setModelImageUrl(url);
    setDisplayImageUrl(url);
    // Kick off the conversation with a welcome message and the first recommendation
    const welcomeMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'model',
      content: "¡Bienvenido/a a tu sesión de estilismo personal! He preparado un primer look para ti. ¿Qué te parece? ¡No dudes en pedir algo diferente!",
    };
    setChatHistory([welcomeMessage]);
    handleSendMessage("Muéstrame un atuendo casual y moderno.", [welcomeMessage]);
  };

  const handleStartOver = () => {
    setModelImageUrl(null);
    setDisplayImageUrl(null);
    setChatHistory([]);
    setIsLoading(false);
    setLoadingMessage('');
    setError(null);
    setWardrobe(defaultWardrobe);
    isRequestPending.current = false;
  };

  const handleSendMessage = useCallback(async (prompt: string, historyOverride?: ChatMessage[]) => {
    if (!modelImageUrl || isLoading || isRequestPending.current) return;

    isRequestPending.current = true;
    setError(null);

    const currentHistory = historyOverride || chatHistory;

    // Add user's message to chat
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: prompt,
    };
    setChatHistory(prev => [...prev, userMessage]);
    
    setIsLoading(true);
    setLoadingMessage('Buscando el atuendo perfecto...');

    try {
      // 1. Get outfit recommendation (JSON) from Gemini
      const recommendation = await getOutfitRecommendation(wardrobe, [...currentHistory, userMessage]);
      
      const reasoningMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'model',
        content: recommendation.reasoning,
      };
      setChatHistory(prev => [...prev, reasoningMessage]);
      setLoadingMessage('Dando vida al look...');
      
      // 2. Find the wardrobe items and convert their URLs to File objects
      const outfitItems = recommendation.outfit
        .map(itemName => wardrobe.find(item => item.name === itemName))
        .filter((item): item is WardrobeItem => !!item);

      if (outfitItems.length === 0) {
        throw new Error("Lo siento, no pude encontrar ninguna prenda en el armario que coincida con esa petición.");
      }
      
      const garmentFiles = await Promise.all(
        outfitItems.map(item => urlToFile(item.url, item.name))
      );

      // 3. Generate the outfit image
      const newImageUrl = await generateOutfitImage(modelImageUrl, garmentFiles);
      
      const outfitResult: Outfit = {
        imageUrl: newImageUrl,
        items: outfitItems,
      };

      const outfitMessage: ChatMessage = {
        id: `msg-${Date.now() + 2}`,
        role: 'model',
        content: outfitResult,
      };
      
      setChatHistory(prev => [...prev, outfitMessage]);
      setDisplayImageUrl(newImageUrl);

    } catch (err) {
      const friendlyError = getFriendlyErrorMessage(err, 'Error al crear el atuendo');
      setError(friendlyError);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now() + 3}`,
        role: 'model',
        content: `¡Vaya! Tuve problemas con esa petición. ${friendlyError}`,
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
      isRequestPending.current = false;
    }
  }, [modelImageUrl, isLoading, chatHistory, wardrobe]);

  const handleAddToWardrobe = (item: WardrobeItem) => {
    setWardrobe(prev => {
        if (prev.find(i => i.id === item.id)) {
            return prev;
        }
        return [...prev, item];
      });
  };

  const viewVariants = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -15 },
  };

  return (
    <div className="font-sans">
      <AnimatePresence mode="wait">
        {!modelImageUrl ? (
          <motion.div
            key="start-screen"
            className="w-screen min-h-screen flex items-start sm:items-center justify-center bg-gray-50 p-4 pb-20"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <StartScreen onModelFinalized={handleModelFinalized} />
          </motion.div>
        ) : (
          <motion.div
            key="main-app"
            className="relative flex flex-col h-screen bg-white overflow-hidden"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <main className="flex-grow relative flex flex-col md:flex-row overflow-hidden">
              <div className="w-full h-full flex-grow flex items-center justify-center bg-white pb-16 relative">
                <Canvas 
                  displayImageUrl={displayImageUrl}
                  onStartOver={handleStartOver}
                  isLoading={isLoading}
                  loadingMessage={loadingMessage}
                />
              </div>
              
              <ChatPanel 
                chatHistory={chatHistory} 
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                wardrobe={wardrobe}
                onAddToWardrobe={handleAddToWardrobe}
                error={error}
                chatContainerRef={chatContainerRef}
              />
            </main>
          </motion.div>
        )}
      </AnimatePresence>
      <Footer isOnDressingScreen={!!modelImageUrl} />
    </div>
  );
};

export default App;