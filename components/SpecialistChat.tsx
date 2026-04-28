'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Note } from '@/lib/types';
import { db, auth } from '@/lib/firebase';
import { doc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { X, Send, Brain, Loader2, Info, ChevronDown, Paperclip, Copy, Check, History, ArrowLeft, Plus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [size, setSize] = useState({ width: 380, height: 480 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDir, setResizeDir] = useState<string | null>(null);

  // History State
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'chat' | 'history' | 'history-detail'>('chat');
  const [selectedSession, setSelectedSession] = useState<any | null>(null);

  // Resize handler
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (resizeDir === 'top') {
        const newHeight = window.innerHeight - e.clientY - 96; // 96 is bottom-24
        if (newHeight > 300 && newHeight < 800) setSize(prev => ({ ...prev, height: newHeight }));
      } else if (resizeDir === 'left') {
        const newWidth = window.innerWidth - e.clientX - 32; // 32 is right-8
        if (newWidth > 300 && newWidth < 800) setSize(prev => ({ ...prev, width: newWidth }));
      } else if (resizeDir === 'both') {
        const newHeight = window.innerHeight - e.clientY - 96;
        const newWidth = window.innerWidth - e.clientX - 32;
        if (newHeight > 300 && newHeight < 800) setSize(prev => ({ ...prev, height: newHeight }));
        if (newWidth > 300 && newWidth < 800) setSize(prev => ({ ...prev, width: newWidth }));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeDir(null);
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeDir]);

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedHistory = localStorage.getItem('neural_chat_history');
      if (savedHistory) {
        try {
          setChatHistory(JSON.parse(savedHistory));
        } catch (e) {
          console.error('Error parsing chat history', e);
        }
      }
      setCurrentSessionId(Date.now().toString());
    }
  }, []);

  useEffect(() => {
    if (messages.length === 0 || !currentSessionId) return;

    setChatHistory(prev => {
      const existingIndex = prev.findIndex((s: any) => s.id === currentSessionId);
      const updatedHistory = [...prev];

      if (existingIndex >= 0) {
        updatedHistory[existingIndex] = {
          ...updatedHistory[existingIndex],
          messages: messages,
          updatedAt: Date.now()
        };
      } else {
        const firstUserMessage = messages.find(m => m.role === 'user')?.content || 'Consulta sem título';
        const title = firstUserMessage.substring(0, 30) + (firstUserMessage.length > 30 ? '...' : '');

        updatedHistory.push({
          id: currentSessionId,
          title: title,
          timestamp: Date.now(),
          updatedAt: Date.now(),
          messages: messages
        });
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('neural_chat_history', JSON.stringify(updatedHistory));
      }
      return updatedHistory;
    });
  }, [messages, currentSessionId]);

  const notesWithoutEmbeddings = notes.filter(n => !n.embedding);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isLoading, isUploading, viewMode]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [queryText]);

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


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
      alert('Por favor, selecione um arquivo de áudio ou vídeo.');
      return;
    }

    setIsUploading(true);
    setMessages(prev => [...prev, { role: 'user', content: `📎 Anexou arquivo: ${file.name}` }]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.text) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `### Transcrição concluída: ${file.name}\n\n${data.text}`
        }]);
      } else {
        throw new Error(data.error || 'Falha na transcrição');
      }
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Erro ao transcrever arquivo: ${error.message}` }]);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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
      {/* Botão Flutuante (Apenas Desktop) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hidden md:flex fixed bottom-8 right-8 z-[100] w-14 h-14 bg-[#FF4F00] text-white rounded-none shadow-[12px_12px_0px_rgba(0,0,0,0.1)] items-center justify-center hover:translate-y-[-2px] hover:shadow-[12px_14px_0px_rgba(0,0,0,0.15)] transition-all active:translate-y-[0px] active:shadow-none border border-black/5"
      >
        {isOpen ? <X size={24} /> : <Brain size={24} />}
      </button>


      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop apenas para Mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[90] md:hidden backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            {/* Modal / Bottom Sheet Responsivo */}
            <motion.div 
              style={{ 
                width: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${size.width}px` : undefined, 
                height: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${size.height}px` : undefined 
              }}
              initial={typeof window !== 'undefined' && window.innerWidth >= 768 ? { scale: 0.9, opacity: 0 } : { y: "100%" }}
              animate={typeof window !== 'undefined' && window.innerWidth >= 768 ? { scale: 1, opacity: 1 } : { y: 0 }}
              exit={typeof window !== 'undefined' && window.innerWidth >= 768 ? { scale: 0.9, opacity: 0 } : { y: "100%" }}
              transition={typeof window !== 'undefined' && window.innerWidth >= 768 ? { type: "spring", damping: 25, stiffness: 200 } : { type: "spring", damping: 30, stiffness: 300 }}
              drag={typeof window !== 'undefined' && window.innerWidth < 768 ? "y" : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 150) setIsOpen(false);
              }}
              className={`
              fixed z-[100] bg-[var(--background)] text-[var(--foreground)] border-black flex flex-col
              /* Desktop Styles - Optimized for 1366x768 */
               md:bottom-24 md:right-8 md:border md:border-black/10 md:shadow-[12px_12px_0px_rgba(0,0,0,0.1)] md:rounded-none
              /* Mobile Styles (Bottom Sheet) */
              max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:w-full max-md:h-[85vh] max-md:rounded-t-[2.5rem] max-md:border-t-2
            `}>
              {/* Resize Handles (Desktop Only) */}
              <div 
                className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize z-[110] hidden md:block" 
                onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); setResizeDir('both'); document.body.style.cursor = 'nwse-resize'; }}
              />
              <div 
                className="absolute top-0 left-4 right-4 h-1 cursor-ns-resize z-[110] hidden md:block" 
                onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); setResizeDir('top'); document.body.style.cursor = 'ns-resize'; }}
              />
              <div 
                className="absolute left-0 top-4 bottom-4 w-1 cursor-ew-resize z-[110] hidden md:block" 
                onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); setResizeDir('left'); document.body.style.cursor = 'ew-resize'; }}
              />

              {/* Header com Handle para Mobile */}
              <div className="relative p-4 bg-[#FF4F00] text-white border-b border-black/10 flex items-center justify-between md:rounded-none rounded-t-[2.5rem] touch-none">
                {/* Drag handle visual para mobile */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-black/20 rounded-full md:hidden" />

              <div className="flex items-center gap-2 mt-2 md:mt-0">
                <Brain size={20} />
                <span className="font-bold uppercase tracking-widest text-xs">Especialista Neural</span>
              </div>

              <div className="flex items-center gap-1 mt-2 md:mt-0">
                {viewMode === 'chat' && messages.length > 0 && (
                  <button
                    onClick={() => {
                      setMessages([]);
                      setCurrentSessionId(Date.now().toString());
                    }}
                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                    title="Nova Conversa"
                  >
                    <Plus size={18} />
                  </button>
                )}
                <button
                  onClick={() => setViewMode(viewMode === 'chat' ? 'history' : 'chat')}
                  className="p-1.5 hover:bg-white/10 rounded transition-colors"
                  title="Histórico"
                >
                  <History size={18} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="hover:opacity-60 transition-opacity p-1.5"
                >
                  <span className="hidden md:block"><X size={18} /></span>
                  <span className="md:hidden"><ChevronDown size={22} /></span>
                </button>
              </div>
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

            {viewMode === 'chat' && (
              <>
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
                      <div className={`max-w-[85%] w-fit border border-black/5 relative group ${
                        msg.role === 'user' 
                          ? 'bg-[#FF4F00] text-white shadow-[2px_2px_0px_rgba(0,0,0,0.1)] px-3 py-1.5' 
                          : 'bg-[var(--muted)] text-[var(--foreground)] shadow-[2px_2px_0px_rgba(0,0,0,0.1)] p-3'
                      }`}>
                        {msg.role === 'assistant' && (
                          <button
                            onClick={() => copyToClipboard(msg.content, i.toString())}
                            className="absolute -top-2 -right-2 w-7 h-7 bg-black text-white border border-white flex items-center justify-center hover:bg-[#FF4F00] transition-colors z-10 opacity-0 group-hover:opacity-100 shadow-md"
                            title="Copiar transcrição"
                          >
                            {copiedId === i.toString() ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        )}
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
                  {(isLoading || isUploading) && (
                    <div className="flex justify-start">
                      <div className="bg-[var(--muted)] p-3 border border-black/5 shadow-[2px_2px_0px_rgba(0,0,0,0.1)] flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-[#FF4F00]" />
                        <span className="text-[9px] font-bold uppercase text-[var(--foreground)]">
                          {isUploading ? 'Analisando Mídia...' : 'Processando Sinapses...'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSendMessage} className="p-4 bg-[var(--background)] border-t border-black/10">
                  <div className="flex flex-col bg-[var(--muted)] border border-black/10 focus-within:ring-2 focus-within:ring-[#FF4F00] transition-all shadow-[4px_4px_0px_rgba(0,0,0,0.05)]">
                    <textarea
                      ref={textareaRef}
                      value={queryText}
                      onChange={(e) => setQueryText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e as any);
                        }
                      }}
                      placeholder="Pergunte ao seu cérebro..."
                      className="w-full bg-transparent text-[var(--foreground)] p-4 text-sm focus:outline-none placeholder:text-[var(--foreground)]/30 resize-none max-h-[160px] custom-scrollbar min-h-[60px]"
                      rows={1}
                    />
                    <div className="flex justify-between items-center px-4 pb-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2 text-[var(--foreground)]/60 hover:text-[#FF4F00] hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                          title="Anexar áudio ou vídeo"
                        >
                          <Paperclip size={20} />
                        </button>
                        <input 
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept="audio/*,video/*"
                          className="hidden"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isLoading || isIndexing || isUploading || !queryText.trim()}
                        className="p-2 bg-black text-white hover:bg-[#FF4F00] hover:text-black disabled:opacity-30 disabled:hover:bg-black disabled:hover:text-white transition-all flex items-center justify-center"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>
                </form>
              </>
            )}

            {viewMode === 'history' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[var(--background)] border-b border-[var(--border)] custom-scrollbar">
                <div className="flex items-center gap-2 mb-2 text-[var(--foreground)]/60">
                  <button 
                    onClick={() => setViewMode('chat')} 
                    className="hover:text-[var(--foreground)] transition-colors flex items-center gap-1"
                  >
                    <ArrowLeft size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Voltar ao Chat</span>
                  </button>
                </div>

                {chatHistory.length === 0 ? (
                  <p className="text-xs opacity-40 text-center py-16 italic font-serif">Nenhuma conversa registrada.</p>
                ) : (
                  <div className="space-y-3">
                    {[...chatHistory].reverse().map((session) => (
                      <div
                        key={session.id}
                        onClick={() => {
                          setSelectedSession(session);
                          setViewMode('history-detail');
                        }}
                        className="p-4 bg-[var(--muted)] hover:bg-[var(--accent)]/5 border border-black/5 cursor-pointer transition-all shadow-[4px_4px_0px_rgba(0,0,0,0.02)] flex justify-between items-center group"
                      >
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="text-xs font-bold tracking-tight text-[var(--foreground)] group-hover:text-[var(--accent)] truncate pr-2">
                            {session.title}
                          </span>
                          <span className="text-[8px] font-bold uppercase tracking-widest opacity-30">
                            {new Date(session.timestamp).toLocaleDateString('pt-BR', { 
                              day: '2-digit', 
                              month: '2-digit',
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                        </div>
                        <span className="text-[8px] font-bold uppercase tracking-widest bg-black/10 dark:bg-white/10 px-2.5 py-1 text-[var(--foreground)]/60 shrink-0">
                          {session.messages.length} msgs
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {viewMode === 'history-detail' && selectedSession && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[var(--background)] border-b border-[var(--border)] custom-scrollbar">
                <div className="flex items-center justify-between mb-2 text-[var(--foreground)]/60 pb-2 border-b border-[var(--border)]/10">
                  <button 
                    onClick={() => setViewMode('history')} 
                    className="hover:text-[var(--foreground)] transition-colors flex items-center gap-1"
                  >
                    <ArrowLeft size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Voltar ao Histórico</span>
                  </button>
                  <span className="text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 bg-black text-white/80">Consulta</span>
                </div>

                <div className="space-y-4">
                  {selectedSession.messages.map((msg: any, i: number) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] w-fit border border-black/5 relative group ${
                        msg.role === 'user' 
                          ? 'bg-[#FF4F00]/50 text-white shadow-[2px_2px_0px_rgba(0,0,0,0.1)] px-3 py-1.5' 
                          : 'bg-[var(--muted)]/60 text-[var(--foreground)]/70 shadow-[2px_2px_0px_rgba(0,0,0,0.1)] p-3'
                      }`}>
                        <div className={msg.role === 'user' 
                          ? "text-sm leading-tight whitespace-pre-wrap" 
                          : "text-sm leading-snug prose prose-sm dark:prose-invert max-w-none prose-p:my-0.5 prose-ul:my-1 prose-li:my-0 prose-headings:text-[var(--foreground)]/80 prose-strong:text-inherit"
                        }>
                          {msg.role === 'user' ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
              <p className="mt-2 text-[8px] text-center opacity-30 font-bold uppercase tracking-widest">
                IA pode cometer erros. Verifique informações importantes.
              </p>
          </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
