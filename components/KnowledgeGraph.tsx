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
  const hoverStartTime = useRef<number>(0);
  const prevHoveredId = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Track hover timing for smooth transitions without state re-renders
  useEffect(() => {
    if (hoveredNode?.id !== prevHoveredId.current) {
      hoverStartTime.current = Date.now();
      prevHoveredId.current = hoveredNode?.id || null;
    }
  }, [hoveredNode?.id]);

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
      tags: note.tags || []
    }));

    // Create links based on shared tags OR internal links (Backlinks)
    const links: any[] = [];

    for (let i = 0; i < notes.length; i++) {
      for (let j = i + 1; j < notes.length; j++) {
        const noteA = notes[i];
        const noteB = notes[j];
        
        // 1. Shared tags connection
        const commonTags = noteA.tags?.filter(tag => noteB.tags?.includes(tag)) || [];
        
        // 2. Direct internal links (Bidirectional check)
        const aLinksToB = noteA.content?.includes(noteB.id);
        const bLinksToA = noteB.content?.includes(noteA.id);

        if (commonTags.length > 0 || aLinksToB || bLinksToA) {
          // Weight calculation: Tags give base weight, direct links give massive weight
          let weight = commonTags.length * 0.5;
          if (aLinksToB || bLinksToA) weight += 5; // Direct connection is stronger

          links.push({
            source: noteA.id,
            target: noteB.id,
            weight: weight
          });


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
          const isNodeHighlighted = !selectedTag || node.tags?.includes(selectedTag);
          
          if (hoveredNode) {
            const isHovered = node.id === hoveredNode.id;
            const isNeighbor = graphData.links.some(l => 
              (l.source.id === hoveredNode.id && l.target.id === node.id) || 
              (l.target.id === hoveredNode.id && l.source.id === node.id) ||
              (l.source === hoveredNode.id && l.target === node.id) ||
              (l.target === hoveredNode.id && l.source === node.id)
            );
            if (isHovered || isNeighbor) return '#FF4F00';
            return 'rgba(128, 128, 128, 0.05)';
          }

          if (!selectedTag) return '#FF4F00';
          return isNodeHighlighted ? '#FF4F00' : 'rgba(128, 128, 128, 0.1)';
        }}
        linkColor={(link: any) => {
          if (hoveredNode) {
            const isConnected = (typeof link.source === 'object' ? link.source.id === hoveredNode.id : link.source === hoveredNode.id) || 
                                (typeof link.target === 'object' ? link.target.id === hoveredNode.id : link.target === hoveredNode.id);
            return isConnected ? 'rgba(255, 79, 0, 0.4)' : 'rgba(128, 128, 128, 0.02)';
          }

          if (!selectedTag) return 'rgba(128, 128, 128, 0.15)';
          const sourceMatch = (typeof link.source === 'object' ? link.source.tags : []).includes(selectedTag);
          const targetMatch = (typeof link.target === 'object' ? link.target.tags : []).includes(selectedTag);
          return (sourceMatch && targetMatch) ? 'rgba(255, 79, 0, 0.3)' : 'rgba(128, 128, 128, 0.03)';
        }}
        linkWidth={(link: any) => {
          if (hoveredNode) {
             const isConnected = (typeof link.source === 'object' ? link.source.id === hoveredNode.id : link.source === hoveredNode.id) || 
                                 (typeof link.target === 'object' ? link.target.id === hoveredNode.id : link.target === hoveredNode.id);
             return isConnected ? 2.5 : 1;
          }
          return link.weight * 1.5;
        }}
        linkCanvasObjectMode={() => 'after'}
        linkCanvasObject={(link: any, ctx) => {
          const isHovered = hoveredNode && (
            (typeof link.source === 'object' ? link.source.id === hoveredNode.id : link.source === hoveredNode.id) || 
            (typeof link.target === 'object' ? link.target.id === hoveredNode.id : link.target === hoveredNode.id)
          );
          
          if (!isHovered) return;

          // Smooth transition calculation
          const elapsed = Date.now() - hoverStartTime.current;
          const progress = Math.min(elapsed / 300, 1);
          const alpha = 1 - Math.pow(1 - progress, 3); // easeOutCubic

          // Neural pulse calculation
          const pulse = (Math.sin(Date.now() / 200) + 1) / 2; // 0 to 1
          const breathing = 0.4 + pulse * 0.2; // 0.4 to 0.6 opacity range

          const start = link.source;
          const end = link.target;
          if (typeof start !== 'object' || typeof end !== 'object') return;

          // Draw the neural highlight
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          
          ctx.strokeStyle = `rgba(255, 79, 0, ${breathing * alpha})`;
          ctx.lineWidth = 3 * alpha;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Add a subtle glow
          ctx.shadowBlur = 15 * alpha;
          ctx.shadowColor = 'rgba(255, 79, 0, 0.4)';
          ctx.stroke();
          ctx.shadowBlur = 0;
        }}
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

          const isNodeHighlighted = !selectedTag || node.tags?.includes(selectedTag);
          const isHoveredNode = hoveredNode && node.id === hoveredNode.id;
          const isNeighbor = hoveredNode && graphData.links.some(l => 
            (l.source.id === hoveredNode.id && l.target.id === node.id) || 
            (l.target.id === hoveredNode.id && l.source.id === node.id) ||
            (l.source === hoveredNode.id && l.target === node.id) ||
            (l.target === hoveredNode.id && l.source === node.id)
          );
          
          // Hover state logic
          const shouldHighlight = hoveredNode 
            ? (isHoveredNode || isNeighbor) 
            : isNodeHighlighted;

          // Smooth transition if hovered
          let alpha = 1;
          if (isHoveredNode) {
            const elapsed = Date.now() - hoverStartTime.current;
            const progress = Math.min(elapsed / 300, 1);
            alpha = 1 - Math.pow(1 - progress, 3);
          }

          // Draw node glow
          try {
            const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
            const pulseIntensity = pulse * 0.1; 

            let glowOpacity = 0.05;
            if (shouldHighlight) {
              const baseOpacity = isHoveredNode ? 0.4 : 0.1;
              glowOpacity = (baseOpacity + pulseIntensity) * alpha;
            }

            const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, nodeR * (isHoveredNode ? 6 : 4));
            gradient.addColorStop(0, `rgba(255, 79, 0, ${glowOpacity})`);
            gradient.addColorStop(1, 'rgba(255, 79, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeR * (isHoveredNode ? 6 : 4), 0, 2 * Math.PI, false);
            ctx.fill();
          } catch (e) {}

          // Standard Neural Node: Circle
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeR * (isHoveredNode ? 1.2 : 1), 0, 2 * Math.PI, false);
          ctx.fillStyle = shouldHighlight ? '#FF4F00' : 'rgba(128, 128, 128, 0.1)';
          ctx.fill();
          
          // Labels (only when zoomed in)
          if (globalScale > 1.2) {
            ctx.font = `${fontSize}px Georgia, serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = shouldHighlight ? 'var(--foreground)' : 'rgba(128, 128, 128, 0.2)';
            ctx.fillText(label, node.x, node.y + nodeR + 6);
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

    </div>
  );
}
