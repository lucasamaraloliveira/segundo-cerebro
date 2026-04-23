'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Plus, 
  Tag, 
  Trash2, 
  LayoutDashboard, 
  Moon, 
  Sun, 
  Command,
  FileText,
  ArrowRight
} from 'lucide-react';
import { Note } from '@/lib/types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  onAction: (action: string, payload?: any) => void;
}

export default function CommandPalette({ isOpen, onClose, notes, onAction }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands = [
    { id: 'create', icon: Plus, label: 'Nova Nota', description: 'Criar um novo pensamento', shortcut: 'N' },
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard Neural', description: 'Ver mapa de conexões', shortcut: 'D' },
    { id: 'theme', icon: Moon, label: 'Trocar Tema', description: 'Alternar entre claro e escuro', shortcut: 'T' },
    { id: 'tag', icon: Tag, label: 'Adicionar Etiqueta', description: 'Organizar nota ativa', shortcut: 'L' },
  ];

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase();
    
    const matchedCommands = commands.filter(c => 
      c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    ).map(c => ({ ...c, type: 'command' }));

    const matchedNotes = notes.filter(n => 
      n.title.toLowerCase().includes(q) || (n.tags && n.tags.some(t => t.toLowerCase().includes(q)))
    ).slice(0, 5).map(n => ({ 
      id: n.id, 
      label: n.title || 'Sem título', 
      description: n.tags?.join(', ') || 'Sem tags',
      icon: FileText,
      type: 'note'
    }));

    return [...matchedCommands, ...matchedNotes];
  }, [query, notes]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filteredItems[selectedIndex];
        if (item) {
          handleExecute(item);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredItems]);

  const handleExecute = (item: any) => {
    if (item.type === 'command') {
      onAction(item.id);
    } else {
      onAction('open_note', item.id);
    }
    onClose();
    setQuery('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative w-full max-w-2xl bg-[var(--background)] border border-[var(--border)] shadow-[40px_40px_0px_rgba(0,0,0,0.1)] overflow-hidden"
          >
            {/* Search Input */}
            <div className="flex items-center gap-4 px-6 py-5 border-b border-[var(--border)] bg-[var(--muted)]/30">
              <Command className="w-5 h-5 opacity-30" />
              <input
                autoFocus
                type="text"
                placeholder="O que você deseja fazer? (ou busque uma nota...)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-lg font-serif italic placeholder:opacity-30"
              />
              <div className="px-2 py-1 border border-[var(--border)] text-[9px] font-bold opacity-30">
                ESC
              </div>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
              {filteredItems.length > 0 ? (
                <div className="py-2">
                  {filteredItems.map((item, index) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => handleExecute(item)}
                      className={`w-full flex items-center justify-between px-6 py-4 transition-all ${index === selectedIndex ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--muted)]'}`}
                    >
                      <div className="flex items-center gap-4">
                        <item.icon className={`w-4 h-4 ${index === selectedIndex ? 'opacity-100' : 'opacity-40'}`} />
                        <div className="text-left">
                          <p className="text-sm font-bold uppercase tracking-widest">{item.label}</p>
                          <p className={`text-[10px] opacity-60 ${index === selectedIndex ? 'text-white/70' : ''}`}>{item.description}</p>
                        </div>
                      </div>
                      
                      {index === selectedIndex && (
                        <motion.div layoutId="arrow" className="flex items-center gap-2">
                          <span className="text-[9px] font-bold opacity-50 uppercase tracking-tighter">Executar</span>
                          <ArrowRight className="w-3 h-3" />
                        </motion.div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-12 text-center opacity-30">
                  <p className="text-sm font-serif italic">Nenhum comando ou nota encontrada...</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-[var(--muted)]/20 border-t border-[var(--border)] flex items-center justify-between text-[8px] font-bold uppercase tracking-[0.2em] opacity-40">
              <div className="flex gap-4">
                <span>↑↓ Navegar</span>
                <span>ENTER Selecionar</span>
              </div>
              <span>Terminal Neural v1.0</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
