'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Note } from '@/lib/types';
import { forceManyBody, forceCollide, forceCenter } from 'd3-force';
import { Maximize2 } from 'lucide-react';

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
  onTagSelect?: (tag: string | null) => void;
  onSelectNote?: (note: Note | null) => void;
  selectedNoteId?: string | null;
  searchQuery?: string;
  filterMode?: 'favorites' | 'recent' | 'connected' | 'isolated' | null;
}

const NEURAL_COLORS_DARK = [
  '#FF4F00', // Neural Orange
  '#3B82F6', // Tech Blue
  '#10B981', // Bio Green
  '#F59E0B', // Creative Amber
  '#EF4444', // Urgent Red
  '#0D9488', // Deep Teal
  '#6366F1', // Indigo
  '#EC4899', // Pink
];

const NEURAL_COLORS_LIGHT = [
  '#D9531E', // Warm Terracotta / Burnt Sienna
  '#1D4ED8', // Deep Archival Navy
  '#047857', // Forest Sage
  '#B45309', // Warm Ochre / Amber
  '#B91C1C', // Crimson Ink
  '#0F766E', // Mineral Teal
  '#4338CA', // Indigo Ink
  '#BE185D', // Deep Rose
];

const getTagColor = (tags: string[] = [], isDark: boolean = true) => {
  const palette = isDark ? NEURAL_COLORS_DARK : NEURAL_COLORS_LIGHT;
  const defaultColor = isDark ? '#FF4F00' : '#D9531E';
  if (tags.length === 0) return defaultColor;
  const tag = tags[0];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
};

const hexToRgba = (hex: string, alpha: number) => {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function KnowledgeGraph({
  notes,
  width,
  height,
  selectedTag,
  onTagSelect,
  onSelectNote,
  selectedNoteId,
  searchQuery = '',
  filterMode = null
}: KnowledgeGraphProps) {
  const router = useRouter();
  const fgRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const hoverStartTime = useRef<number>(0);
  const prevHoveredId = useRef<string | null>(null);

  // Harmonious simulation parameters (Cosmic Bloom - Constelação Arejada)
  const simulationParams = useMemo(() => ({
    velocityDecay: 0.24,
    chargeStrengthHub: -2400,
    chargeStrengthNote: -820,
    centerStrength: 0.055,
    linkDistance: 210
  }), []);

  useEffect(() => {
    try {
      localStorage.removeItem('neural-graph-state');
    } catch (e) { }

    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'class') {
          checkDark();
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true });

    const frameId = requestAnimationFrame(() => setMounted(true));
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (hoveredNode?.id !== prevHoveredId.current) {
      hoverStartTime.current = Date.now();
      prevHoveredId.current = hoveredNode?.id || null;
    }
  }, [hoveredNode?.id]);

  // Helper function to check search query matching
  const matchesQuery = useCallback((node: any) => {
    if (!searchQuery || !searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    if (node.type === 'tag') {
      return node.tagName?.toLowerCase().includes(q);
    }
    return (
      node.name?.toLowerCase().includes(q) ||
      node.content?.toLowerCase().includes(q) ||
      (node.tags && node.tags.some((t: string) => t.toLowerCase().includes(q)))
    );
  }, [searchQuery]);

  // Constellation / Bipartite graph data structure
  const graphData = useMemo(() => {
    // 1. Gather all unique tags and count note memberships
    const tagCountMap = new Map<string, number>();
    notes.forEach(note => {
      (note.tags || []).forEach(tag => {
        const cleanTag = tag.trim();
        if (cleanTag) {
          tagCountMap.set(cleanTag, (tagCountMap.get(cleanTag) || 0) + 1);
        }
      });
    });

    const uniqueTags = Array.from(tagCountMap.keys());

    // 2. Tag Hub Nodes (Central stars of constellations)
    const tagNodes = uniqueTags.map((tag, i) => {
      const count = tagCountMap.get(tag) || 1;
      const angle = (i / Math.max(1, uniqueTags.length)) * 2 * Math.PI;
      const radius = 60 + (i % 3) * 25;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const color = getTagColor([tag], isDark);

      return {
        id: `tag:${tag}`,
        tagName: tag,
        name: `#${tag}`,
        type: 'tag' as const,
        count,
        val: Math.min(22, Math.max(11, Math.sqrt(count) * 4.5 + 8)),
        tags: [tag],
        color,
        x,
        y,
        vx: 0,
        vy: 0
      };
    });

    // 3. Note Nodes (Thoughts orbiting their tag hubs)
    const noteNodes = notes.map((note, i) => {
      const angle = (i / Math.max(1, notes.length)) * 2 * Math.PI;
      const radius = 90 + (i % 4) * 35;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const color = getTagColor(note.tags, isDark);
      const isBookmarked = Boolean(note.isBookmarked);
      // Key note if bookmarked, or among the first 4 in the collection, or length > 350
      const isKeyNote = isBookmarked || i < 4 || (note.content?.length || 0) > 350;

      return {
        id: note.id,
        name: note.title || 'Sem título',
        content: note.content || '',
        val: Math.min(14, Math.sqrt(note.content?.length || 0) / 4 + 4.5),
        tags: note.tags || [],
        type: 'note' as const,
        isBookmarked,
        isKeyNote,
        originalNote: note,
        color,
        x,
        y,
        vx: 0,
        vy: 0
      };
    });

    const nodes = [...tagNodes, ...noteNodes];
    const links: any[] = [];

    // 4. Bipartite Links: Note -> Tag Hub
    notes.forEach(note => {
      (note.tags || []).forEach(tag => {
        const cleanTag = tag.trim();
        if (cleanTag && tagCountMap.has(cleanTag)) {
          links.push({
            source: note.id,
            target: `tag:${cleanTag}`,
            type: 'tag-connection',
            weight: 1.2,
            color: getTagColor([cleanTag], isDark)
          });
        }
      });
    });

    // 5. Direct internal note-to-note citations
    for (let i = 0; i < notes.length; i++) {
      for (let j = i + 1; j < notes.length; j++) {
        const noteA = notes[i];
        const noteB = notes[j];
        const aLinksToB = noteA.content?.includes(noteB.id);
        const bLinksToA = noteB.content?.includes(noteA.id);

        if (aLinksToB || bLinksToA) {
          links.push({
            source: noteA.id,
            target: noteB.id,
            type: 'direct-synapse',
            weight: 4,
            color: isDark ? '#FF4F00' : '#D9531E'
          });
        }
      }
    }

    return { nodes, links };
  }, [notes, isDark]);

  // Filter mode evaluation helper
  const matchesFilterMode = useCallback((node: any) => {
    if (!filterMode) return true;
    if (filterMode === 'favorites') {
      if (node.type === 'tag') {
        return notes.some(n => n.tags?.includes(node.tagName) && n.isBookmarked);
      }
      return Boolean(node.isBookmarked);
    }
    if (filterMode === 'recent') {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (node.type === 'tag') {
        return notes.some(n => {
          if (!n.tags?.includes(node.tagName)) return false;
          const time = n.updatedAt?.toMillis ? n.updatedAt.toMillis() : (n.updatedAt?.seconds ? n.updatedAt.seconds * 1000 : 0);
          return time >= sevenDaysAgo;
        });
      }
      const noteTime = node.originalNote?.updatedAt?.toMillis
        ? node.originalNote.updatedAt.toMillis()
        : (node.originalNote?.updatedAt?.seconds ? node.originalNote.updatedAt.seconds * 1000 : 0);
      return noteTime >= sevenDaysAgo;
    }
    if (filterMode === 'connected') {
      const connectionCount = graphData.links.filter(l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        return sId === node.id || tId === node.id;
      }).length;
      return connectionCount >= 2;
    }
    if (filterMode === 'isolated') {
      if (node.type === 'tag') return false;
      const connectionCount = graphData.links.filter(l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        return sId === node.id || tId === node.id;
      }).length;
      return connectionCount <= 1;
    }
    return true;
  }, [filterMode, notes, graphData.links]);

  useEffect(() => {
    if (!filterMode || !fgRef.current) return;
    const timer = setTimeout(() => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(600, 60);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [filterMode]);

  // Forces configuration
  useEffect(() => {
    if (fgRef.current && mounted && (notes.length > 0 || graphData.nodes.length > 0)) {
      const { chargeStrengthHub, chargeStrengthNote, centerStrength, linkDistance } = simulationParams;

      fgRef.current.d3Force('link').distance((l: any) => {
        if (l.type === 'direct-synapse') return 140;
        const hubCount = (typeof l.target === 'object' ? l.target.count : 0) ||
                         (typeof l.source === 'object' ? l.source.count : 0) || 1;
        const dynamicDistance = linkDistance + Math.sqrt(hubCount) * 18;
        return dynamicDistance / (l.weight || 1);
      });

      fgRef.current.d3Force('charge', forceManyBody().strength((node: any) => {
        if (node.type === 'tag') return chargeStrengthHub;
        return chargeStrengthNote;
      }).distanceMax(2400));

      fgRef.current.d3Force('collide', forceCollide((node: any) => {
        if (node.type === 'tag') {
          return (node.val || 10) * 2.2 + 35;
        }
        return (node.val || 5) * 3.0 + 32;
      }));

      fgRef.current.d3Force('center', forceCenter(0, 0).strength(centerStrength));

      fgRef.current.d3ReheatSimulation();
    }
  }, [mounted, notes.length, graphData, simulationParams]);

  // Camera recenter handler
  const handleResetCamera = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(600, 60);
      fgRef.current.d3ReheatSimulation();
    }
  }, []);

  // Spotlight Camera Guided Jump on Search query
  useEffect(() => {
    if (!searchQuery || !searchQuery.trim() || !fgRef.current) return;
    const q = searchQuery.toLowerCase().trim();
    const match = graphData.nodes.find(n => {
      if (n.type === 'tag') return n.tagName?.toLowerCase().includes(q);
      return n.name?.toLowerCase().includes(q) || (n.tags && n.tags.some((t: string) => t.toLowerCase().includes(q)));
    });

    if (match && typeof match.x === 'number' && typeof match.y === 'number') {
      fgRef.current.centerAt(match.x, match.y, 600);
      fgRef.current.zoom(1.8, 600);
    }
  }, [searchQuery, graphData.nodes]);

  // Automatic zoomToFit after nodes bloom and settle
  useEffect(() => {
    if (!mounted || graphData.nodes.length === 0) return;

    const timer = setTimeout(() => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(700, 60);
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [mounted, graphData.nodes.length]);

  if (!mounted) return null;

  return (
    <div className="w-full h-full relative overflow-hidden bg-transparent">
      {/* Floating HUD Camera Controls */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={handleResetCamera}
          title="Recentralizar e enquadrar constelações"
          className="flex items-center gap-2 px-3 py-2 bg-[var(--background)]/85 backdrop-blur-md border border-[var(--border)] text-[var(--foreground)] text-[10px] font-bold uppercase tracking-widest shadow-[3px_3px_0px_rgba(0,0,0,0.08)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Recentralizar</span>
        </button>
      </div>

      <ForceGraph2D
        ref={fgRef}
        width={width}
        height={height}
        graphData={graphData}
        nodeLabel={() => ''}
        nodeColor={(node: any) => {
          const isSearchActive = Boolean(searchQuery && searchQuery.trim());
          const isMatch = matchesQuery(node);
          const isFilterMatch = matchesFilterMode(node);
          const isNodeHighlighted = (!selectedTag || (node.type === 'tag' ? node.tagName === selectedTag : node.tags?.includes(selectedTag))) &&
            (!isSearchActive || isMatch) && isFilterMatch;

          const defaultFallback = isDark ? '#FF4F00' : '#D9531E';
          const dimColor = isDark ? 'rgba(128, 128, 128, 0.05)' : 'rgba(24, 24, 27, 0.04)';

          if (hoveredNode) {
            const isHovered = node.id === hoveredNode.id;
            const isNeighbor = graphData.links.some(l => {
              const sId = typeof l.source === 'object' ? l.source.id : l.source;
              const tId = typeof l.target === 'object' ? l.target.id : l.target;
              return (sId === hoveredNode.id && tId === node.id) || (tId === hoveredNode.id && sId === node.id);
            });
            return (isHovered || isNeighbor) ? (node.color || defaultFallback) : dimColor;
          }
          return isNodeHighlighted ? (node.color || defaultFallback) : dimColor;
        }}
        linkColor={(link: any) => {
          const defaultFallback = isDark ? '#FF4F00' : '#D9531E';
          const dimColor = isDark ? 'rgba(128, 128, 128, 0.02)' : 'rgba(24, 24, 27, 0.02)';
          const sourceColor = typeof link.source === 'object' ? link.source.color : (link.color || defaultFallback);
          const sId = typeof link.source === 'object' ? link.source.id : link.source;
          const tId = typeof link.target === 'object' ? link.target.id : link.target;

          if (hoveredNode) {
            const isConnected = sId === hoveredNode.id || tId === hoveredNode.id;
            return isConnected ? hexToRgba(sourceColor, isDark ? 0.55 : 0.45) : dimColor;
          }

          if (searchQuery && searchQuery.trim()) {
            const sMatch = typeof link.source === 'object' ? matchesQuery(link.source) : false;
            const tMatch = typeof link.target === 'object' ? matchesQuery(link.target) : false;
            return (sMatch || tMatch) ? hexToRgba(sourceColor, isDark ? 0.4 : 0.35) : dimColor;
          }

          if (!selectedTag) {
            return link.type === 'direct-synapse'
              ? hexToRgba(defaultFallback, isDark ? 0.6 : 0.5)
              : hexToRgba(sourceColor, isDark ? 0.18 : 0.12);
          }

          const sourceTags = typeof link.source === 'object' ? (link.source.tags || [link.source.tagName]) : [];
          const targetTags = typeof link.target === 'object' ? (link.target.tags || [link.target.tagName]) : [];
          const matchesTag = sourceTags.includes(selectedTag) || targetTags.includes(selectedTag);

          return matchesTag ? hexToRgba(sourceColor, isDark ? 0.45 : 0.35) : dimColor;
        }}
        linkWidth={(link: any) => {
          const sId = typeof link.source === 'object' ? link.source.id : link.source;
          const tId = typeof link.target === 'object' ? link.target.id : link.target;

          if (hoveredNode) {
            const isConnected = sId === hoveredNode.id || tId === hoveredNode.id;
            return isConnected ? 2.5 : 0.8;
          }
          return link.type === 'direct-synapse' ? 2 : 1.2;
        }}
        linkCanvasObjectMode={() => 'after'}
        linkCanvasObject={(link: any, ctx) => {
          const sId = typeof link.source === 'object' ? link.source.id : link.source;
          const tId = typeof link.target === 'object' ? link.target.id : link.target;
          const isHovered = hoveredNode && (sId === hoveredNode.id || tId === hoveredNode.id);

          if (!isHovered) return;

          const elapsed = Date.now() - hoverStartTime.current;
          const progress = Math.min(elapsed / 300, 1);
          const alpha = 1 - Math.pow(1 - progress, 3);
          const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
          const breathing = 0.4 + pulse * 0.2;
          const start = link.source;
          const end = link.target;

          if (typeof start !== 'object' || typeof end !== 'object') return;

          const linkStrokeColor = start.color || (isDark ? '#FF4F00' : '#D9531E');

          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.globalAlpha = breathing * alpha;
          ctx.strokeStyle = linkStrokeColor;
          ctx.lineWidth = (isDark ? 3 : 2.2) * alpha;
          ctx.lineCap = 'round';
          ctx.stroke();
          ctx.shadowBlur = (isDark ? 15 : 6) * alpha;
          ctx.shadowColor = linkStrokeColor;
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
        }}
        nodeRelSize={6}
        backgroundColor="transparent"
        warmupTicks={0}
        cooldownTicks={120}
        d3AlphaDecay={0.025}
        d3VelocityDecay={simulationParams.velocityDecay}
        d3AlphaMin={0.005}
        onNodeClick={(node: any) => {
          if (node.type === 'tag') {
            const nextTag = selectedTag === node.tagName ? null : node.tagName;
            onTagSelect?.(nextTag);
          } else {
            if (onSelectNote) {
              onSelectNote(node.originalNote || null);
            } else {
              router.push(`/?note=${node.id}`);
            }
          }
        }}
        onBackgroundClick={() => {
          onSelectNote?.(null);
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
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          if (node.x === undefined || node.y === undefined || isNaN(node.x) || isNaN(node.y)) return;

          const label = node.name;
          const fontSize = 12 / globalScale;
          const nodeR = node.val || 4;
          const isTag = node.type === 'tag';
          const isSearchActive = Boolean(searchQuery && searchQuery.trim());
          const isMatch = matchesQuery(node);
          const isFilterMatch = matchesFilterMode(node);

          const isNodeHighlighted = (!selectedTag || (isTag ? node.tagName === selectedTag : node.tags?.includes(selectedTag))) &&
            (!isSearchActive || isMatch) && isFilterMatch;

          const isHoveredNode = hoveredNode && node.id === hoveredNode.id;
          const isSelectedNote = selectedNoteId === node.id;
          const isNeighbor = hoveredNode && graphData.links.some(l => {
            const sId = typeof l.source === 'object' ? l.source.id : l.source;
            const tId = typeof l.target === 'object' ? l.target.id : l.target;
            return (sId === hoveredNode.id && tId === node.id) || (tId === hoveredNode.id && sId === node.id);
          });
          const shouldHighlight = hoveredNode ? (isHoveredNode || isNeighbor) : (isNodeHighlighted || isSelectedNote);

          let alpha = 1;
          if (isHoveredNode) {
            const elapsed = Date.now() - hoverStartTime.current;
            const progress = Math.min(elapsed / 300, 1);
            alpha = 1 - Math.pow(1 - progress, 3);
          }

          const defaultFallback = isDark ? '#FF4F00' : '#D9531E';
          const nodeColor = node.color || defaultFallback;
          const haloStrokeColor = isDark ? 'rgba(15, 15, 15, 0.95)' : 'rgba(249, 248, 246, 0.95)';

          if (isTag) {
            // PHASE 4: THEMATIC ISLAND (Cosmic background aura for this constellation)
            const auraRadius = Math.max(180, Math.min(420, (node.count || 1) * 32 + 150));
            const auraGradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, auraRadius);
            const auraOpacity = shouldHighlight ? (isDark ? 0.08 : 0.06) : (isDark ? 0.02 : 0.015);
            auraGradient.addColorStop(0, hexToRgba(nodeColor, auraOpacity));
            auraGradient.addColorStop(0.5, hexToRgba(nodeColor, auraOpacity * 0.4));
            auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = auraGradient;
            ctx.beginPath();
            ctx.arc(node.x, node.y, auraRadius, 0, 2 * Math.PI, false);
            ctx.fill();

            // Outer dashed orbit halo
            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeR + 4, 0, 2 * Math.PI, false);
            ctx.strokeStyle = shouldHighlight ? hexToRgba(nodeColor, isDark ? 0.6 : 0.5) : (isDark ? 'rgba(128, 128, 128, 0.12)' : 'rgba(24, 24, 27, 0.08)');
            ctx.lineWidth = 1.2;
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.setLineDash([]); // Reset line dash

            // Central Hub Body
            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeR, 0, 2 * Math.PI, false);
            ctx.fillStyle = shouldHighlight ? hexToRgba(nodeColor, 0.22) : (isDark ? 'rgba(128, 128, 128, 0.04)' : 'rgba(24, 24, 27, 0.03)');
            ctx.fill();
            ctx.strokeStyle = shouldHighlight ? nodeColor : (isDark ? 'rgba(128, 128, 128, 0.2)' : 'rgba(24, 24, 27, 0.15)');
            ctx.lineWidth = isHoveredNode ? 2.5 : 1.8;
            ctx.stroke();

            // Center core spark
            ctx.beginPath();
            ctx.arc(node.x, node.y, 2.5, 0, 2 * Math.PI, false);
            ctx.fillStyle = shouldHighlight ? nodeColor : (isDark ? 'rgba(128, 128, 128, 0.3)' : 'rgba(24, 24, 27, 0.25)');
            ctx.fill();

            // TAG HUB LABEL (Clean Halo typography - no black bars)
            const hubFontSize = Math.max(10, Math.min(14, 12 / globalScale));
            ctx.font = `bold ${hubFontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
            const hubText = `${label} (${node.count})`;
            const textX = node.x;
            const textY = node.y + nodeR + 6;

            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.lineWidth = 3 / globalScale;
            ctx.lineJoin = 'round';
            ctx.strokeStyle = haloStrokeColor;
            ctx.strokeText(hubText, textX, textY);

            ctx.fillStyle = shouldHighlight ? nodeColor : (isDark ? 'rgba(200, 200, 200, 0.6)' : 'rgba(24, 24, 27, 0.55)');
            ctx.fillText(hubText, textX, textY);
          } else {
            // RENDER NOTE NODE
            // Glow effect
            try {
              const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
              const pulseIntensity = pulse * 0.12;
              let glowOpacity = 0.04;
              if (shouldHighlight) {
                const baseOpacity = isHoveredNode ? 0.45 : (isSelectedNote ? 0.4 : 0.1);
                glowOpacity = (baseOpacity + pulseIntensity) * alpha;
              }
              const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, nodeR * (isHoveredNode ? 5 : 3.5));
              gradient.addColorStop(0, `${nodeColor}${Math.floor(glowOpacity * 255).toString(16).padStart(2, '0')}`);
              gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
              ctx.fillStyle = gradient;
              ctx.beginPath();
              ctx.arc(node.x, node.y, nodeR * (isHoveredNode ? 5 : 3.5), 0, 2 * Math.PI, false);
              ctx.fill();
            } catch (e) { }

            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeR * (isHoveredNode ? 1.3 : (isSelectedNote ? 1.25 : 1)), 0, 2 * Math.PI, false);
            ctx.fillStyle = shouldHighlight ? nodeColor : (isDark ? 'rgba(128, 128, 128, 0.15)' : 'rgba(24, 24, 27, 0.12)');
            ctx.fill();

            if (node.isBookmarked || isSelectedNote) {
              ctx.strokeStyle = isSelectedNote ? (isDark ? '#FFFFFF' : '#18181b') : '#D97706';
              ctx.lineWidth = isSelectedNote ? 2 : 1.5;
              ctx.stroke();
            }

            // LEVEL OF DETAIL (LOD) FOR NOTE LABELS:
            // Visible when zoomed in, hovered, bookmarked, selected, or matching search.
            const isSearchMatch = Boolean(isSearchActive && isMatch);
            const showNoteLabel = globalScale >= 1.15 || isHoveredNode || node.isBookmarked || isSearchMatch || isSelectedNote;

            if (showNoteLabel) {
              const noteTextColor = isDark ? '#E5E7EB' : '#18181b';
              const noteFontSize = Math.max(9, Math.min(13, 11 / globalScale));
              ctx.font = `${node.isBookmarked ? 'bold ' : ''}${noteFontSize}px Georgia, serif`;
              const textX = node.x;
              const textY = node.y + nodeR + 5;

              // 1. Halo contour in background color (Zero black boxes, 100% clean background)
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.lineWidth = 3 / globalScale;
              ctx.lineJoin = 'round';
              ctx.strokeStyle = haloStrokeColor;
              ctx.strokeText(label, textX, textY);

              // 2. Crisp foreground text
              ctx.fillStyle = shouldHighlight
                ? (isSearchMatch ? defaultFallback : (node.isBookmarked ? '#D97706' : noteTextColor))
                : (isDark ? 'rgba(200, 200, 200, 0.35)' : 'rgba(24, 24, 27, 0.35)');
              ctx.fillText(label, textX, textY);
            }
          }
        }}
      />

      <div className="absolute bottom-10 right-10 pointer-events-none text-right hidden md:block">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 text-[var(--foreground)]">Matriz de Constelações</p>
          <p className="text-sm font-mono font-bold text-[var(--foreground)]">{notes.length} Pensamentos Ativos</p>
          <div className="w-32 h-[1px] bg-[var(--accent)] ml-auto mt-2"></div>
        </div>
      </div>
    </div>
  );
}
