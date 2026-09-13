'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Note } from '@/lib/types';
import dynamic from 'next/dynamic';
import { ArrowLeft, Brain, Layers, Tag as TagIcon, BarChart3, Clock, Search, X, ExternalLink, Star, Calendar, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const KnowledgeGraph = dynamic(() => import('@/components/KnowledgeGraph'), { 
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center opacity-20">Iniciando Matriz...</div>
});

const NeuralTimeline = dynamic(() => import('@/components/NeuralTimeline'), { ssr: false });
const NeuralHeatmap = dynamic(() => import('@/components/NeuralHeatmap'), { ssr: false });

export default function Dashboard() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState<{ width: number, height: number } | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'graph' | 'timeline' | 'heatmap'>('graph');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedNote, setInspectedNote] = useState<Note | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeFilterMode, setActiveFilterMode] = useState<'favorites' | 'recent' | 'connected' | 'isolated' | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const searchContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchFocused(true);
      }
      if (e.key === 'Escape') {
        if (isSearchFocused) {
          setIsSearchFocused(false);
          searchInputRef.current?.blur();
        } else if (inspectedNote) {
          setInspectedNote(null);
        } else if (searchQuery || activeFilterMode) {
          setSearchQuery('');
          setActiveFilterMode(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectedNote, searchQuery, isSearchFocused, activeFilterMode]);

  const dismissSearch = useCallback(() => {
    setIsSearchFocused(false);
    searchInputRef.current?.blur();
  }, []);

  useEffect(() => {
    const handleOutsideInteraction = (e: Event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        dismissSearch();
      }
    };

    const handleWheelInteraction = (e: WheelEvent) => {
      if (isSearchFocused && searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        dismissSearch();
      }
    };

    // Use capture phase so canvas / D3 stopPropagation() cannot block outside clicks/gestures
    document.addEventListener('pointerdown', handleOutsideInteraction, { capture: true });
    document.addEventListener('touchstart', handleOutsideInteraction, { capture: true, passive: true });
    document.addEventListener('wheel', handleWheelInteraction, { capture: true, passive: true });

    return () => {
      document.removeEventListener('pointerdown', handleOutsideInteraction, { capture: true });
      document.removeEventListener('touchstart', handleOutsideInteraction, { capture: true });
      document.removeEventListener('wheel', handleWheelInteraction, { capture: true });
    };
  }, [isSearchFocused, dismissSearch]);

  const recentNotes = useMemo(() => {
    return notes.slice(0, 3);
  }, [notes]);

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight - (window.innerWidth < 768 ? 80 : 100)
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        const q = query(
          collection(db, 'notes'),
          where('userId', '==', user.uid),
          orderBy('updatedAt', 'desc')
        );

        const unsubscribeNotes = onSnapshot(q, (snapshot) => {
          const notesData = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter((note: any) => note.title !== '__neural_chat_history__') as Note[];
          setNotes(notesData);
          setLoading(false);
        });

        return () => unsubscribeNotes();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const stats = useMemo(() => {
    const allTags = notes.flatMap(n => n.tags || []);
    const tagCounts = allTags.reduce((acc: any, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {});
    
    const topTags = Object.entries(tagCounts)
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 5);

    return {
      totalNotes: notes.length,
      totalTags: Object.keys(tagCounts).length,
      topTags
    };
  }, [notes]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="animate-pulse flex flex-col items-center gap-4 text-[var(--foreground)]">
          <Brain className="w-12 h-12 opacity-20 text-[var(--accent)]" />
          <p className="font-sans font-medium opacity-50 text-base">Sincronizando Sinapses...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--background)] p-8">
        <div className="text-center text-[var(--foreground)] max-w-sm">
          <h1 className="text-2xl font-sans font-bold mb-4">Matriz Bloqueada</h1>
          <p className="text-sm opacity-60 mb-8 leading-relaxed">Acesse sua conta para visualizar o mapeamento neural de seus pensamentos.</p>
          <Link href="/" className="px-8 py-4 bg-[var(--accent)] text-white text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all">
            Ir para Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--background)] overflow-hidden text-[var(--foreground)]">
      {/* Header HUD */}
      <header className="px-8 py-6 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md flex items-center justify-between z-30">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-[var(--accent)] transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Voltar
          </Link>
          <div className="w-[1px] h-4 bg-[var(--border)]" />
          <div>
            <h1 className="font-sans font-bold text-xl tracking-tight flex items-center gap-3">
              <Layers className="w-6 h-6 text-[var(--accent)]" /> Dashboard Neural
            </h1>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-12">
          <div className="flex gap-2 p-1 bg-[var(--muted)] border border-[var(--border)] shadow-[4px_4px_0px_rgba(0,0,0,0.1)]">
            {[
              { id: 'graph', label: 'Mapa Neural', icon: Layers },
              { id: 'timeline', label: 'Linha do Tempo', icon: Clock },
              { id: 'heatmap', label: 'Heatmaps', icon: BarChart3 }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveView(tab.id as any);
                  dismissSearch();
                }}
                className={`flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${activeView === tab.id ? 'bg-[var(--accent)] text-white' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-50'}`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
          <div className="w-[1px] h-4 bg-[var(--border)]" />
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-30">Total de Notas</p>
            <p className="text-xl font-mono font-bold">{stats.totalNotes}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 relative flex">
        {/* Background Grid Layer */}
        <div className="absolute inset-0 bg-dot-matrix opacity-[0.035] dark:opacity-[0.08] pointer-events-none" />

        {/* Decorative Coordinate Markers */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[8px] font-mono opacity-20 pointer-events-none uppercase tracking-widest hidden md:block">
          Grid System // Lat: 0.00 Lon: 0.00
        </div>

        {/* Spotlight Search Header with Suggestions Dropdown in Graph mode */}
        {activeView === 'graph' && (
          <div ref={searchContainerRef} className="absolute top-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-4 pointer-events-auto">
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 w-4 h-4 text-[var(--foreground)] opacity-40 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeFilterMode ? `Filtro: ${activeFilterMode} (Esc para limpar)` : "Buscar no mapa (Ctrl+K)..."}
                className={`w-full pl-10 pr-10 py-2.5 bg-[var(--background)]/95 backdrop-blur-md border text-xs font-mono text-[var(--foreground)] shadow-[4px_4px_0px_rgba(0,0,0,0.08)] focus:outline-none transition-all placeholder:text-[var(--foreground)]/40 ${
                  activeFilterMode ? 'border-[var(--accent)]' : 'border-[var(--border)] focus:border-[var(--accent)]'
                }`}
              />
              {(searchQuery || activeFilterMode) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setActiveFilterMode(null);
                    dismissSearch();
                  }}
                  className="absolute right-3 p-1 hover:opacity-100 opacity-40 transition-opacity cursor-pointer"
                  title="Limpar filtro e busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Active Filter Mode Badge (if any) */}
            {activeFilterMode && !isSearchFocused && (
              <div className="mt-2 flex items-center justify-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--accent)] text-[var(--accent-foreground)] text-[9px] font-mono font-bold uppercase tracking-widest shadow-[2px_2px_0px_rgba(0,0,0,0.1)]">
                  <span>Filtrando: {activeFilterMode === 'favorites' ? '⭐ Favoritas' : activeFilterMode === 'recent' ? '🕒 Recentes' : activeFilterMode === 'connected' ? '🔗 Mais Conectadas' : '💤 Ideias Isoladas'}</span>
                  <button onClick={() => setActiveFilterMode(null)} className="hover:opacity-75 cursor-pointer ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              </div>
            )}

            {/* Suggestions Dropdown */}
            <AnimatePresence>
              {isSearchFocused && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="mt-2 bg-[var(--background)]/95 backdrop-blur-xl border border-[var(--border)] shadow-[8px_8px_0px_rgba(0,0,0,0.12)] p-4 space-y-4 text-left"
                >
                  {/* Section 1: Quick Filters */}
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-40 mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-[var(--accent)]" />
                      <span>Filtros Rápidos Sinápticos</span>
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'favorites', label: 'Favoritas', icon: Star, desc: 'Notas marcadas' },
                        { id: 'recent', label: 'Recentes', icon: Clock, desc: 'Últimos 7 dias' },
                        { id: 'connected', label: 'Mais Conexões', icon: Layers, desc: 'Hubs principais' },
                        { id: 'isolated', label: 'Ideias Isoladas', icon: Brain, desc: 'Sem vínculos' }
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => {
                            setActiveFilterMode(activeFilterMode === f.id ? null : (f.id as any));
                            setIsSearchFocused(false);
                          }}
                          className={`flex items-center gap-2 p-2 text-left border transition-all cursor-pointer ${
                            activeFilterMode === f.id
                              ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                              : 'border-[var(--border)] bg-[var(--muted)]/20 hover:border-[var(--accent)]/40 hover:bg-[var(--muted)]/40'
                          }`}
                        >
                          <f.icon className="w-3.5 h-3.5 shrink-0 text-[var(--accent)]" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold tracking-wider truncate">{f.label}</p>
                            <p className="text-[8px] opacity-40 truncate">{f.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Section 2: Top Tags */}
                  {stats.topTags.length > 0 && (
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-40 mb-2 flex items-center gap-1.5">
                        <TagIcon className="w-3 h-3" />
                        <span>Constelações Populares</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {stats.topTags.map(([tag, count]: any) => (
                          <button
                            key={tag}
                            onClick={() => {
                              setSelectedTag(selectedTag === tag ? null : tag);
                              setIsSearchFocused(false);
                            }}
                            className={`px-2.5 py-1 text-[10px] font-mono border transition-all cursor-pointer ${
                              selectedTag === tag
                                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                : 'bg-[var(--muted)]/30 border-[var(--border)] hover:border-[var(--accent)]/50'
                            }`}
                          >
                            #{tag} <span className="opacity-40 text-[8px]">({count})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 3: Recent Thoughts */}
                  {recentNotes.length > 0 && (
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-40 mb-2 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        <span>Últimos Pensamentos Editados</span>
                      </p>
                      <div className="space-y-1">
                        {recentNotes.map(n => (
                          <button
                            key={n.id}
                            onClick={() => {
                              setInspectedNote(n);
                              setIsSearchFocused(false);
                            }}
                            className="w-full flex items-center justify-between p-2 hover:bg-[var(--muted)]/40 border border-transparent hover:border-[var(--border)] transition-all text-left cursor-pointer group"
                          >
                            <span className="text-xs font-sans font-medium truncate max-w-[240px] text-[var(--foreground)] group-hover:text-[var(--accent)]">
                              {n.title || 'Sem título'}
                            </span>
                            <span className="text-[8px] font-mono opacity-40 shrink-0">
                              {n.updatedAt?.toDate
                                ? format(n.updatedAt.toDate(), "dd/MM", { locale: ptBR })
                                : ''}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer hint */}
                  <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-[8px] font-mono opacity-40">
                    <span>Dica: selecione um filtro rápido ou tag</span>
                    <span>Esc para fechar</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        
        {/* Left Stats Sidebar (HUD Style) - Only visible in Graph mode */}
        {activeView === 'graph' && (
          <div className="absolute top-10 left-10 z-20 hidden lg:block animate-in fade-in slide-in-from-left-4">
            <div className="space-y-10">
              <div className="space-y-4">
                <div className="flex items-center gap-2 opacity-40">
                  <BarChart3 className="w-4 h-4" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Principais Tópicos</p>
                </div>
                <div className="space-y-3 pointer-events-auto">
                  {stats.topTags.map(([tag, count]: any) => (
                    <button 
                      key={tag} 
                      onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                      className={`flex items-center gap-4 w-full text-left transition-all group cursor-pointer ${selectedTag && selectedTag !== tag ? 'opacity-30' : 'opacity-100'}`}
                    >
                      <div className={`w-2 h-2 transition-all ${selectedTag === tag ? 'bg-[var(--accent)] scale-150 rotate-45 shadow-[0_0_10px_var(--accent)]' : 'bg-[var(--accent)]/40 group-hover:bg-[var(--accent)]'}`} />
                      <div>
                        <p className={`text-sm font-sans font-medium leading-none transition-colors ${selectedTag === tag ? 'text-[var(--accent)] font-semibold' : 'text-[var(--foreground)]'}`}>{tag}</p>
                        <p className="text-[9px] font-bold uppercase tracking-tighter opacity-30">{count} conexões</p>
                      </div>
                    </button>
                  ))}
                  {selectedTag && (
                    <button 
                      onClick={() => setSelectedTag(null)}
                      className="mt-4 text-[8px] font-bold uppercase tracking-widest text-[var(--accent)] hover:underline cursor-pointer"
                    >
                      × Limpar Filtro
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4 border-t border-[var(--border)] pt-8 max-w-[200px]">
                <div className="flex items-center gap-2 opacity-40">
                  <TagIcon className="w-4 h-4" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Guia de Leitura</p>
                </div>
                <p className="text-xs leading-relaxed opacity-60">
                  <strong>Núcleos (#)</strong> são tópicos centrais. <strong>Nodos circulares</strong> são pensamentos. Use a <strong>Busca</strong> ou clique em um nó para inspecionar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 relative h-full">
          {notes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-center p-8">
              <p className="font-sans font-medium text-lg opacity-30 max-w-md">
                Aguardando a primeira sinapse... Adicione tags às suas notas para gerar o mapeamento.
              </p>
            </div>
          ) : (
            <div className={`absolute inset-0 ${activeView !== 'graph' ? 'overflow-y-auto custom-scrollbar' : 'overflow-hidden'}`}>
              {activeView === 'graph' && dimensions && (
                <KnowledgeGraph 
                  key={`${dimensions.width}-${dimensions.height}-${notes.length}`}
                  notes={notes} 
                  width={dimensions.width} 
                  height={dimensions.height} 
                  selectedTag={selectedTag}
                  onTagSelect={(tag) => {
                    setSelectedTag(tag);
                    dismissSearch();
                  }}
                  onSelectNote={(note) => {
                    setInspectedNote(note);
                    dismissSearch();
                  }}
                  selectedNoteId={inspectedNote?.id}
                  searchQuery={searchQuery}
                  filterMode={activeFilterMode}
                />
              )}
              {activeView === 'timeline' && <NeuralTimeline notes={notes} />}
              {activeView === 'heatmap' && <NeuralHeatmap notes={notes} />}
              {!dimensions && activeView === 'graph' && (
                <div className="h-full w-full flex items-center justify-center opacity-20">Calculando...</div>
              )}
            </div>
          )}
        </div>

        {/* Quick Inspector Side Drawer */}
        <AnimatePresence>
          {activeView === 'graph' && inspectedNote && (
            <motion.aside
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              className="absolute top-0 right-0 bottom-0 w-full max-w-sm z-40 bg-[var(--background)]/95 backdrop-blur-xl border-l border-[var(--border)] shadow-[-10px_0px_30px_rgba(0,0,0,0.15)] flex flex-col pointer-events-auto"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Inspeção Sináptica</span>
                </div>
                <button
                  onClick={() => setInspectedNote(null)}
                  className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 opacity-50 hover:opacity-100 transition-all cursor-pointer"
                  title="Fechar painel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="text-lg font-sans font-semibold text-[var(--foreground)] leading-snug">
                      {inspectedNote.title || 'Sem título'}
                    </h2>
                    {inspectedNote.isBookmarked && (
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0 mt-1" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono opacity-40">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {inspectedNote.updatedAt?.toDate
                        ? format(inspectedNote.updatedAt.toDate(), "dd 'de' MMMM, yyyy", { locale: ptBR })
                        : 'Recente'}
                    </span>
                  </div>
                </div>

                {/* Tags */}
                {inspectedNote.tags && inspectedNote.tags.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Constelações / Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {inspectedNote.tags.map(t => (
                        <button
                          key={t}
                          onClick={() => setSelectedTag(selectedTag === t ? null : t)}
                          className={`px-2.5 py-1 text-[10px] font-mono border transition-all cursor-pointer ${
                            selectedTag === t
                              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                              : 'bg-[var(--muted)]/40 border-[var(--border)] hover:border-[var(--accent)]/50'
                          }`}
                        >
                          #{t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Excerpt */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Conteúdo do Pensamento</p>
                  <div className="p-4 border border-[var(--border)] bg-[var(--muted)]/20 text-xs leading-relaxed opacity-80 max-h-64 overflow-y-auto custom-scrollbar whitespace-pre-wrap font-sans">
                    {inspectedNote.content
                      ? inspectedNote.content.replace(/<[^>]*>?/gm, '').slice(0, 500) + (inspectedNote.content.length > 500 ? '...' : '')
                      : <span className="italic opacity-40">Sem conteúdo textual.</span>}
                  </div>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-[var(--border)] bg-[var(--muted)]/10">
                <Link
                  href={`/?note=${inspectedNote.id}`}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-[var(--accent)] text-[var(--accent-foreground)] text-[10px] font-bold uppercase tracking-widest shadow-[4px_4px_0px_rgba(0,0,0,0.1)] hover:opacity-90 transition-all"
                >
                  <span>Abrir no Editor Completo</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Branding */}
      <div className="px-8 py-3 border-t border-[var(--border)] flex justify-between items-center text-[8px] font-mono font-bold uppercase tracking-[0.3em] opacity-20">
        <span>Neural Interface v2.0 // Mente+</span>
        <span>Localize: {user?.uid.slice(0, 8)}...</span>
      </div>
    </div>
  );
}
