'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Note } from '@/lib/types';
import dynamic from 'next/dynamic';
import { ArrowLeft, Brain, Layers, Tag as TagIcon, BarChart3, Clock } from 'lucide-react';
import Link from 'next/link';

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
          const notesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Note[];
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
          <p className="font-serif italic opacity-40 text-xl">Sincronizando Sinapses...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--background)] p-8">
        <div className="text-center text-[var(--foreground)] max-w-sm">
          <h1 className="text-3xl font-serif italic mb-6">Matriz Bloqueada</h1>
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
            <h1 className="font-serif italic text-2xl tracking-tight flex items-center gap-3">
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
                onClick={() => setActiveView(tab.id as any)}
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
            <p className="text-xl font-serif italic">{stats.totalNotes}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 relative flex">
        {/* Background Grid Layer */}
        <div className="absolute inset-0 bg-dot-matrix opacity-10 pointer-events-none" />

        {/* Decorative Coordinate Markers */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[8px] font-mono opacity-20 pointer-events-none uppercase tracking-widest hidden md:block">
          Grid System // Lat: 0.00 Lon: 0.00
        </div>
        
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
                      className={`flex items-center gap-4 w-full text-left transition-all group ${selectedTag && selectedTag !== tag ? 'opacity-30' : 'opacity-100'}`}
                    >
                      <div className={`w-2 h-2 transition-all ${selectedTag === tag ? 'bg-[var(--accent)] scale-150 rotate-45 shadow-[0_0_10px_var(--accent)]' : 'bg-[var(--accent)]/40 group-hover:bg-[var(--accent)]'}`} />
                      <div>
                        <p className={`text-sm font-serif italic leading-none transition-colors ${selectedTag === tag ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'}`}>{tag}</p>
                        <p className="text-[9px] font-bold uppercase tracking-tighter opacity-30">{count} conexões</p>
                      </div>
                    </button>
                  ))}
                  {selectedTag && (
                    <button 
                      onClick={() => setSelectedTag(null)}
                      className="mt-4 text-[8px] font-bold uppercase tracking-widest text-[var(--accent)] hover:underline"
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
                  Cada nodo representa uma nota. O tamanho indica a densidade do conteúdo. Linhas conectam notas que compartilham etiquetas.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 relative h-full">
          {notes.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-center p-8">
              <p className="font-serif italic text-2xl opacity-20 max-w-md">
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
      </main>

      {/* Footer Branding */}
      <div className="px-8 py-3 border-t border-[var(--border)] flex justify-between items-center text-[8px] font-mono font-bold uppercase tracking-[0.3em] opacity-20">
        <span>Neural Interface v2.0 // Mente+</span>
        <span>Localize: {user?.uid.slice(0, 8)}...</span>
      </div>
    </div>
  );
}
