'use client';

import React, { useMemo } from 'react';
import { Note } from '@/lib/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'motion/react';
import { Clock, FileText } from 'lucide-react';

interface NeuralTimelineProps {
  notes: Note[];
}

export default function NeuralTimeline({ notes }: NeuralTimelineProps) {
  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => {
      const dateA = a.updatedAt?.toDate().getTime() || 0;
      const dateB = b.updatedAt?.toDate().getTime() || 0;
      return dateB - dateA;
    });
  }, [notes]);

  const groupedNotes = useMemo(() => {
    const groups: { [key: string]: Note[] } = {};
    sortedNotes.forEach(note => {
      if (!note.updatedAt) return;
      const monthYear = format(note.updatedAt.toDate(), "MMMM 'de' yyyy", { locale: ptBR });
      if (!groups[monthYear]) groups[monthYear] = [];
      groups[monthYear].push(note);
    });
    return Object.entries(groups);
  }, [sortedNotes]);

  if (notes.length === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto p-8 bg-[var(--background)]">
      <div className="flex items-center gap-3 mb-12 border-b border-[var(--border)] pb-6">
        <Clock className="w-6 h-6 text-[var(--accent)]" />
        <div>
          <h2 className="text-2xl font-serif italic tracking-tight">Linha do Tempo Neural</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Evolução cronológica de pensamentos</p>
        </div>
      </div>

      <div className="relative pl-8 border-l border-[var(--border)] space-y-16 ml-4">
        {groupedNotes.map(([month, monthNotes], groupIndex) => (
          <div key={month} className="relative">
            {/* Month Marker */}
            <div className="absolute -left-[41px] top-0 w-4 h-4 bg-[var(--background)] border-2 border-[var(--accent)] rounded-full z-10" />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--accent)] mb-8 bg-[var(--background)] inline-block px-2 -ml-2">
              {month}
            </h3>

            <div className="space-y-8">
              {monthNotes.map((note, noteIndex) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: noteIndex * 0.1 }}
                  key={note.id} 
                  className="group relative bg-[var(--muted)]/30 border border-[var(--border)] p-6 hover:border-[var(--accent)] transition-all shadow-[4px_4px_0px_rgba(0,0,0,0.05)] hover:shadow-[8px_8px_0px_rgba(0,0,0,0.1)] hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 text-[10px] font-mono opacity-40">
                      <FileText className="w-3 h-3" />
                      <span>{note.updatedAt ? format(note.updatedAt.toDate(), 'dd/MM/yyyy HH:mm') : 'Data desconhecida'}</span>
                    </div>
                    <div className="flex gap-1">
                      {note.tags?.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[8px] font-bold uppercase tracking-tighter px-1.5 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)]">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <h4 className="text-lg font-serif font-bold mb-2 group-hover:text-[var(--accent)] transition-colors leading-tight">
                    {note.title || 'Sem título'}
                  </h4>
                  
                  <p className="text-xs opacity-60 line-clamp-3 leading-relaxed font-serif italic">
                    {note.content?.replace(/<[^>]*>/g, '').slice(0, 200)}...
                  </p>

                  <div className="absolute -left-[41px] top-8 w-4 h-[1px] bg-[var(--border)] group-hover:bg-[var(--accent)] transition-colors" />
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
