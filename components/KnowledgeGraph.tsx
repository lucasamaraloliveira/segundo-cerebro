'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Note } from '@/lib/types';
import { forceManyBody, forceCollide, forceCenter } from 'd3-force';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { 
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center">
      <div className="text-[10px] font-bold uppercase tracking-[0.3em] animate-pulse opacity-40">
        Iniciando Matriz Neural...
      </div>
    </div>
  )
});

interface KnowledgeGraphProps {
  notes: Note[];
  width?: number;
  height?: number;
  selectedTag?: string | null;
}

const NEURAL_COLORS = [
  '#FF4F00', // Neural Orange
  '#3B82F6', // Tech Blue
  '#10B981', // Bio Green
  '#F59E0B', // Creative Amber
  '#EF4444', // Urgent Red
  '#0D9488', // Deep Teal
  '#6366F1', // Indigo
  '#EC4899', // Pink
];

const getTagColor = (tags: string[] = []) => {
  if (tags.length === 0) return '#FF4F00';
  const tag = tags[0];
  // Simple hash for consistent color
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return NEURAL_COLORS[Math.abs(hash) % NEURAL_COLORS.length];
};

export default function KnowledgeGraph({ notes, width, height, selectedTag }: KnowledgeGraphProps) {
  const router = useRouter();
  const fgRef = useRef<any>(null);
  const hasRestored = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const hoverStartTime = useRef<number>(0);
  const prevHoveredId = useRef<string | null>(null);

  // Simulation parameters as state to avoid ref errors and ensure reactivity
  const [simulationParams, setSimulationParams] = useState({
    velocityDecay: 0.01,
    chargeStrength: -25000,
    centerStrength: 0,
    linkDistance: 350
  });

  useEffect(() => {
    setMounted(true);
    
    // Normalize simulation after the Big Bang burst
    const timer = setTimeout(() => {
      setSimulationParams({
        velocityDecay: 0.35,
        chargeStrength: -1800,
        centerStrength: 0.12,
        linkDistance: 250
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hoveredNode?.id !== prevHoveredId.current) {
      hoverStartTime.current = Date.now();
      prevHoveredId.current = hoveredNode?.id || null;
    }
  }, [hoveredNode?.id]);

  const graphData = useMemo(() => {
    const nodes = notes.map((note, i) => {
      const angle = (i / notes.length) * 2 * Math.PI;
      const radius = Math.min(width || 800, height || 600) * 0.4;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      return {
        id: note.id,
        name: note.title || 'Sem título',
        content: note.content || '',
        val: Math.sqrt(note.content?.length || 0) / 4 + 6,
        tags: note.tags || [],
        color: getTagColor(note.tags),
        x, y,
        vx: Math.cos(angle) * 35,
        vy: Math.sin(angle) * 35
      };
    });

    const links: any[] = [];
    for (let i = 0; i < notes.length; i++) {
      for (let j = i + 1; j < notes.length; j++) {
        const noteA = notes[i];
        const noteB = notes[j];
        const commonTags = noteA.tags?.filter(tag => noteB.tags?.includes(tag)) || [];
        const aLinksToB = noteA.content?.includes(noteB.id);
        const bLinksToA = noteB.content?.includes(noteA.id);

        if (commonTags.length > 0 || aLinksToB || bLinksToA) {
          links.push({
            source: noteA.id,
            target: noteB.id,
            weight: (commonTags.length * 0.5) + (aLinksToB || bLinksToA ? 5 : 0)
          });
        }
      }
    }
    return { nodes, links };
  }, [notes, width, height]);

  // Forces configuration
  useEffect(() => {
    if (fgRef.current && mounted && notes.length > 0) {
      const { chargeStrength, centerStrength, linkDistance } = simulationParams;
      
      fgRef.current.d3Force('link').distance((l: any) => linkDistance / (l.weight || 1));
      fgRef.current.d3Force('charge', forceManyBody().strength(chargeStrength).distanceMax(2000));
      fgRef.current.d3Force('collide', forceCollide(150));
      
      if (centerStrength === 0) {
        fgRef.current.d3Force('center', null);
      } else {
        fgRef.current.d3Force('center', forceCenter(0, 0).strength(centerStrength));
      }
      
      fgRef.current.d3ReheatSimulation();

      if (!hasRestored.current) {
        const savedState = localStorage.getItem('neural-graph-state');
        if (savedState) {
          setTimeout(() => {
            try {
              const { x, y, k } = JSON.parse(savedState);
              if (fgRef.current) {
                fgRef.current.zoom(k, 800); 
                fgRef.current.centerAt(x, y, 800);
                fgRef.current.d3ReheatSimulation();
              }
            } catch (e) {}
            hasRestored.current = true;
          }, 1200);
        } else {
          hasRestored.current = true;
        }
      }
    }
  }, [mounted, notes.length, graphData, simulationParams]);

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
              (l.target.id === hoveredNode.id && l.source.id === node.id)
            );
            return (isHovered || isNeighbor) ? (node.color || '#FF4F00') : 'rgba(128, 128, 128, 0.05)';
          }
          return (!selectedTag || isNodeHighlighted) ? (node.color || '#FF4F00') : 'rgba(128, 128, 128, 0.1)';
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
          const elapsed = Date.now() - hoverStartTime.current;
          const progress = Math.min(elapsed / 300, 1);
          const alpha = 1 - Math.pow(1 - progress, 3);
          const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
          const breathing = 0.4 + pulse * 0.2;
          const start = link.source;
          const end = link.target;
          if (typeof start !== 'object' || typeof end !== 'object') return;
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.globalAlpha = breathing * alpha;
          ctx.strokeStyle = start.color || '#FF4F00';
          ctx.lineWidth = 3 * alpha;
          ctx.lineCap = 'round';
          ctx.stroke();
          ctx.shadowBlur = 15 * alpha;
          ctx.shadowColor = start.color || '#FF4F00';
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
        }}
        nodeRelSize={6}
        backgroundColor="transparent"
        warmupTicks={0}
        cooldownTicks={150}
        d3AlphaDecay={0.02}
        d3VelocityDecay={simulationParams.velocityDecay}
        d3AlphaMin={0.005}
        onNodeClick={(node: any) => {
          router.push(`/?note=${node.id}`);
        }}
        onNodeHover={(node: any) => {
          setHoveredNode(node);
        }}
        nodePointerAreaPaint={(node: any, color, ctx) => {
          const nodeR = node.val || 4;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeR + 10, 0, 2 * Math.PI, false);
          ctx.fill();
        }}
        onZoomEnd={(transform) => {
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
            (l.target.id === hoveredNode.id && l.source.id === node.id)
          );
          const shouldHighlight = hoveredNode ? (isHoveredNode || isNeighbor) : isNodeHighlighted;
          let alpha = 1;
          if (isHoveredNode) {
            const elapsed = Date.now() - hoverStartTime.current;
            const progress = Math.min(elapsed / 300, 1);
            alpha = 1 - Math.pow(1 - progress, 3);
          }
          try {
            const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
            const pulseIntensity = pulse * 0.1; 
            let glowOpacity = 0.05;
            if (shouldHighlight) {
              const baseOpacity = isHoveredNode ? 0.4 : 0.1;
              glowOpacity = (baseOpacity + pulseIntensity) * alpha;
            }
            const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, nodeR * (isHoveredNode ? 6 : 4));
            const nodeColor = node.color || '#FF4F00';
            gradient.addColorStop(0, `${nodeColor}${Math.floor(glowOpacity * 255).toString(16).padStart(2, '0')}`);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeR * (isHoveredNode ? 6 : 4), 0, 2 * Math.PI, false);
            ctx.fill();
          } catch (e) {}
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeR * (isHoveredNode ? 1.2 : 1), 0, 2 * Math.PI, false);
          ctx.fillStyle = shouldHighlight ? (node.color || '#FF4F00') : 'rgba(128, 128, 128, 0.1)';
          ctx.fill();
          if (globalScale > 1.2) {
            ctx.font = `${fontSize}px Georgia, serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = shouldHighlight ? 'var(--foreground)' : 'rgba(128, 128, 128, 0.2)';
            ctx.fillText(label, node.x, node.y + nodeR + 6);
          }
        }}
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
