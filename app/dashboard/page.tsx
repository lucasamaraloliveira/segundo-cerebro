'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Note } from '@/lib/types';
import dynamic from 'next/dynamic';
import { ArrowLeft, Brain, Layers } from 'lucide-react';
import Link from 'next/link';
import { forceCollide } from 'd3-force';

// Dynamically import the graph to avoid SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

export default function Dashboard() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

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
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    }
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

  const graphData = useMemo(() => {
    const nodes = notes.map((note, index) => {
      const colors = theme === 'dark' 
        ? ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6']
        : ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
      return {
        id: note.id,
        name: note.title,
        val: (note.content?.length || 0) / 100 + 5,
        color: colors[index % colors.length]
      };
    });

    const links: { source: string; target: string }[] = [];

    // Simple connection logic: shared tags
    notes.forEach((noteA, i) => {
      notes.slice(i + 1).forEach(noteB => {
        const sharedTags = noteA.tags?.filter(tag => noteB.tags?.includes(tag));
        if (sharedTags && sharedTags.length > 0) {
          links.push({
            source: noteA.id,
            target: noteB.id
          });
        }
      });
    });

    return { nodes, links };
  }, [notes, theme]);

  const fgRef = React.useRef<any>(null);

  useEffect(() => {
    if (fgRef.current) {
      // Configura as forças quando o grafo carrega
      fgRef.current.d3Force('link').distance(200);
      fgRef.current.d3Force('charge').strength(-500);
      fgRef.current.d3Force('collide', forceCollide((node: any) => node.val + 20));
    }
  }, [graphData]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="animate-pulse flex flex-col items-center gap-4 text-[var(--foreground)]">
          <Brain className="w-12 h-12 opacity-20" />
          <p className="font-serif italic opacity-40 text-xl">Mapeando conexões...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-center text-[var(--foreground)]">
          <h1 className="text-2xl font-serif italic mb-4">Acesso Negado</h1>
          <Link href="/" className="underline opacity-60 hover:opacity-100">Voltar para Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--background)] overflow-hidden text-[var(--foreground)]">
      {/* Header */}
      <header className="p-4 md:p-6 border-b border-[var(--border)] bg-[var(--background)] flex items-center justify-between z-10">
        <div className="flex items-center gap-3 md:gap-4">
          <Link href="/" className="p-2 hover:bg-[var(--muted)] rounded-full transition-all">
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
          </Link>
          <div>
            <h1 className="font-serif italic text-xl md:text-3xl tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 md:w-6 md:h-6" /> Dashboard Neural
            </h1>
            <p className="text-[9px] md:text-xs font-bold uppercase tracking-widest opacity-40">Visualização de Vínculos</p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-xs md:text-sm font-medium">{notes.length} Notas Mapeadas</p>
          <p className="text-[10px] md:text-xs opacity-40">{graphData.links.length} Conexões por Tags</p>
        </div>
      </header>

      {/* Graph Area */}
      <div className="flex-1 relative bg-[var(--background)]">
        {notes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-center p-8">
            <p className="font-serif italic text-2xl opacity-20 max-w-md">
              Sua rede neural ainda está vazia. Adicione tags às suas notas para criar vínculos.
            </p>
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeLabel="name"
            nodeColor={(node: any) => node.color}
            linkColor={() => theme === 'dark' ? '#333333' : '#e5e5e5'}
            linkWidth={1.5}
            backgroundColor={theme === 'dark' ? '#000000' : '#ffffff'}
            nodeRelSize={1} // Usamos o val do nó para o tamanho
            onNodeClick={(node: any) => {
              window.location.href = `/?note=${node.id}`;
            }}
            cooldownTicks={100}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
          />
        )}
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 md:bottom-8 left-4 md:left-8 bg-[var(--accent)] text-[var(--accent-foreground)] p-3 md:p-4 rounded-lg shadow-2xl z-20 max-w-[200px] md:max-w-xs pointer-events-none">
        <p className="text-[9px] md:text-xs font-bold uppercase tracking-wider mb-1 md:mb-2 opacity-60">Como ler o mapa:</p>
        <p className="text-xs md:text-sm leading-tight">As linhas conectam notas com **Tags comuns**. Nós maiores têm mais conteúdo.</p>
      </div>
    </div>
  );
}
