'use client';

import { useMemo, useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';

import { forceManyBody, forceCollide } from 'd3-force';

// Dynamic import to avoid SSR issues with ForceGraph
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full w-full bg-[var(--background)]">
      <div className="text-[10px] font-bold uppercase tracking-[0.3em] animate-pulse opacity-40">
        Iniciando Matriz Neural...
      </div>
    </div>
  )
});

interface Note {
  id: string;
  title: string;
  tags: string[];
  [key: string]: any;
}

interface KnowledgeGraphProps {
  notes: Note[];
  width?: number;
  height?: number;
  selectedTag?: string | null;
}

// Helper to strip HTML for previews
const stripHtml = (html: string) => {
  if (typeof window === 'undefined') return html;
  try {
    const doc = new Range().createContextualFragment(html);
    return doc.textContent || "";
  } catch (e) {
    return html.replace(/<[^>]*>?/gm, '');
  }
};

export default function KnowledgeGraph({ notes, width, height, selectedTag }: KnowledgeGraphProps) {
  const router = useRouter();
  const fgRef = useRef<any>(null);
  const hasRestored = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Configure forces whenever notes change or graph is ready
  useEffect(() => {
    if (fgRef.current && mounted && notes.length > 0) {
      // Re-balancing forces for moderate spacing
      fgRef.current.d3Force('link').distance(250);
      fgRef.current.d3Force('charge', forceManyBody().strength(-3000)); // Higher repulsion for first load
      fgRef.current.d3Force('collide', forceCollide(80));
      fgRef.current.d3Force('center').strength(0); // Zero centering force initially to allow expansion
 
      const reheat = () => {
        if (fgRef.current) {
          fgRef.current.d3ReheatSimulation();
        }
      };

      // Multi-stage reheat to ensure it doesn't bunch up
      setTimeout(reheat, 100);
      setTimeout(reheat, 500);
      setTimeout(reheat, 1000);
      
      // After it has spread, slowly bring back the center force
      setTimeout(() => {
        if (fgRef.current) {
          fgRef.current.d3Force('center').strength(0.05);
          fgRef.current.d3ReheatSimulation();
        }
      }, 2000);

      if (!hasRestored.current) {
        const savedState = localStorage.getItem('neural-graph-state');
        if (savedState) {
          setTimeout(() => {
            try {
              const { x, y, k } = JSON.parse(savedState);
              if (fgRef.current) {
                fgRef.current.zoom(k, 400); 
                fgRef.current.centerAt(x, y, 400);
                reheat();
              }
            } catch (e) {}
            hasRestored.current = true;
          }, 800);
        } else {
          hasRestored.current = true;
        }
      }
    }
  }, [mounted, notes.length]);

  const graphData = useMemo(() => {
    const nodes = notes.map(note => ({
      id: note.id,
      name: note.title || 'Sem título',
      content: note.content || '',
      val: Math.sqrt(note.content?.length || 0) / 4 + 6,
      tags: note.tags || [],
      relatedNames: [] as string[]
    }));

    const links: { source: string; target: string; weight: number }[] = [];
    
    for (let i = 0; i < notes.length; i++) {
      for (let j = i + 1; j < notes.length; j++) {
        const noteA = notes[i];
        const noteB = notes[j];
        const sharedTags = noteA.tags?.filter(tag => noteB.tags?.includes(tag)) || [];
        if (sharedTags.length > 0) {
          links.push({ source: noteA.id, target: noteB.id, weight: sharedTags.length });
          
          // Store relationships for hover info
          nodes[i].relatedNames.push(noteB.title);
          nodes[j].relatedNames.push(noteA.title);
        }
      }
    }

    return { nodes, links };
  }, [notes]);

  if (!mounted) return null;

  return (
    <div className="w-full h-full relative overflow-hidden bg-transparent">
      <ForceGraph2D
        ref={fgRef}
        width={width}
        height={height}
        graphData={graphData}
        nodeLabel="name"
        nodeColor={(node: any) => {
          if (!selectedTag) return '#FF4F00';
          return node.tags?.includes(selectedTag) ? '#FF4F00' : 'rgba(128, 128, 128, 0.1)';
        }}
        linkColor={(link: any) => {
          if (!selectedTag) return 'rgba(128, 128, 128, 0.15)';
          const sourceMatch = link.source.tags?.includes(selectedTag);
          const targetMatch = link.target.tags?.includes(selectedTag);
          return (sourceMatch && targetMatch) ? 'rgba(255, 79, 0, 0.3)' : 'rgba(128, 128, 128, 0.03)';
        }}
        linkWidth={(link: any) => link.weight * 1.5}
        nodeRelSize={1}
        backgroundColor="transparent"
        warmupTicks={200}
        d3AlphaDecay={0.01}
        d3VelocityDecay={0.1}
        onNodeClick={(node: any) => {
          router.push(`/?note=${node.id}`);
        }}
        onNodeHover={(node: any) => {
          setHoveredNode(node);
          if (node) {
            // Track mouse pos for tooltip
            const handleMouseMove = (e: MouseEvent) => {
              setMousePos({ x: e.clientX, y: e.clientY });
            };
            window.addEventListener('mousemove', handleMouseMove);
            return () => window.removeEventListener('mousemove', handleMouseMove);
          }
        }}
        onZoomEnd={(transform) => {
          // Save the exact viewport state {x, y, k}
          localStorage.setItem('neural-graph-state', JSON.stringify(transform));
        }}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          if (node.x === undefined || node.y === undefined || isNaN(node.x) || isNaN(node.y)) return;
          
          const label = node.name;
          const fontSize = 14 / globalScale;
          const nodeR = node.val || 4;

          // Draw node glow
          try {
            const isHighlighted = !selectedTag || node.tags?.includes(selectedTag);
            const glowOpacity = isHighlighted ? 0.35 : 0.05;
            const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, nodeR * 4);
            gradient.addColorStop(0, `rgba(255, 79, 0, ${glowOpacity})`);
            gradient.addColorStop(1, 'rgba(255, 79, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeR * 4, 0, 2 * Math.PI, false);
            ctx.fill();
          } catch (e) {
            // Fallback if gradient fails
          }

          // Draw node
          const isNodeHighlighted = !selectedTag || node.tags?.includes(selectedTag);
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeR, 0, 2 * Math.PI, false);
          ctx.fillStyle = isNodeHighlighted ? '#FF4F00' : 'rgba(128, 128, 128, 0.2)';
          ctx.fill();
          
          // Labels (only when zoomed in)
          if (globalScale > 1.2) {
            ctx.font = `${fontSize}px Georgia, serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = 'var(--foreground)';
            ctx.fillText(label, node.x, node.y + nodeR + 4);
          }
        }}
        cooldownTicks={100}
        d3AlphaMin={0.001}
      />
      
      <div className="absolute bottom-10 right-10 pointer-events-none text-right hidden md:block">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 text-[var(--foreground)]">Matriz de Dados</p>
          <p className="text-xl font-serif italic text-[var(--foreground)]">{notes.length} Pensamentos Ativos</p>
          <div className="w-32 h-[1px] bg-[var(--accent)] ml-auto mt-2"></div>
        </div>
      </div>

      {/* Neural Preview Modal (Hover) */}
      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            style={{ 
              left: mousePos.x + 20, 
              top: mousePos.y + 20,
              position: 'fixed'
            }}
            className="z-[100] bg-[var(--background)] border border-[var(--border)] p-6 shadow-[20px_20px_0px_rgba(0,0,0,0.05)] max-w-[280px] pointer-events-none"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 bg-[var(--accent)]" />
              <h4 className="text-xs font-serif italic">{hoveredNode.name}</h4>
            </div>
            
            <p className="text-[10px] leading-relaxed opacity-60 mb-6 line-clamp-3">
              {stripHtml(hoveredNode.content) || "Sem conteúdo disponível."}
            </p>

            {hoveredNode.relatedNames && hoveredNode.relatedNames.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-[var(--border)]">
                <p className="text-[8px] font-bold uppercase tracking-[0.2em] opacity-30">Conexões Neurais</p>
                <div className="flex flex-wrap gap-1.5">
                  {hoveredNode.relatedNames.slice(0, 3).map((name: string, i: number) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 bg-[var(--muted)] border border-[var(--border)] italic">
                      {name}
                    </span>
                  ))}
                  {hoveredNode.relatedNames.length > 3 && (
                    <span className="text-[8px] opacity-30">+{hoveredNode.relatedNames.length - 3} mais</span>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
