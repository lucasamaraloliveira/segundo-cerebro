'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Note } from '@/lib/types';
import { Sparkles, ZoomIn, ZoomOut, RotateCcw, ChevronRight, ChevronDown, Brain, Tag, Layers, ExternalLink } from 'lucide-react';

interface MindMapGroup {
  id: string;
  name: string;
  color: string;
  notes: Note[];
}

interface NeuralMindMapProps {
  notes: Note[];
  onSelectNote?: (note: Note) => void;
  selectedNoteId?: string | null;
  searchQuery?: string;
}

const PALETTE = [
  '#FF4F00', // Neural Orange
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#0D9488', // Teal
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
];

export default function NeuralMindMap({
  notes,
  onSelectNote,
  selectedNoteId,
  searchQuery = ''
}: NeuralMindMapProps) {
  // Estado de transformação do canvas (Pan e Zoom)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Grupos colapsados (armazenamos IDs dos grupos colapsados)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Estado da IA para agrupamento inteligente
  const [isAiClustering, setIsAiClustering] = useState(false);
  const [aiClusters, setAiClusters] = useState<{ name: string; color: string; noteIds: string[] }[] | null>(null);
  const [groupingMode, setGroupingMode] = useState<'tags' | 'ai'>('tags');

  // Centralizar visualização inicial
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPan({ x: rect.width / 2, y: rect.height / 2 });
    }
  }, []);

  // Alternar colapso de um grupo
  const toggleCollapseGroup = (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // 1. Agrupamento Local Heurístico por Tags
  const localTagGroups = useMemo<MindMapGroup[]>(() => {
    const tagMap = new Map<string, Note[]>();
    const untagged: Note[] = [];

    notes.forEach(note => {
      if (!note.tags || note.tags.length === 0) {
        untagged.push(note);
      } else {
        // Usa a primeira tag como grupo principal
        const primaryTag = note.tags[0].replace(/^#+/, '').trim().toLowerCase();
        if (!tagMap.has(primaryTag)) {
          tagMap.set(primaryTag, []);
        }
        tagMap.get(primaryTag)!.push(note);
      }
    });

    const groups: MindMapGroup[] = [];
    let colorIdx = 0;

    // Ordena grupos por quantidade de notas
    const sortedTags = Array.from(tagMap.entries()).sort((a, b) => b[1].length - a[1].length);

    sortedTags.forEach(([tag, groupNotes]) => {
      groups.push({
        id: `tag-${tag}`,
        name: `#${tag}`,
        color: PALETTE[colorIdx % PALETTE.length],
        notes: groupNotes
      });
      colorIdx++;
    });

    if (untagged.length > 0) {
      groups.push({
        id: 'untagged',
        name: 'Sem Categoria',
        color: '#6B7280',
        notes: untagged
      });
    }

    return groups;
  }, [notes]);

  // 2. Agrupamento por IA quando ativado
  const aiGroups = useMemo<MindMapGroup[] | null>(() => {
    if (!aiClusters || aiClusters.length === 0) return null;

    const noteMap = new Map(notes.map(n => [n.id, n]));
    const assignedIds = new Set<string>();

    const groups: MindMapGroup[] = aiClusters.map((cluster, idx) => {
      const clusterNotes: Note[] = [];
      cluster.noteIds.forEach(id => {
        const n = noteMap.get(id);
        if (n) {
          clusterNotes.push(n);
          assignedIds.add(id);
        }
      });

      return {
        id: `ai-${idx}-${cluster.name}`,
        name: cluster.name,
        color: cluster.color || PALETTE[idx % PALETTE.length],
        notes: clusterNotes
      };
    }).filter(g => g.notes.length > 0);

    // Notas restantes que a IA não categorizou
    const unassigned = notes.filter(n => !assignedIds.has(n.id));
    if (unassigned.length > 0) {
      groups.push({
        id: 'ai-outras',
        name: 'Gerais & Diversas',
        color: '#6B7280',
        notes: unassigned
      });
    }

    return groups;
  }, [aiClusters, notes]);

  // Grupos finais ativos de acordo com o modo
  const activeGroups = useMemo(() => {
    return (groupingMode === 'ai' && aiGroups) ? aiGroups : localTagGroups;
  }, [groupingMode, aiGroups, localTagGroups]);

  // Auto-expandir ramo caso a nota selecionada esteja dentro de um grupo colapsado
  useEffect(() => {
    if (!selectedNoteId) return;
    const parentGroup = activeGroups.find(g => g.notes.some(n => n.id === selectedNoteId));
    if (parentGroup && collapsedGroups.has(parentGroup.id)) {
      setCollapsedGroups(prev => {
        const next = new Set(prev);
        next.delete(parentGroup.id);
        return next;
      });
    }
  }, [selectedNoteId, activeGroups, collapsedGroups]);

  // Ação de solicitar agrupamento com IA
  const handleAiCluster = async () => {
    if (isAiClustering || notes.length === 0) return;
    setIsAiClustering(true);

    try {
      const lightweightNotes = notes.map(n => ({
        id: n.id,
        title: n.title,
        tags: n.tags
      }));

      const res = await fetch('/api/ai/mindmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: lightweightNotes })
      });

      const data = await res.json();
      if (data.groups && Array.isArray(data.groups) && data.groups.length > 0) {
        setAiClusters(data.groups);
        setGroupingMode('ai');
      } else {
        alert('A IA não sugeriu novos grupos no momento. Mantendo agrupamento por tags.');
      }
    } catch (e) {
      console.error('Erro ao agrupar com IA:', e);
      alert('Não foi possível gerar agrupamento com a IA. Mantendo o modo local.');
    } finally {
      setIsAiClustering(false);
    }
  };

  // Handlers de Pan e Drag no Canvas
  const handleMouseDown = (e: React.MouseEvent) => {
    // Apenas clique primário (esquerdo)
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  }, [isDragging]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom(prev => Math.min(Math.max(prev * zoomFactor, 0.3), 2.5));
  };

  const resetView = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPan({ x: rect.width / 2, y: rect.height / 2 });
      setZoom(1);
    }
  };

  // Layout Bilateral (Metade dos grupos para a direita, metade para a esquerda)
  const layout = useMemo(() => {
    const half = Math.ceil(activeGroups.length / 2);
    const rightGroups = activeGroups.slice(0, half);
    const leftGroups = activeGroups.slice(half);

    const GROUP_X_OFFSET = 260;
    const NOTE_X_OFFSET = 220;
    const ITEM_HEIGHT = 44;

    const calculateBranch = (groups: MindMapGroup[], side: 'right' | 'left') => {
      let currentY = 0;
      const branchNodes: any[] = [];

      // Primeiro calcula altura total para centralizar verticalmente
      const heights = groups.map(g => {
        const isCollapsed = collapsedGroups.has(g.id);
        const notesCount = isCollapsed ? 0 : g.notes.length;
        return Math.max(ITEM_HEIGHT + 16, notesCount * ITEM_HEIGHT + 24);
      });

      const totalHeight = heights.reduce((sum, h) => sum + h, 0);
      let startY = -totalHeight / 2;

      groups.forEach((g, idx) => {
        const isCollapsed = collapsedGroups.has(g.id);
        const groupHeight = heights[idx];
        const groupY = startY + groupHeight / 2;
        const groupX = side === 'right' ? GROUP_X_OFFSET : -GROUP_X_OFFSET;

        const noteNodes: any[] = [];
        if (!isCollapsed) {
          const notesTotalHeight = g.notes.length * ITEM_HEIGHT;
          const notesStartY = groupY - notesTotalHeight / 2 + ITEM_HEIGHT / 2;

          g.notes.forEach((note, noteIdx) => {
            const noteY = notesStartY + noteIdx * ITEM_HEIGHT;
            const noteX = side === 'right' 
              ? groupX + NOTE_X_OFFSET 
              : groupX - NOTE_X_OFFSET;

            noteNodes.push({
              note,
              x: noteX,
              y: noteY
            });
          });
        }

        branchNodes.push({
          group: g,
          x: groupX,
          y: groupY,
          isCollapsed,
          side,
          notes: noteNodes
        });

        startY += groupHeight;
      });

      return branchNodes;
    };

    const rightBranches = calculateBranch(rightGroups, 'right');
    const leftBranches = calculateBranch(leftGroups, 'left');

    return [...rightBranches, ...leftBranches];
  }, [activeGroups, collapsedGroups]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  return (
    <div 
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      className={`relative w-full h-full overflow-hidden select-none bg-[var(--background)] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      {/* HUD de Controles Superior */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
        {/* Toggle de Modo: Tags vs IA */}
        <div className="flex bg-[var(--muted)] p-1 border border-[var(--border)] shadow-[4px_4px_0px_rgba(0,0,0,0.08)]">
          <button
            onClick={() => setGroupingMode('tags')}
            className={`px-3 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
              groupingMode === 'tags' 
                ? 'bg-[var(--accent)] text-white shadow-sm' 
                : 'text-[var(--foreground)]/50 hover:text-[var(--foreground)]'
            }`}
          >
            <Tag className="w-2.5 h-2.5 inline mr-1" />
            Por Tags
          </button>
          <button
            onClick={() => {
              if (!aiClusters) {
                handleAiCluster();
              } else {
                setGroupingMode('ai');
              }
            }}
            disabled={isAiClustering}
            className={`px-3 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
              groupingMode === 'ai' 
                ? 'bg-[#FF4F00] text-white shadow-sm' 
                : 'text-[var(--foreground)]/50 hover:text-[var(--foreground)]'
            }`}
          >
            <Sparkles className={`w-3 h-3 ${isAiClustering ? 'animate-spin' : ''}`} />
            <span>{isAiClustering ? 'Agrupando...' : aiClusters ? 'Por IA' : 'Agrupar com IA'}</span>
          </button>
        </div>

        {/* Controles de Zoom */}
        <div className="flex bg-[var(--muted)] p-1 border border-[var(--border)] shadow-[4px_4px_0px_rgba(0,0,0,0.08)]">
          <button 
            onClick={() => setZoom(z => Math.min(z * 1.2, 2.5))}
            className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition-colors"
            title="Aproximar"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setZoom(z => Math.max(z * 0.8, 0.3))}
            className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition-colors"
            title="Afastar"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={resetView}
            className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition-colors"
            title="Resetar Posição"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Legenda Informativa Inferior */}
      <div className="absolute bottom-4 left-4 z-30 pointer-events-none text-[9px] font-mono opacity-50 bg-[var(--background)]/80 backdrop-blur-sm px-3 py-1.5 border border-[var(--border)]">
        <span>Arraste para mover • Scroll para zoom • Clique no grupo para expandir</span>
      </div>

      {/* Canvas SVG Interativo */}
      <svg className="w-full h-full absolute inset-0">
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          
          {/* Conexões Curvas (Bézier Cubic Paths) */}
          {layout.map(branch => {
            // Curva da Raiz até o Grupo
            const rootControlX = branch.side === 'right' ? 120 : -120;
            const groupControlX = branch.side === 'right' ? branch.x - 100 : branch.x + 100;
            const rootPath = `M 0 0 C ${rootControlX} 0, ${groupControlX} ${branch.y}, ${branch.x} ${branch.y}`;

            return (
              <g key={`branch-lines-${branch.group.id}`}>
                <path
                  d={rootPath}
                  fill="none"
                  stroke={branch.group.color}
                  strokeWidth="2"
                  strokeOpacity="0.6"
                  strokeDasharray="4 4"
                />

                {/* Curvas do Grupo para cada Nota */}
                {!branch.isCollapsed && branch.notes.map((nNode: any) => {
                  const gControlX = branch.side === 'right' ? branch.x + 80 : branch.x - 80;
                  const noteControlX = branch.side === 'right' ? nNode.x - 80 : nNode.x + 80;
                  const notePath = `M ${branch.x} ${branch.y} C ${gControlX} ${branch.y}, ${noteControlX} ${nNode.y}, ${nNode.x} ${nNode.y}`;

                  return (
                    <path
                      key={`note-line-${nNode.note.id}`}
                      d={notePath}
                      fill="none"
                      stroke={branch.group.color}
                      strokeWidth="1.5"
                      strokeOpacity="0.35"
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Nó Central (Raiz) */}
          <g className="cursor-pointer">
            <rect
              x="-80"
              y="-24"
              width="160"
              height="48"
              fill="var(--background)"
              stroke="var(--accent)"
              strokeWidth="2.5"
              className="shadow-xl"
            />
            <text
              x="0"
              y="5"
              textAnchor="middle"
              className="fill-[var(--foreground)] font-sans font-bold text-xs uppercase tracking-widest pointer-events-none"
            >
              Segundo Cérebro
            </text>
            <circle cx="0" cy="0" r="3" fill="var(--accent)" />
          </g>

          {/* Nós dos Grupos e Notas */}
          {layout.map(branch => {
            const isMatchGroup = normalizedSearch && branch.group.name.toLowerCase().includes(normalizedSearch);

            return (
              <g key={`branch-nodes-${branch.group.id}`}>
                {/* Nó do Grupo */}
                <g 
                  transform={`translate(${branch.x}, ${branch.y})`}
                  onClick={(e) => toggleCollapseGroup(branch.group.id, e)}
                  className="cursor-pointer group"
                >
                  <rect
                    x="-90"
                    y="-18"
                    width="180"
                    height="36"
                    fill="var(--background)"
                    stroke={branch.group.color}
                    strokeWidth={isMatchGroup ? "2.5" : "1.8"}
                    className="transition-all hover:fill-[var(--muted)]"
                  />
                  {/* Marcador lateral colorido */}
                  <rect
                    x="-90"
                    y="-18"
                    width="4"
                    height="36"
                    fill={branch.group.color}
                  />
                  <text
                    x="-76"
                    y="4"
                    className="fill-[var(--foreground)] font-sans font-semibold text-[11px] truncate pointer-events-none"
                  >
                    {branch.group.name.length > 18 ? `${branch.group.name.slice(0, 18)}...` : branch.group.name}
                  </text>
                  
                  {/* Badge de contagem e botão colapsar */}
                  <g transform="translate(68, 0)">
                    <circle r="10" fill={branch.group.color} fillOpacity="0.15" />
                    <text
                      y="3.5"
                      textAnchor="middle"
                      className="font-mono font-bold text-[9px] pointer-events-none"
                      fill={branch.group.color}
                    >
                      {branch.group.notes.length}
                    </text>
                  </g>
                </g>

                {/* Nós das Notas (Filhos do Grupo) */}
                {!branch.isCollapsed && branch.notes.map((nNode: any) => {
                  const note = nNode.note;
                  const isSelected = selectedNoteId === note.id;
                  const isMatchNote = normalizedSearch && (
                    (note.title && note.title.toLowerCase().includes(normalizedSearch)) ||
                    (note.tags && note.tags.some((t: string) => t.toLowerCase().includes(normalizedSearch)))
                  );
                  const opacity = normalizedSearch && !isMatchNote && !isMatchGroup ? 0.3 : 1;

                  return (
                    <g
                      key={`node-${note.id}`}
                      transform={`translate(${nNode.x}, ${nNode.y})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectNote) onSelectNote(note);
                      }}
                      className="cursor-pointer transition-opacity group"
                      opacity={opacity}
                    >
                      <rect
                        x="-85"
                        y="-15"
                        width="170"
                        height="30"
                        fill={isSelected ? branch.group.color : "var(--background)"}
                        stroke={isSelected ? branch.group.color : "var(--border)"}
                        strokeWidth={isMatchNote ? "2" : "1"}
                        className="transition-all hover:stroke-[var(--accent)] hover:fill-[var(--muted)]/50"
                      />
                      <text
                        x="-74"
                        y="4"
                        className={`font-sans text-[10px] truncate pointer-events-none ${
                          isSelected 
                            ? 'fill-white font-bold' 
                            : 'fill-[var(--foreground)] font-medium group-hover:fill-[var(--accent)]'
                        }`}
                      >
                        {note.title ? (note.title.length > 20 ? `${note.title.slice(0, 20)}...` : note.title) : 'Sem título'}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

        </g>
      </svg>
    </div>
  );
}
