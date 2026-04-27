'use client';

import React, { useMemo } from 'react';
import { Note } from '@/lib/types';
import { 
  format, 
  subDays, 
  isSameDay, 
  eachDayOfInterval, 
  startOfToday, 
  differenceInDays,
  startOfMonth,
  endOfMonth
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'motion/react';
import { Flame, Ghost, Info } from 'lucide-react';

interface NeuralHeatmapProps {
  notes: Note[];
}

export default function NeuralHeatmap({ notes }: NeuralHeatmapProps) {
  // 1. Activity Data (Last 90 days)
  const activityData = useMemo(() => {
    const today = startOfToday();
    const startDate = subDays(today, 90);
    const interval = eachDayOfInterval({ start: startDate, end: today });

    return interval.map(day => {
      const count = notes.filter(n => {
        if (!n.updatedAt) return false;
        return isSameDay(n.updatedAt.toDate(), day);
      }).length;

      return {
        day,
        count,
        intensity: Math.min(count, 4) // cap at 4 for visualization
      };
    });
  }, [notes]);

  // 2. Knowledge Pulse (Tags by focus vs forgotten)
  const tagInsights = useMemo(() => {
    const today = new Date();
    const tagMap: { [key: string]: { count: number, lastSeen: Date } } = {};

    notes.forEach(note => {
      if (!note.tags || !note.updatedAt) return;
      const date = note.updatedAt.toDate();
      note.tags.forEach(tag => {
        if (!tagMap[tag]) {
          tagMap[tag] = { count: 0, lastSeen: date };
        }
        tagMap[tag].count += 1;
        if (date > tagMap[tag].lastSeen) {
          tagMap[tag].lastSeen = date;
        }
      });
    });

    const entries = Object.entries(tagMap).map(([name, data]) => ({
      name,
      ...data,
      daysSinceLastSeen: differenceInDays(today, data.lastSeen)
    }));

    return {
      topFocus: [...entries].sort((a, b) => b.count - a.count).slice(0, 8),
      forgotten: [...entries].sort((a, b) => b.daysSinceLastSeen - a.daysSinceLastSeen).slice(0, 8)
    };
  }, [notes]);

  if (notes.length === 0) return null;

  const intensityColors = [
    'bg-[var(--muted)] opacity-20',
    'bg-[var(--accent)] opacity-30',
    'bg-[var(--accent)] opacity-50',
    'bg-[var(--accent)] opacity-75',
    'bg-[var(--accent)] opacity-100'
  ];

  return (
    <div className="w-full max-w-5xl mx-auto p-8 bg-[var(--background)] space-y-16">
      {/* Activity Section */}
      <section>
        <div className="flex items-center gap-3 mb-8">
          <Flame className="w-6 h-6 text-orange-500" />
          <div>
            <h2 className="text-2xl font-serif italic tracking-tight">Pulso de Atividade</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Frequência de conexões nos últimos 90 dias</p>
          </div>
        </div>

        <div className="bg-[var(--muted)]/20 border border-[var(--border)] p-8 shadow-[10px_10px_0px_rgba(0,0,0,0.05)]">
          <div className="flex flex-wrap gap-2 justify-center">
            {activityData.map((data, i) => (
              <div 
                key={i}
                className={`w-4 h-4 rounded-sm transition-all hover:scale-125 hover:z-10 cursor-help ${intensityColors[data.intensity]}`}
                title={`${format(data.day, 'dd/MM')}: ${data.count} notas atualizadas`}
              />
            ))}
          </div>
          <div className="mt-6 flex justify-center items-center gap-4 text-[9px] font-bold uppercase tracking-widest opacity-30">
            <span>Menos ativo</span>
            <div className="flex gap-1">
              {intensityColors.map((c, i) => <div key={i} className={`w-3 h-3 ${c}`} />)}
            </div>
            <span>Mais ativo</span>
          </div>
        </div>
      </section>

      {/* Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Top Focus */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-none">
              <Flame className="w-4 h-4 text-orange-500" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-widest">Áreas de Foco</h3>
          </div>
          <div className="space-y-4">
            {tagInsights.topFocus.map(tag => (
              <div key={tag.name} className="relative p-4 bg-[var(--muted)]/30 border border-[var(--border)] overflow-hidden group">
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-[var(--accent)]/10 transition-all duration-1000" 
                  style={{ width: `${Math.min(100, (tag.count / notes.length) * 300)}%` }} 
                />
                <div className="relative flex justify-between items-center">
                  <span className="font-serif italic text-lg text-[var(--accent)]">#{tag.name}</span>
                  <span className="text-[10px] font-bold opacity-40">{tag.count} notas</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Forgotten Knowledge */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-none">
              <Ghost className="w-4 h-4 text-blue-500" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-widest">Conhecimento Esquecido</h3>
          </div>
          <div className="space-y-4">
            {tagInsights.forgotten.map(tag => (
              <div key={tag.name} className="p-4 border border-[var(--border)] border-dashed hover:border-blue-400 transition-colors group">
                <div className="flex justify-between items-center">
                  <span className="font-serif italic text-lg opacity-60 group-hover:opacity-100">#{tag.name}</span>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-blue-500 opacity-60">Sem visitas há {tag.daysSinceLastSeen} dias</p>
                    <p className="text-[8px] uppercase tracking-tighter opacity-30 italic">Último acesso: {format(tag.lastSeen, 'MMM yyyy', { locale: ptBR })}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Info Footer */}
      <div className="flex items-start gap-3 p-6 bg-blue-500/5 border border-blue-500/10 rounded-none text-blue-500">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed italic font-serif">
          Sua rede neural de conhecimento é viva. Áreas com menos atividade tendem a se desconectar do fluxo de pensamento atual. Tente revisitar o "Conhecimento Esquecido" para reforçar sinapses antigas.
        </p>
      </div>
    </div>
  );
}
