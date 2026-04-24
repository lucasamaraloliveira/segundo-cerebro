'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Note } from '@/lib/types';
import { db, auth } from '@/lib/firebase';
import { doc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { X, Send, Brain, Loader2, Info, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function SpecialistChat() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const q = query(collection(db, 'notes'), where('userId', '==', currentUser.uid));
        const unsubscribeNotes = onSnapshot(q, (snapshot) => {
          const notesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Note[];
          setNotes(notesData);
        });
        return () => unsubscribeNotes();
      } else {
        setNotes([]);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const notesWithoutEmbeddings = notes.filter(n => !n.embedding);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isLoading]);

  // Listen for global open events (for mobile nav integration)
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-specialist-chat', handleOpen);
    return () => window.removeEventListener('open-specialist-chat', handleOpen);
  }, []);

  const handleIndexNotes = async () => {
    if (isIndexing || notesWithoutEmbeddings.length === 0) return;
    setIsIndexing(true);
    setIndexProgress(10);

    try {
      const texts = notesWithoutEmbeddings.map(n => `${n.title}\n${n.content}`);
      const res = await fetch('/api/ai/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts })
      });
      const data = await res.json();
      
      if (data.embeddings && Array.isArray(data.embeddings)) {
        setIndexProgress(50);
        for (let i = 0; i < notesWithoutEmbeddings.length; i++) {
          const note = notesWithoutEmbeddings[i];
          const embedding = data.embeddings[i];
          if (embedding) {
            const noteRef = doc(db, 'notes', note.id);
            await updateDoc(noteRef, { embedding });
          }
        }
        setIndexProgress(100);
      }
    } catch (e) {
      console.error('Error batch indexing notes:', e);
    } finally {
      setTimeout(() => {
        setIsIndexing(false);
        setIndexProgress(0);
      }, 1000);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryText.trim() || isLoading) return;

    const userMessage = queryText.trim();
    setQueryText('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage, notes })
      });
      const data = await res.json();

      if (data.text) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.text,
          sources: data.sources
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao processar consulta. Tente novamente.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Botão Flutuante Responsivo */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-[100] w-14 h-14 bg-[#FF4F00] text-[var(--accent-foreground)] border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hidden md:flex items-center justify-center hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
      >
        {isOpen ? <X size={24} /> : <Brain size={24} />}
      </button>

      {isOpen && (
        <>
          {/* Backdrop apenas para Mobile */}
          <div 
            className="fixed inset-0 bg-black/40 z-[90] md:hidden animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal / Bottom Sheet Responsivo */}
          <div className={`
            fixed z-[100] bg-[var(--background)] text-[var(--foreground)] border-black flex flex-col transition-all duration-300 ease-out
            /* Desktop Styles - Optimized for 1366x768 */
            md:bottom-24 md:right-8 md:w-[380px] md:h-[480px] md:border-2 md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:animate-in md:fade-in md:slide-in-from-bottom-4 md:rounded-none
            /* Mobile Styles (Bottom Sheet) */
            max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:w-full max-md:h-[85vh] max-md:rounded-t-[2.5rem] max-md:border-t-2 max-md:animate-in max-md:slide-in-from-bottom-full
          `}>
            
            {/* Header com Handle para Mobile */}
            <div className="relative p-4 bg-[#FF4F00] text-white border-b-2 border-black flex items-center justify-between md:rounded-none rounded-t-[2.5rem]">
              {/* Drag handle visual para mobile */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-black/20 rounded-full md:hidden" />
              
              <div className="flex items-center gap-2 mt-2 md:mt-0">
                <Brain size={20} />
                <span className="font-bold uppercase tracking-widest text-xs">Especialista Neural</span>
              </div>
              
              <button 
                onClick={() => setIsOpen(false)} 
                className="hover:opacity-60 transition-opacity p-2 -mr-2"
              >
                <span className="hidden md:block"><X size={20} /></span>
                <span className="md:hidden"><ChevronDown size={24} /></span>
              </button>
            </div>

            {/* Indexing Banner */}
            {notesWithoutEmbeddings.length > 0 && !isIndexing && (
              <div className="p-3 bg-black text-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-tight">
                  <Info size={12} className="text-[#FF4F00]" />
                  <span>{notesWithoutEmbeddings.length} Notas pendentes de indexação</span>
                </div>
                <button 
                  onClick={handleIndexNotes}
                  className="text-[9px] font-bold underline text-[#FF4F00] hover:text-white"
                >
                  Indexar
                </button>
              </div>
            )}

            {isIndexing && (
              <div className="p-3 bg-black text-white flex items-center justify-between">
                <div className="flex items-center gap-2 text-[9px] font-bold uppercase">
                  <Loader2 size={12} className="animate-spin text-[#FF4F00]" />
                  <span>Mapeando Cérebro... {indexProgress}%</span>
                </div>
              </div>
            )}

            <div 
              ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--background)] border-b border-[var(--border)] custom-scrollbar"
            >
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-30">
                  <Brain size={48} className="mb-4" />
                  <p className="text-sm font-serif italic text-[var(--foreground)]">
                    "O conhecimento está latente. Faça sua pergunta."
                  </p>
                </div>
              )}
              
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] w-fit border-2 border-black ${
                    msg.role === 'user' 
                      ? 'bg-[#FF4F00] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] px-3 py-1.5' 
                      : 'bg-[var(--muted)] text-[var(--foreground)] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] p-3'
                  }`}>
                  <div className={msg.role === 'user' 
                    ? "text-sm leading-tight whitespace-pre-wrap" 
                    : "text-sm leading-snug prose prose-sm dark:prose-invert max-w-none prose-p:my-0.5 prose-ul:my-1 prose-li:my-0 prose-headings:text-[var(--foreground)] prose-strong:text-inherit"
                  }>
                    {msg.role === 'user' ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
                  </div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-4 pt-2 border-t border-[var(--border)] flex flex-wrap gap-2">
                        {msg.sources.map((s: { id: string, title: string }) => (
                          <span key={s.id} className="text-[9px] font-bold uppercase bg-black text-white px-2 py-0.5">
                            {s.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-[var(--muted)] p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-[#FF4F00]" />
                    <span className="text-[9px] font-bold uppercase text-[var(--foreground)]">Processando Sinapses...</span>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="p-6 bg-[var(--background)] border-t-2 border-black pb-8 md:pb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  placeholder="Pergunte ao seu cérebro..."
                  className="flex-1 bg-[var(--muted)] text-[var(--foreground)] border-2 border-black p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#FF4F00] placeholder:text-[var(--foreground)]/30"
                />
                <button
                  type="submit"
                  disabled={isLoading || isIndexing}
                  className="bg-black text-white px-5 py-2 border-2 border-black hover:bg-[#FF4F00] hover:text-black disabled:opacity-50 transition-colors"
                >
                  <Send size={20} />
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
