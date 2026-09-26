'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, signIn, logOut } from '@/lib/firebase';
import { Note, NoteReminder } from '@/lib/types';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Copy,
  Search as SearchIcon,
  LogOut,
  MoreVertical,
  Tag as TagIcon,
  ArrowLeft,
  Settings,
  Layers,
  Brain,
  ChevronRight,
  FileText,
  Star,
  Bell,
  Sparkles,
  Printer,
  Maximize2,
  Trash2,
  Calendar,
  Search,
  Menu,
  Command,
  Filter,
  Bookmark,
  Sun,
  Moon,
  Layout,
  ArrowRight,
  Undo2,
  AlertTriangle,
  RotateCcw,
  Mic,
  X,
  CheckCircle,
  Circle,
  Check,
  Clock,
  Info,
  RefreshCw
} from 'lucide-react';
import { APP_VERSION, APP_NAME } from '@/lib/version';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Removido import do SDK do Google no frontend por segurança
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
  ssr: false,
  loading: () => <div className="h-[60vh] w-full animate-pulse bg-black/5 rounded-none" />
});

const CommandPalette = dynamic(() => import('@/components/CommandPalette'), { ssr: false });
const AIAssistantModal = dynamic(() => import('@/components/AIAssistantModal'), { ssr: false });
import BrutalistDateTimePicker from '@/components/BrutalistDateTimePicker';

// Helper to strip HTML for previews
const stripHtml = (html: string) => {
  if (typeof window === 'undefined') return html;
  const doc = new Range().createContextualFragment(html);
  return doc.textContent || "";
};


const normalizeTag = (raw: string): string => {
  if (!raw) return '';
  return raw
    .replace(/^#+/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
};

const getNoteExpiryStatus = (note: Note): 'overdue' | 'due-soon' | 'normal' => {
  if (note.isCompleted || !note.expiryDate) return 'normal';
  const now = Date.now();
  const expiry = note.expiryDate.toDate ? note.expiryDate.toDate().getTime() : ((note.expiryDate as any).seconds ? (note.expiryDate as any).seconds * 1000 : 0);
  if (expiry <= 0) return 'normal';
  if (expiry < now) return 'overdue';
  const diffHours = (expiry - now) / (1000 * 60 * 60);
  if (diffHours <= 24) return 'due-soon';
  return 'normal';
};

const NoteCard = React.memo(({
  note,
  isActive,
  onClick,
  onToggleComplete,
  onSnooze
}: {
  note: Note,
  isActive: boolean,
  onClick: () => void,
  onToggleComplete: (e: React.MouseEvent) => void,
  onSnooze?: (e: React.MouseEvent) => void
}) => {
  const expiryStatus = getNoteExpiryStatus(note);

  const cardStyle = useMemo(() => {
    if (note.isCompleted) {
      return isActive
        ? 'bg-[var(--muted)] border-[var(--accent)] opacity-60'
        : 'border-[var(--border)] hover:border-[var(--foreground)]/10 hover:bg-[var(--muted)]/50 opacity-60';
    }
    if (expiryStatus === 'overdue') {
      return isActive
        ? 'bg-red-500/[0.12] dark:bg-red-500/[0.14] border-red-500 shadow-sm'
        : 'bg-red-500/[0.05] dark:bg-red-500/[0.07] border-red-500/35 hover:border-red-500/60 hover:bg-red-500/[0.09]';
    }
    if (expiryStatus === 'due-soon') {
      return isActive
        ? 'bg-amber-500/[0.12] dark:bg-amber-500/[0.14] border-amber-500 shadow-sm'
        : 'bg-amber-500/[0.05] dark:bg-amber-500/[0.07] border-amber-500/30 hover:border-amber-500/55 hover:bg-amber-500/[0.09]';
    }
    return isActive
      ? 'bg-[var(--muted)] border-[var(--accent)] shadow-sm'
      : 'border-[var(--border)] hover:border-[var(--foreground)]/10 hover:bg-[var(--muted)]/50';
  }, [isActive, expiryStatus, note.isCompleted]);

  return (
    <motion.div
      layout
      onClick={onClick}
      className={`p-6 border transition-all cursor-pointer mb-3 rounded-none group ${cardStyle}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-[10px] font-bold uppercase tracking-tighter opacity-40 text-[var(--foreground)]">
            {note.updatedAt ? format(note.updatedAt.toDate(), 'dd MMM', { locale: ptBR }) : 'Agora'}
          </p>
          {note.isTemporary && (
            <span className="text-[7px] font-bold bg-[#FF4F00] text-white px-1.5 py-0.5 rounded flex items-center gap-0.5 animate-pulse tracking-widest uppercase">
              <Clock size={8} /> Temp
            </span>
          )}
          {expiryStatus === 'overdue' && (
            <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-500/10 px-1.5 py-0.5 border border-red-500/25 flex items-center gap-1">
              <AlertTriangle size={8} /> Atrasada
            </span>
          )}
          {expiryStatus === 'due-soon' && (
            <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 border border-amber-500/25 flex items-center gap-1">
              <Clock size={8} /> Vence em breve
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {expiryStatus === 'overdue' && onSnooze && (
            <button
              onClick={onSnooze}
              title="Adiar por 1 dia (+24h)"
              className="text-[9px] font-mono font-bold text-red-600 dark:text-red-400 opacity-60 hover:opacity-100 hover:bg-red-500/15 px-1.5 py-0.5 border border-red-500/20 transition-all cursor-pointer hidden group-hover:inline-block"
            >
              +1d
            </button>
          )}
          <button
            onClick={onToggleComplete}
            title={note.isCompleted ? 'Desmarcar' : 'Marcar como concluída'}
            className={`w-5 h-5 border-2 rounded-full flex items-center justify-center transition-all ${note.isCompleted ? 'bg-[#FF4F00] border-[#FF4F00] text-white' : 'border-[var(--border)] hover:border-[#FF4F00] text-transparent'}`}
          >
            {note.isCompleted && <Check size={12} strokeWidth={3} />}
          </button>
          {note.isBookmarked && <Bookmark className="w-3 h-3 fill-[var(--accent)] text-[var(--accent)] opacity-30" />}
        </div>
      </div>
      <h3 className={`font-sans font-semibold text-base leading-snug tracking-tight mb-1 line-clamp-3 text-[var(--foreground)] ${note.isCompleted ? 'line-through opacity-40' : ''}`}>
        {note.title || 'Sem título'}
      </h3>
      <p className={`text-[13px] opacity-60 line-clamp-2 leading-tight text-[var(--foreground)] ${note.isCompleted ? 'line-through opacity-40' : ''}`}>
        {stripHtml(note.content) || 'Sem conteúdo...'}
      </p>
    </motion.div>
  );
});

NoteCard.displayName = 'NoteCard';

const TagButton = React.memo(({
  tag,
  isActive,
  onClick
}: {
  tag: string,
  isActive: boolean,
  onClick: () => void
}) => (
  <button
    onClick={onClick}
    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${isActive ? 'bg-[var(--accent)] text-[var(--accent-foreground)]' : 'bg-[var(--muted)] hover:bg-black/10 dark:hover:bg-white/10 text-[var(--foreground)]'}`}
  >
    #{tag}
  </button>
));

TagButton.displayName = 'TagButton';


const ActiveNoteEditor = React.memo(({ activeNote, updateNote, isFullscreen, isAiLoading, handleAiAction, exportAsPDF, deleteNote, cloneNote, setIsFullscreen, setIsTagModalOpen, setNewTagInput, relatedNotes, setActiveNoteId, setIsAIAssistantOpen, backlinks, allNotes, refreshKey, setTagToDelete, setIsTagDeleteModalOpen, onSelectionChange, replaceSelectionContent, onReplaceSelectionComplete, hasSelection }: any) => {
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [localTitle, setLocalTitle] = useState(activeNote.title || '');
  const [localContent, setLocalContent] = useState(activeNote.content || '');
  const [showAllTags, setShowAllTags] = useState(false);
  const [isTempModalOpen, setIsTempModalOpen] = useState(false);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const actionsButtonRef = useRef<HTMLButtonElement>(null);
  const [actionsCoords, setActionsCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const localTitleRef = useRef(activeNote.id);
  const [isAddingReminder, setIsAddingReminder] = useState(false);
  const [newReminderDate, setNewReminderDate] = useState<Date | null>(null);
  const [newReminderLabel, setNewReminderLabel] = useState('');

  // Auto-close dropdowns when scrolling
  useEffect(() => {
    if (!isActionsDropdownOpen && !isTempModalOpen) return;
    const handleScroll = () => {
      if (isActionsDropdownOpen) setIsActionsDropdownOpen(false);
      if (isTempModalOpen) setIsTempModalOpen(false);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isActionsDropdownOpen, isTempModalOpen]);

  // Auto-resize title textarea
  React.useLayoutEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = 'auto';
      const computedHeight = Math.max(titleRef.current.scrollHeight, 44);
      titleRef.current.style.height = `${computedHeight}px`;
    }
  }, [localTitle, activeNote.id]);

  useEffect(() => {
    // Only update local title if it's currently empty or the default, 
    // or if the note ID changed
    if (activeNote.id !== localTitleRef.current || !localTitle) {
      setLocalTitle((activeNote.title || '').replace(/\n/g, ''));
      localTitleRef.current = activeNote.id;
    }
    setLocalContent(activeNote.content || '');
  }, [activeNote.id, activeNote.title, refreshKey]);

  useEffect(() => {
    if (localTitle === activeNote.title) return;
    const timeout = setTimeout(() => {
      updateNote(activeNote.id, { title: localTitle });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [localTitle]);

  useEffect(() => {
    if (localContent === activeNote.content) return;
    const timeout = setTimeout(() => {
      updateNote(activeNote.id, { content: localContent });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [localContent]);

  return (
    <motion.div
      key={activeNote.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-1 flex flex-col h-full overflow-hidden"
    >
      <div className="px-4 md:px-12 py-4 md:py-6 border-b border-[var(--border)] flex items-center justify-between bg-[var(--background)]/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-none animate-pulse flex-shrink-0" title="Sincronizado" />

            <button
              onClick={() => updateNote(activeNote.id, { isBookmarked: !activeNote.isBookmarked })}
              className={`p-1.5 transition-all ${activeNote.isBookmarked ? 'bg-[var(--accent)] text-[var(--accent-foreground)] rounded-md' : 'text-[var(--foreground)]/40 hover:text-[var(--foreground)]'}`}
              title="Favoritar"
            >
              <Bookmark className={`w-3.5 h-3.5 ${activeNote.isBookmarked ? 'fill-white' : ''}`} />
            </button>
            <button
              onClick={() => updateNote(activeNote.id, { isCompleted: !activeNote.isCompleted })}
              className={`p-1.5 transition-all ${activeNote.isCompleted ? 'bg-green-500 text-white rounded-md' : 'text-[var(--foreground)]/40 hover:text-[var(--foreground)]'}`}
              title={activeNote.isCompleted ? "Marcar como Ativa" : "Concluir Nota"}
            >
              <CheckCircle className="w-3.5 h-3.5" />
            </button>
            <div
              onClick={() => setIsTempModalOpen(!isTempModalOpen)}
              className={`p-1.5 transition-all relative cursor-pointer ${activeNote.isTemporary ? 'bg-[#FF4F00] text-white rounded-md' : 'text-[var(--foreground)]/40 hover:text-[var(--foreground)]'}`}
              title={activeNote.isTemporary ? "Ajustar Tempo / Remover" : "Tornar Nota Temporária (Auto-Destruição)"}
            >
              <Clock className="w-3.5 h-3.5" />

              {isTempModalOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-full left-0 mt-2 z-[150] bg-[var(--background)] border border-black/20 dark:border-white/20 p-2 shadow-[8px_8px_0px_rgba(0,0,0,0.1)] flex flex-col gap-1.5 w-36 text-left"
                >
                  <p className="text-[7px] font-bold uppercase tracking-[0.1em] text-[var(--foreground)]/50 mb-1 text-center">Auto-Destruição</p>

                  {(['5m', '1h', '24h'] as const).map((dur) => {
                    let durationMs = 3600000;
                    if (dur === '5m') durationMs = 5 * 60 * 1000;
                    if (dur === '24h') durationMs = 24 * 60 * 60 * 1000;

                    return (
                      <button
                        key={dur}
                        onClick={() => {
                          updateNote(activeNote.id, {
                            isTemporary: true,
                            expiresAt: Date.now() + durationMs
                          });
                          setIsTempModalOpen(false);
                        }}
                        className="text-[8px] font-bold uppercase py-1.5 px-2 border border-black/10 dark:border-white/10 bg-[var(--muted)] hover:bg-[#FF4F00] hover:text-white transition-colors text-[var(--foreground)] text-center rounded shadow-[2px_2px_0px_rgba(0,0,0,0.05)]"
                      >
                        {dur === '5m' ? '5 minutos' : dur === '1h' ? '1 hora' : '24 horas'}
                      </button>
                    );
                  })}

                  {activeNote.isTemporary && (
                    <button
                      onClick={() => {
                        updateNote(activeNote.id, {
                          isTemporary: false,
                          expiresAt: null
                        });
                        setIsTempModalOpen(false);
                      }}
                      className="text-[8px] font-bold uppercase py-1.5 px-2 mt-1 border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors text-center rounded"
                    >
                      Desativar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Actions Dropdown (Universal) */}
          <div className="relative flex items-center">
            <button
              ref={actionsButtonRef}
              onClick={() => {
                if (!isActionsDropdownOpen && actionsButtonRef.current) {
                  const rect = actionsButtonRef.current.getBoundingClientRect();
                  const menuWidth = 180;
                  const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12));
                  setActionsCoords({
                    top: rect.bottom + 8,
                    left,
                  });
                }
                setIsActionsDropdownOpen(!isActionsDropdownOpen);
              }}
              className="p-1.5 hover:bg-[var(--muted)] text-[var(--foreground)]/60 transition-colors relative"
              title="Mais ações da nota"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {typeof document !== 'undefined' && createPortal(
              <AnimatePresence>
                {isActionsDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-[9990]" 
                      onClick={() => setIsActionsDropdownOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      style={{
                        position: 'fixed',
                        top: actionsCoords.top,
                        left: actionsCoords.left,
                      }}
                      className="z-[9999] bg-[var(--background)]/95 backdrop-blur-xl border border-black/20 dark:border-white/20 p-2 shadow-[8px_8px_0px_rgba(0,0,0,0.15)] flex flex-col gap-1.5 w-44 text-left"
                    >
                      <button
                        onClick={() => {
                          setIsAIAssistantOpen(true);
                          setIsActionsDropdownOpen(false);
                        }}
                        className="text-[9px] font-bold uppercase py-2 px-3 border border-black/10 dark:border-white/10 bg-[var(--muted)] hover:bg-[#FF4F00] hover:text-white transition-colors text-[var(--foreground)] flex items-center gap-2 rounded"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Assistente IA</span>
                      </button>
                      <button
                        onClick={() => {
                          exportAsPDF(activeNote);
                          setIsActionsDropdownOpen(false);
                        }}
                        className="text-[9px] font-bold uppercase py-2 px-3 border border-black/10 dark:border-white/10 bg-[var(--muted)] hover:bg-[var(--accent)] hover:text-white transition-colors text-[var(--foreground)] flex items-center gap-2 rounded"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimir</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsFullscreen(!isFullscreen);
                          setIsActionsDropdownOpen(false);
                        }}
                        className="text-[9px] font-bold uppercase py-2 px-3 border border-black/10 dark:border-white/10 bg-[var(--muted)] hover:bg-[var(--accent)] hover:text-white transition-colors text-[var(--foreground)] flex items-center gap-2 rounded"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>{isFullscreen ? 'Sair Foco' : 'Modo Foco'}</span>
                      </button>
                      <button
                        onClick={() => {
                          cloneNote(activeNote);
                          setIsActionsDropdownOpen(false);
                        }}
                        className="text-[9px] font-bold uppercase py-2 px-3 border border-black/10 dark:border-white/10 bg-[var(--muted)] hover:bg-[var(--accent)] hover:text-white transition-colors text-[var(--foreground)] flex items-center gap-2 rounded"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Clonar</span>
                      </button>
                      <button
                        onClick={() => {
                          deleteNote(activeNote.id);
                          setIsActionsDropdownOpen(false);
                        }}
                        className="text-[9px] font-bold uppercase py-2 px-3 border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors flex items-center gap-2 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>,
              document.body
            )}
          </div>
        </div>


      <div 
        onScroll={() => {
          if (isActionsDropdownOpen) setIsActionsDropdownOpen(false);
          if (isTempModalOpen) setIsTempModalOpen(false);
        }}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-12 lg:p-20 bg-[var(--muted)]/30 custom-scrollbar"
      >
        <div className="@container/editor max-w-[850px] mx-auto w-full bg-[var(--background)] shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] min-h-[1100px] border border-[var(--border)] overflow-visible relative">
          {activeNote.isTemporary && (
            <div className="bg-[#FF4F00] text-white text-[9px] font-bold uppercase tracking-[0.2em] py-2.5 px-4 text-center animate-pulse border-b border-black/10 flex items-center justify-center gap-2 z-10">
              <Clock className="w-3.5 h-3.5" />
              <span>Esta nota é temporária e se auto-destruirá.</span>
            </div>
          )}
          <div className="px-8 md:px-16 lg:px-24 py-6 md:py-8">
            <div className="mb-2 flex justify-between items-end border-b border-[var(--border)] pb-2">
              <div className="space-y-1">
                <div className="flex flex-wrap gap-2">
                  {activeNote.tags?.slice(0, showAllTags ? undefined : 5).map((tag: string) => (
                    <span key={tag} className="px-2 py-1 bg-[var(--muted)] text-[var(--foreground)] text-[10px] font-bold uppercase tracking-widest rounded flex items-center gap-1 group">
                      #{tag}
                      <button
                        onClick={() => {
                          setTagToDelete({ noteId: activeNote.id, tag });
                          setIsTagDeleteModalOpen(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {activeNote.tags?.length > 5 && (
                    <button
                      onClick={() => setShowAllTags(!showAllTags)}
                      className="text-[9px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity px-2 py-1 border border-[var(--border)] rounded"
                    >
                      {showAllTags ? 'Ver menos' : `+${activeNote.tags.length - 5} Ver mais`}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setNewTagInput('');
                      setIsTagModalOpen(true);
                    }}
                    className="text-[10px] font-bold uppercase tracking-widest text-[var(--foreground)] opacity-30 hover:opacity-100 transition-colors"
                  >
                    + Adicionar Tag
                  </button>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] opacity-40 uppercase font-bold tracking-widest">Atualizado em</p>
                <p className="text-xs font-sans font-medium opacity-70">
                  {activeNote.updatedAt ? format(activeNote.updatedAt.toDate(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'Agora'}
                </p>
              </div>
            </div>
            {getNoteExpiryStatus(activeNote) === 'overdue' && (
              <div className="mb-4 p-3 bg-red-500/[0.07] dark:bg-red-500/[0.09] border border-red-500/30 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-mono text-[11px]">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Esta nota está atrasada desde{' '}
                    {activeNote.expiryDate?.toDate
                      ? format(activeNote.expiryDate.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : 'a data estipulada'}
                    .
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
                      updateNote(activeNote.id, { expiryDate: Timestamp.fromDate(nextDay) });
                    }}
                    className="px-2.5 py-1 text-[10px] font-mono bg-red-500/15 text-red-600 dark:text-red-300 hover:bg-red-500/25 transition-all border border-red-500/30 font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Adiar 1 dia
                  </button>
                  <button
                    type="button"
                    onClick={() => updateNote(activeNote.id, { isCompleted: true })}
                    className="px-2.5 py-1 text-[10px] font-mono bg-[var(--accent)] text-white hover:opacity-90 transition-all font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Marcar Concluída
                  </button>
                </div>
              </div>
            )}
            <textarea
              ref={titleRef}
              rows={1}
              value={localTitle}
              placeholder="Título da nota"
              onChange={(e) => setLocalTitle(e.target.value.replace(/\n/g, ''))}
              onFocus={() => {
                if (titleRef.current) {
                  titleRef.current.style.height = 'auto';
                  const computedHeight = Math.max(titleRef.current.scrollHeight, 44);
                  titleRef.current.style.height = `${computedHeight}px`;
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
              className="w-full min-h-[44px] text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-sans font-bold tracking-tight leading-tight bg-transparent border-none focus:outline-none mb-0 p-0 placeholder:text-[var(--foreground)]/40 text-[var(--foreground)] resize-none overflow-hidden"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4 mb-0 pb-3 border-b border-[var(--border)] mt-4 md:mt-6">
              <BrutalistDateTimePicker
                label="Lembrete"
                placeholder="Definir lembrete..."
                value={activeNote.reminder ? activeNote.reminder.toDate() : null}
                onChange={(d) => {
                  updateNote(activeNote.id, { reminder: d ? Timestamp.fromDate(d) : null });
                }}
              />
              <BrutalistDateTimePicker
                label="Vencimento"
                placeholder="Definir vencimento..."
                value={activeNote.expiryDate ? activeNote.expiryDate.toDate() : null}
                onChange={(d) => {
                  updateNote(activeNote.id, { expiryDate: d ? Timestamp.fromDate(d) : null });
                }}
              />
            </div>

            {/* Multiple Reminders Stack */}
            <div className="mt-2 mb-0 pb-3 border-b border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 opacity-60">
                  <Bell className="w-3 h-3 text-[var(--accent)]" />
                  <span className="text-[10px] font-bold uppercase tracking-widest font-mono">
                    Lembretes Adicionais {(activeNote.reminders && activeNote.reminders.length > 0) ? `(${activeNote.reminders.length})` : ''}
                  </span>
                </div>
                {(!activeNote.reminders || activeNote.reminders.length < 5) && !isAddingReminder && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingReminder(true);
                      setNewReminderDate(null);
                      setNewReminderLabel('');
                    }}
                    className="text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Adicionar Lembrete</span>
                  </button>
                )}
              </div>

              {/* Active Reminders Chips */}
              {activeNote.reminders && activeNote.reminders.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {activeNote.reminders.map((rem: NoteReminder) => {
                    const formattedDate = rem.date?.toDate
                      ? format(rem.date.toDate(), "dd/MM 'às' HH:mm", { locale: ptBR })
                      : '';
                    return (
                      <span
                        key={rem.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--muted)] border border-[var(--border)] text-[10px] font-mono text-[var(--foreground)]"
                      >
                        <Bell className="w-2.5 h-2.5 text-[var(--accent)]" />
                        <span className="font-bold">{formattedDate}</span>
                        {rem.label && (
                          <span className="opacity-60 text-[9px] font-sans">({rem.label})</span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (activeNote.reminders || []).filter((r: NoteReminder) => r.id !== rem.id);
                            updateNote(activeNote.id, { reminders: updated });
                          }}
                          className="hover:text-red-500 opacity-50 hover:opacity-100 transition-opacity ml-1 cursor-pointer"
                          title="Remover lembrete"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Form to Add New Reminder */}
              {isAddingReminder && (
                <div className="p-2.5 border border-[var(--accent)]/40 bg-[var(--accent)]/[0.02] space-y-2 mt-2">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase">
                    <span className="text-[var(--accent)]">Novo Lembrete para esta Nota</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingReminder(false)}
                      className="opacity-50 hover:opacity-100 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <BrutalistDateTimePicker
                      label="Data e Hora"
                      placeholder="Escolher horário..."
                      value={newReminderDate}
                      onChange={(d) => setNewReminderDate(d)}
                    />
                    <div className="space-y-1">
                      <p className="text-[10px] opacity-40 uppercase font-bold tracking-widest">Rótulo / Evento (Opcional)</p>
                      <input
                        type="text"
                        value={newReminderLabel}
                        onChange={(e) => setNewReminderLabel(e.target.value)}
                        placeholder="Ex: Prazo pagamento, Follow-up..."
                        className="w-full bg-[var(--muted)] text-[var(--foreground)] px-2.5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-mono rounded-none border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingReminder(false)}
                      className="px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider opacity-60 hover:opacity-100 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={!newReminderDate}
                      onClick={() => {
                        if (!newReminderDate) return;
                        const newRem: NoteReminder = {
                          id: Math.random().toString(36).substring(2, 10),
                          date: Timestamp.fromDate(newReminderDate),
                          label: newReminderLabel.trim() || undefined
                        };
                        const currentList = activeNote.reminders || [];
                        updateNote(activeNote.id, { reminders: [...currentList, newRem] });
                        setIsAddingReminder(false);
                        setNewReminderDate(null);
                        setNewReminderLabel('');
                      }}
                      className="px-3 py-1 bg-[var(--accent)] text-white text-[9px] font-mono font-bold uppercase tracking-wider shadow-sm disabled:opacity-30 cursor-pointer"
                    >
                      Salvar Lembrete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <RichTextEditor
            content={localContent}
            onChange={(html: string) => setLocalContent(html)}
            isFocusMode={isFullscreen}
            notes={allNotes}
            activeNoteId={activeNote.id}
          />

          {/* Related Notes (AI Auto-Linker) */}
          {relatedNotes && relatedNotes.length > 0 && (
            <div className="mt-20 pt-10 border-t border-[var(--border)] pb-10 px-8 md:px-16 lg:px-24">
              <div className="flex items-center gap-3 mb-8">
                <Brain className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--foreground)] opacity-40">Conexões Sugeridas pela IA</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                {relatedNotes.map((note: any) => (
                  <button
                    key={note.id}
                    onClick={() => setActiveNoteId(note.id)}
                    className="group relative p-4 bg-[var(--muted)]/20 border border-[var(--border)] hover:border-[var(--accent)] transition-all text-left h-full flex flex-col"
                  >
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="w-3 h-3 text-[var(--accent)]" />
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--foreground)] opacity-20 mb-2">Nota Relacionada</p>
                    <h4 className="text-sm font-sans font-semibold mb-2 leading-snug group-hover:text-[var(--accent)] transition-colors line-clamp-2">{note.title || 'Sem título'}</h4>
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                      {note.tags?.slice(0, 3).map((tag: string) => (
                        <span key={tag} className="text-[8px] font-bold uppercase tracking-tighter opacity-30 group-hover:opacity-60">#{tag}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Backlinks (Neural References) */}
          {backlinks && backlinks.length > 0 && (
            <div className="mt-10 pt-10 border-t border-[var(--border)] pb-20 px-8 md:px-16 lg:px-24">
              <div className="flex items-center gap-3 mb-8">
                <Undo2 className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--foreground)] opacity-40">Menções a esta nota (Backlinks)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {backlinks.map((note: any) => (
                  <button
                    key={note.id}
                    onClick={() => setActiveNoteId(note.id)}
                    className="group relative p-4 bg-[var(--muted)]/20 border border-[var(--border)] hover:border-[var(--accent)] transition-all text-left h-full flex flex-col"
                  >
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Undo2 className="w-3 h-3 text-[var(--accent)] rotate-180" />
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--foreground)] opacity-20 mb-2">Referenciada em</p>
                    <h4 className="text-sm font-sans font-semibold mb-2 leading-snug group-hover:text-[var(--accent)] transition-colors line-clamp-2">{note.title || 'Sem título'}</h4>
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                      {note.tags?.slice(0, 3).map((tag: string) => (
                        <span key={tag} className="text-[8px] font-bold uppercase tracking-tighter opacity-30 group-hover:opacity-60">#{tag}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSemanticSearch, setIsSemanticSearch] = useState(false);
  const [semanticKeywords, setSemanticKeywords] = useState<string[]>([]);
  const [isSemanticLoading, setIsSemanticLoading] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const activeNote = useMemo(() => notes.find(n => n.id === activeNoteId), [notes, activeNoteId]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [activeSelection, setActiveSelection] = useState<{ text: string; html: string } | null>(null);
  const [pendingSelectionReplacement, setPendingSelectionReplacement] = useState<string | null>(null);
  const [editorRefreshKey, setEditorRefreshKey] = useState(0);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [showAllSidebarTags, setShowAllSidebarTags] = useState(false);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [lastDeletedNote, setLastDeletedNote] = useState<Note | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');
  const [view, setView] = useState<'all' | 'favorites' | 'reminders' | 'overdue' | 'completed' | 'untagged'>('all');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isMobileTagsModalOpen, setIsMobileTagsModalOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [tagsToAssign, setTagsToAssign] = useState<string[]>([]);
  const [isAiSuggestingTags, setIsAiSuggestingTags] = useState(false);
  const [aiSuggestedTags, setAiSuggestedTags] = useState<Array<{ tag: string; isExisting: boolean }>>([]);
  const aiTagPoolRef = useRef<Map<string, { tag: string; isExisting: boolean }>>(new Map());
  const [notifiedReminders, setNotifiedReminders] = useState<Set<string>>(new Set());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReminderAlertOpen, setIsReminderAlertOpen] = useState(false);
  const [currentReminderNote, setCurrentReminderNote] = useState<Note | null>(null);
  const [currentReminderLabel, setCurrentReminderLabel] = useState<string | null>(null);
  const [isTagDeleteModalOpen, setIsTagDeleteModalOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<{ noteId: string, tag: string } | null>(null);
  const [isGlobalTagDeleteModalOpen, setIsGlobalTagDeleteModalOpen] = useState(false);
  const [globalTagToDelete, setGlobalTagToDelete] = useState<string | null>(null);
  const [showTagUndoToast, setShowTagUndoToast] = useState(false);
  const [lastDeletedTag, setLastDeletedTag] = useState<{ noteId: string, tag: string, affectedNoteIds?: string[] } | null>(null);
  const [alarmType, setAlarmType] = useState<'neural' | 'crystal' | 'pulsar' | 'zen'>('neural');
  const [aiFallbackToast, setAiFallbackToast] = useState<{
    modelUsed: string;
    originalModel: string;
    reason?: string;
  } | null>(null);

  const triggerAiFallbackNotice = (meta?: any) => {
    if (meta?.isFallback) {
      setAiFallbackToast({
        modelUsed: meta.modelUsed || 'gemini-3.1-flash-lite',
        originalModel: meta.originalModel || 'gemini-3.8-flash',
        reason: meta.reason
      });
      setTimeout(() => setAiFallbackToast(null), 7000);
    }
  };

  // Listener para eventos globais de fallback de IA (ex: chatbot, assistente, gerador)
  useEffect(() => {
    const handleFallbackEvent = (e: any) => {
      if (e.detail) {
        triggerAiFallbackNotice(e.detail);
      }
    };
    window.addEventListener('ai-fallback-triggered', handleFallbackEvent);
    return () => window.removeEventListener('ai-fallback-triggered', handleFallbackEvent);
  }, []);

  // Listener para abrir nota pelo ID a partir de qualquer componente (ex: notas referenciadas no chat)
  useEffect(() => {
    const handleOpenNoteById = (e: any) => {
      if (e.detail) {
        setActiveNoteId(e.detail);
        setMobileView('editor');
      }
    };
    window.addEventListener('open-note-by-id', handleOpenNoteById);
    return () => window.removeEventListener('open-note-by-id', handleOpenNoteById);
  }, []);

  // Persistência do tipo de alarme
  useEffect(() => {
    const savedAlarm = localStorage.getItem('alarmType') as any;
    if (savedAlarm) setAlarmType(savedAlarm);
  }, []);

  const playNeuralSound = (typeOverride?: string) => {
    if (typeof window === "undefined") return;
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const type = typeOverride || alarmType;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.connect(gain);
    gain.connect(audioContext.destination);

    switch (type) {
      case 'crystal':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1760, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.2);
        gain.gain.setValueAtTime(0.05, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
        osc.start();
        osc.stop(audioContext.currentTime + 0.2);
        break;
      case 'pulsar':
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, audioContext.currentTime);
        osc.frequency.setValueAtTime(880, audioContext.currentTime + 0.1);
        gain.gain.setValueAtTime(0.02, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
        osc.start();
        osc.stop(audioContext.currentTime + 0.3);
        break;
      case 'zen':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        gain.gain.setValueAtTime(0.08, audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1);
        osc.start();
        osc.stop(audioContext.currentTime + 1);
        break;
      default: // neural
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.5);
        gain.gain.setValueAtTime(0.1, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        osc.start();
        osc.stop(audioContext.currentTime + 0.5);
    }
  };



  // Reminder Engine
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      notes.forEach(note => {
        // 1. Handle regular reminders (legacy note.reminder)
        if (note.reminder && !notifiedReminders.has(note.id)) {
          const reminderTime = note.reminder.toDate();
          // Trigger if within the current minute
          if (reminderTime <= now && now.getTime() - reminderTime.getTime() < 60000) {
            // Browser Notification
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              new Notification(`Lembrete Neural: ${note.title || 'Nota sem título'}`, {
                body: "Um de seus pensamentos requer sua atenção agora.",
              });
            }

            // Visual feedback (Styled Modal)
            setCurrentReminderNote(note);
            setCurrentReminderLabel(null);
            setIsReminderAlertOpen(true);
            playNeuralSound();

            setNotifiedReminders(prev => new Set(prev).add(note.id));

            // AUTOMATICALLY REMOVE (As requested)
            updateNote(note.id, { reminder: null });
          }
        }

        // 1.1 Handle multiple reminders (note.reminders)
        if (note.reminders && Array.isArray(note.reminders)) {
          note.reminders.forEach(rem => {
            const remKey = `${note.id}_${rem.id}`;
            if (!notifiedReminders.has(remKey) && rem.date?.toDate) {
              const reminderTime = rem.date.toDate();
              if (reminderTime <= now && now.getTime() - reminderTime.getTime() < 60000) {
                const labelText = rem.label || 'Lembrete';
                if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                  new Notification(`Lembrete: ${labelText} • ${note.title || 'Nota sem título'}`, {
                    body: `Evento agendado: ${labelText}`,
                  });
                }

                setCurrentReminderNote(note);
                setCurrentReminderLabel(labelText);
                setIsReminderAlertOpen(true);
                playNeuralSound();

                setNotifiedReminders(prev => new Set(prev).add(remKey));

                // Remove only this triggered reminder from note.reminders
                const remaining = (note.reminders || []).filter(r => r.id !== rem.id);
                updateNote(note.id, { reminders: remaining });
              }
            }
          });
        }

        // 2. Handle expiryDate - if note is expired, clear reminders to avoid zombie alerts
        if (note.expiryDate) {
          const expiryTime = note.expiryDate.toDate();
          if (expiryTime < now) {
            if (note.reminder) {
              updateNote(note.id, { reminder: null });
            }
            if (note.reminders && note.reminders.length > 0) {
              updateNote(note.id, { reminders: [] });
            }
          }
        }

        // 3. Handle isTemporary garbage collection
        if (note.isTemporary && note.expiresAt && note.expiresAt < now.getTime()) {
          deleteDoc(doc(db, 'notes', note.id)).catch(err => console.error("Failed to auto-delete note", err));
          if (activeNoteId === note.id) setActiveNoteId(null);
        }
      });
    };

    const interval = setInterval(checkReminders, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [notes, notifiedReminders]);



  // Initialize tagsToAssign when modal opens
  useEffect(() => {
    if (isTagModalOpen && activeNote) {
      const normalizedCurrent = (activeNote.tags || [])
        .map(t => normalizeTag(t))
        .filter(Boolean);
      setTagsToAssign(Array.from(new Set(normalizedCurrent)));
      setNewTagInput('');
      setAiSuggestedTags([]);
      aiTagPoolRef.current.clear();
    }
  }, [isTagModalOpen, activeNote?.id]);

  // Theme Toggle Effect
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u) setNotes([]);

    });
    return () => unsubscribe();
  }, []);

  // Notes Listener
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notes'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((note: any) => note.title !== '__neural_chat_history__') as Note[];
      setNotes(data);
    }, (error) => {
      console.error("Firestore error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Command Palette Shortcut (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    const handleExitFocus = () => setIsFullscreen(false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('exit-focus-mode', handleExitFocus);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('exit-focus-mode', handleExitFocus);
    };
  }, []);

  // Handle note selection from URL (Dashboard redirect) - Run only once or when URL changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const noteId = params.get('note');
    if (noteId && notes.length > 0) {
      const exists = notes.some(n => n.id === noteId);
      if (exists && activeNoteId !== noteId) {
        setActiveNoteId(noteId);
        setMobileView('editor');
        // Limpar o parâmetro da URL para não disparar novamente
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [notes.length > 0]); // Executa quando as notas carregam pela primeira vez

  // Derived state (Normalized & Unified)
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    notes.forEach(note => {
      (note.tags || []).forEach(tag => {
        const norm = normalizeTag(tag);
        if (norm) tags.add(norm);
      });
    });
    return Array.from(tags).sort();
  }, [notes]);

  const tagCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.forEach(note => {
      (note.tags || []).forEach(tag => {
        const norm = normalizeTag(tag);
        if (norm) {
          counts[norm] = (counts[norm] || 0) + 1;
        }
      });
    });
    return counts;
  }, [notes]);

  const filteredAvailableTags = useMemo(() => {
    const q = normalizeTag(newTagInput);
    if (!q) return allTags;
    return allTags.filter(tag => tag.includes(q));
  }, [allTags, newTagInput]);

  const [isUnifyingTags, setIsUnifyingTags] = useState(false);
  const [unifyMessage, setUnifyMessage] = useState<string | null>(null);

  const handleUnifyAndCleanAllTags = async () => {
    if (!user || isUnifyingTags) return;
    setIsUnifyingTags(true);
    setUnifyMessage(null);
    try {
      let updatedCount = 0;
      for (const note of notes) {
        if (!note.tags || note.tags.length === 0) continue;
        const originalTags = note.tags;
        const seen = new Set<string>();
        const unifiedTags: string[] = [];

        for (const t of originalTags) {
          const norm = normalizeTag(t);
          if (norm && !seen.has(norm)) {
            seen.add(norm);
            unifiedTags.push(norm);
          }
        }

        const hasDifference =
          originalTags.length !== unifiedTags.length ||
          originalTags.some((t, i) => t !== unifiedTags[i]);

        if (hasDifference) {
          await updateDoc(doc(db, 'notes', note.id), {
            tags: unifiedTags,
            updatedAt: serverTimestamp()
          });
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        setUnifyMessage(`${updatedCount} nota(s) corrigida(s) e tags unificadas!`);
      } else {
        setUnifyMessage('Todas as tags já estão perfeitamente unificadas!');
      }
      setTimeout(() => setUnifyMessage(null), 5000);
    } catch (err) {
      console.error('Erro ao unificar tags:', err);
      setUnifyMessage('Erro ao unificar tags. Tente novamente.');
      setTimeout(() => setUnifyMessage(null), 5000);
    } finally {
      setIsUnifyingTags(false);
    }
  };

  const handleAiSuggestTags = async () => {
    if (!activeNote || isAiSuggestingTags) return;
    const cleanContent = stripHtml(activeNote.content || '');
    const rawText = `${activeNote.title || ''}\n${cleanContent}`.trim();
    if (!rawText) {
      alert('Esta nota ainda não possui texto ou conteúdo suficiente para a IA sugerir etiquetas.');
      return;
    }

    setIsAiSuggestingTags(true);
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Você é um assistente de taxonomia do sistema de Segundo Cérebro.
Analise o título e o conteúdo da seguinte nota:
"""
${rawText.slice(0, 3000)}
"""

Dicionário de tags JÁ EXISTENTES no sistema:
[${allTags.join(', ')}]

Sua missão:
Sugerir de 2 a 5 tags contextuais e relevantes para categorizar esta nota.
DIRETRIZES FUNDAMENTAIS:
1. PRIORIDADE MÁXIMA: Reutilize tags da lista de tags JÁ EXISTENTES acima sempre que o contexto for aplicável, evitando redundâncias ou tags sinônimas desnecessárias.
2. CRIE UMA TAG NOVA apenas quando o conteúdo trouxer um tópico ou conceito fundamental que nenhuma tag existente represente.
3. Todas as tags devem ser em letras minúsculas, sem acentos, sem espaços (use traço se composto) e sem o caractere #.

Retorne EXCLUSIVAMENTE um JSON válido no seguinte formato:
{
  "existing": ["tag_existente_1", "tag_existente_2"],
  "new": ["tag_nova_1"]
}`
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      if (data.meta?.isFallback) {
        triggerAiFallbackNotice(data.meta);
      }

      let parsed: { existing?: string[]; new?: string[] } = {};
      try {
        const cleaned = (data.text || '')
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        parsed = JSON.parse(cleaned);
      } catch {
        const tokens = (data.text || '')
          .split(/[,;\n]+/)
          .map((t: string) => normalizeTag(t))
          .filter(Boolean);
        parsed = {
          existing: tokens.filter((t: string) => allTags.includes(t)),
          new: tokens.filter((t: string) => !allTags.includes(t))
        };
      }

      const suggestions: Array<{ tag: string; isExisting: boolean }> = [];
      const seen = new Set<string>();

      (parsed.existing || []).forEach((raw: string) => {
        const tag = normalizeTag(raw);
        if (tag && !seen.has(tag) && !tagsToAssign.includes(tag)) {
          seen.add(tag);
          suggestions.push({ tag, isExisting: true });
        }
      });

      (parsed.new || []).forEach((raw: string) => {
        const tag = normalizeTag(raw);
        if (tag && !seen.has(tag) && !tagsToAssign.includes(tag)) {
          seen.add(tag);
          suggestions.push({ tag, isExisting: allTags.includes(tag) });
        }
      });

      suggestions.forEach(item => {
        aiTagPoolRef.current.set(item.tag, item);
      });

      setAiSuggestedTags(suggestions);
    } catch (err: any) {
      console.error('Erro ao sugerir tags com IA:', err);
      alert('Não foi possível gerar sugestões com a IA no momento.');
    } finally {
      setIsAiSuggestingTags(false);
    }
  };

  const handleRemoveAssignedTag = (tagToRemove: string) => {
    setTagsToAssign(prev => prev.filter(t => t !== tagToRemove));
    const originalAiTag = aiTagPoolRef.current.get(tagToRemove);
    if (originalAiTag) {
      setAiSuggestedTags(prev => {
        if (prev.some(item => item.tag === tagToRemove)) return prev;
        return [...prev, originalAiTag];
      });
    }
  };

  const handleRemoveAllAssignedTags = () => {
    const restoredAiTags: Array<{ tag: string; isExisting: boolean }> = [];
    tagsToAssign.forEach(tag => {
      const originalAiTag = aiTagPoolRef.current.get(tag);
      if (originalAiTag) {
        restoredAiTags.push(originalAiTag);
      }
    });
    setTagsToAssign([]);
    if (restoredAiTags.length > 0) {
      setAiSuggestedTags(prev => {
        const existingSet = new Set(prev.map(p => p.tag));
        const toAdd = restoredAiTags.filter(item => !existingSet.has(item.tag));
        return [...prev, ...toAdd];
      });
    }
  };

  // Semantic Search Expansion
  useEffect(() => {
    if (!isSemanticSearch || !searchQuery || searchQuery.length < 3) {
      setSemanticKeywords([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSemanticLoading(true);
      try {
        const response = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `Expanda a busca conceitual para: "${searchQuery}". Retorne apenas as 5 palavras-chave mais relacionadas semanticamente (ex: se for "projetos", retorne "planos metas objetivos iniciativas cronograma"). Responda apenas com as palavras separadas por espaço.`
          }),
        });
        const data = await response.json();
        if (data.text) {
          const keywords = data.text.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
          setSemanticKeywords(keywords);
        }
      } catch (e) {
        console.error('Erro na expansão semântica:', e);
      } finally {
        setIsSemanticLoading(false);
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [searchQuery, isSemanticSearch]);

  const filteredNotes = useMemo(() => {
    const queryLower = searchQuery.toLowerCase();
    return notes.filter(note => {
      const titleLower = note.title.toLowerCase();
      const contentLower = note.content.toLowerCase();

      const matchesKeyword =
        titleLower.includes(queryLower) ||
        contentLower.includes(queryLower);

      const matchesSemantic = isSemanticSearch && semanticKeywords.some(kw =>
        titleLower.includes(kw) || contentLower.includes(kw)
      );

      const matchesSearch = matchesKeyword || matchesSemantic;
      const matchesTag = activeTag ? note.tags?.includes(activeTag) : true;
      const matchesView =
        view === 'favorites' ? note.isBookmarked :
          view === 'reminders' ? (!!note.reminder || (!!note.reminders && note.reminders.length > 0)) :
            view === 'overdue' ? getNoteExpiryStatus(note) === 'overdue' :
              view === 'completed' ? note.isCompleted :
                view === 'untagged' ? (!note.tags || note.tags.length === 0) : true;
      return matchesSearch && matchesTag && matchesView;
    });
  }, [notes, searchQuery, activeTag, view, isSemanticSearch, semanticKeywords]);

  const overdueCount = useMemo(() => {
    return notes.filter(n => getNoteExpiryStatus(n) === 'overdue').length;
  }, [notes]);

  const untaggedCount = useMemo(() => {
    return notes.filter(n => !n.tags || n.tags.length === 0).length;
  }, [notes]);

  const storageUsage = useMemo(() => {
    const totalBytes = notes.reduce((acc, note) => {
      return acc + (JSON.stringify(note).length * 2); // 2 bytes per char for UTF-16
    }, 0);
    const limitBytes = 1024 * 1024 * 1024; // 1GB (Firestore Spark Limit)
    return {
      bytes: totalBytes,
      percentage: Math.max(0.1, (totalBytes / limitBytes) * 100),
      formatted: totalBytes < 1024 * 1024
        ? (totalBytes / 1024).toFixed(1) + ' KB'
        : (totalBytes / (1024 * 1024)).toFixed(1) + ' MB'
    };
  }, [notes]);

  const backlinks = useMemo(() => {
    if (!activeNote) return [];
    return notes.filter(n =>
      n.id !== activeNote.id &&
      n.content?.includes(activeNote.id)
    );
  }, [activeNote, notes]);


  const relatedNotes = useMemo(() => {
    if (!activeNote || !activeNote.tags?.length) return [];

    return notes
      .filter(n => n.id !== activeNote.id && !activeNote.content?.includes(n.id))
      .map(n => ({
        ...n,
        sharedTagsCount: n.tags?.filter(t => activeNote.tags?.includes(t)).length || 0
      }))
      .filter(n => n.sharedTagsCount > 0)
      .sort((a, b) => b.sharedTagsCount - a.sharedTagsCount)
      .slice(0, 3);
  }, [activeNote, notes]);

  const handleAiAction = async (note: Note) => {
    if (!note.content) return;
    setIsAiLoading(true);
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Analise esta nota e sugira tags (separadas por vírgula) e um resumo curto de 2 frases. Texto: ${note.content}`
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      if (data.meta?.isFallback) {
        triggerAiFallbackNotice(data.meta);
      }
      alert(data.text);
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao processar com IA: ${e.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Actions
  const handleCommandAction = (action: string, payload?: any) => {
    switch (action) {
      case 'create':
        createNewNote();
        break;
      case 'dashboard':
        window.location.href = '/dashboard';
        break;
      case 'theme':
        toggleTheme();
        break;
      case 'tag':
        if (activeNoteId) setIsTagModalOpen(true);
        break;
      case 'open_note':
        setActiveNoteId(payload);
        setMobileView('editor');
        break;
    }
  };

  const createNewNote = async () => {
    if (!user) return;
    const newNote = {
      title: 'Nova Nota',
      content: '',
      tags: [],
      userId: user.uid,
      isBookmarked: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, 'notes'), newNote);
    setActiveNoteId(docRef.id);
    setMobileView('editor');
  };

  const cloneNote = async (note: Note) => {
    if (!user) return;
    const clonedNote = {
      title: `${note.title || 'Sem título'} (Cópia)`,
      content: note.content || '',
      tags: note.tags || [],
      userId: user.uid,
      isBookmarked: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, 'notes'), clonedNote);
    setActiveNoteId(docRef.id);
    setMobileView('editor');
  };

  const updateNote = async (id: string, data: Partial<Note>) => {
    try {
      const noteRef = doc(db, 'notes', id);
      await updateDoc(noteRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error updating note:", error);
    }
  };

  const executeTagDelete = async () => {
    if (!tagToDelete) return;
    const { noteId, tag } = tagToDelete;
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    try {
      const newTags = (note.tags || []).filter(t => t !== tag);
      await updateNote(noteId, { tags: newTags });

      setLastDeletedTag({ noteId, tag });
      setIsTagDeleteModalOpen(false);
      setTagToDelete(null);
      setShowTagUndoToast(true);
      setTimeout(() => setShowTagUndoToast(false), 5000);
    } catch (error) {
      console.error("Error deleting tag:", error);
    }
  };

  const undoTagDelete = async () => {
    if (!lastDeletedTag) return;
    const { noteId, tag, affectedNoteIds } = lastDeletedTag;

    try {
      if (affectedNoteIds) {
        // Undo Global Delete
        for (const id of affectedNoteIds) {
          const note = notes.find(n => n.id === id);
          if (note) {
            await updateNote(id, { tags: [...(note.tags || []), tag] });
          }
        }
      } else {
        // Undo Single Delete
        const note = notes.find(n => n.id === noteId);
        if (note) {
          await updateNote(noteId, { tags: [...(note.tags || []), tag] });
        }
      }
      setShowTagUndoToast(false);
      setLastDeletedTag(null);
    } catch (error) {
      console.error("Error undoing tag delete:", error);
    }
  };

  const executeGlobalTagDelete = async () => {
    if (!globalTagToDelete) return;
    const tag = globalTagToDelete;
    const affectedNotes = notes.filter(n => n.tags?.includes(tag));
    const affectedNoteIds = affectedNotes.map(n => n.id);

    try {
      for (const noteId of affectedNoteIds) {
        const note = notes.find(n => n.id === noteId);
        if (note) {
          const newTags = (note.tags || []).filter(t => t !== tag);
          await updateNote(noteId, { tags: newTags });
        }
      }

      setLastDeletedTag({ noteId: '', tag, affectedNoteIds });
      setIsGlobalTagDeleteModalOpen(false);
      setGlobalTagToDelete(null);
      setShowTagUndoToast(true);
      setTimeout(() => setShowTagUndoToast(false), 5000);
    } catch (error) {
      console.error("Error deleting global tag:", error);
    }
  };

  // AI Assistant Handlers
  const handleAIAssistantApply = async (newContent: string) => {
    if (!activeNote) return;
    await updateNote(activeNote.id, { content: newContent });
    setEditorRefreshKey(prev => prev + 1);
  };

  const allExistingTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach(n => n.tags?.forEach(t => set.add(t)));
    return Array.from(set);
  }, [notes]);

  const handleAIAssistantTags = async (suggestedTags: string[]) => {
    if (!activeNote) return;
    const currentTags = activeNote.tags || [];
    const finalTags = [...currentTags];

    suggestedTags.forEach(suggested => {
      // Look for match in existing system tags (case insensitive)
      const existing = allExistingTags.find(t => t.toLowerCase() === suggested.toLowerCase());
      const tagToAdd = existing || suggested;

      // Check if this tag is already in this note's tag list
      if (!finalTags.some(t => t.toLowerCase() === tagToAdd.toLowerCase())) {
        finalTags.push(tagToAdd);
      }
    });

    await updateNote(activeNote.id, { tags: finalTags });
  };

  const deleteNote = (id: string) => {
    const note = notes.find(n => n.id === id);
    if (note) {
      setNoteToDelete(note);
      setIsDeleteModalOpen(true);
    }
  };

  const executeDelete = async () => {
    if (!noteToDelete) return;
    try {
      setLastDeletedNote(noteToDelete);
      await deleteDoc(doc(db, 'notes', noteToDelete.id));
      if (activeNoteId === noteToDelete.id) setActiveNoteId(null);
      setIsDeleteModalOpen(false);
      setNoteToDelete(null);
      setShowUndoToast(true);
      setTimeout(() => setShowUndoToast(false), 5000);
    } catch (e) {
      console.error("Erro ao deletar:", e);
    }
  };

  const undoDelete = async () => {
    if (!lastDeletedNote || !user) return;
    try {
      const { id, ...data } = lastDeletedNote;
      await addDoc(collection(db, 'notes'), {
        ...data,
        updatedAt: serverTimestamp()
      });
      setShowUndoToast(false);
      setLastDeletedNote(null);
    } catch (e) {
      console.error("Erro ao desfazer:", e);
    }
  };

  const exportAsPDF = (note: Note) => {
    // 1. Cria um container nativo que será a ÚNICA coisa visível durante a impressão
    const printContainer = document.createElement('div');
    printContainer.id = 'printable-note-container';

    // Força fundo branco sem padding excessivo (as margens são controladas pelo @page)
    printContainer.style.backgroundColor = 'white';
    printContainer.style.width = '100%';
    printContainer.style.margin = '0';
    printContainer.style.padding = '0';

    const createdAtStr = note.createdAt
      ? format(note.createdAt.toDate(), "dd/MM/yyyy HH:mm", { locale: ptBR })
      : 'Desconhecida';
    const updatedAtStr = note.updatedAt
      ? format(note.updatedAt.toDate(), "dd/MM/yyyy HH:mm", { locale: ptBR })
      : 'Desconhecida';
    const tagsStr = note.tags && note.tags.length > 0
      ? note.tags.map(tag => `<span style="display: inline-block; background: #f0f0f0; border: 1px solid #e0e0e0; border-radius: 4px; padding: 2px 6px; margin-right: 4px; font-size: 7.5pt; font-weight: 600; color: #333;">${tag}</span>`).join('')
      : '<span style="color: #888; font-style: italic;">Nenhum</span>';

    // 2. Injeta o HTML com estilização avançada para impressão
    printContainer.innerHTML = `
      <style>
        /* Regras de impressão estritas */
        @media print {
          @page {
            margin: 25mm 20mm 20mm 20mm;
          }
          
          /* Reseta o tamanho da tela para evitar páginas em branco no final */
          html, body {
            height: auto !important;
            min-height: auto !important;
            background: white !important;
            color: #111111 !important;
            overflow: visible !important;
            font-size: 11pt;
            line-height: 1.6;
          }

          /* Esconde todo o aplicativo, mostra apenas a nota */
          body.is-printing-note > *:not(#printable-note-container) {
            display: none !important;
          }
          
          #printable-note-container {
            display: block !important;
          }

          /* Garantir boa legibilidade e cores escuras apropriadas para impressão */
          #printable-note-container * {
            color: #111111 !important;
          }

          /* Oculta URLs injetadas pelo Chrome no rodapé dos links */
          a[href]:after { content: none !important; }

          /* Quebra de páginas inteligente para evitar elementos órfãos */
          h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
            break-after: avoid;
            color: #000000 !important;
            font-weight: 700;
          }

          blockquote, pre, table, tr, li, img {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          /* Blocos de Citação */
          blockquote {
            border-left: 3px solid #666 !important;
            padding-left: 15px !important;
            margin: 15px 0 !important;
            font-style: italic !important;
            color: #333 !important;
          }

          /* Blocos de Código */
          pre, code {
            background-color: #f7f7f7 !important;
            border: 1px solid #e1e1e1 !important;
            border-radius: 4px !important;
            padding: 8px 12px !important;
            font-family: monospace !important;
            font-size: 9.5pt !important;
            white-space: pre-wrap !important;
            word-break: break-all !important;
          }

          /* Tabelas */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 20px 0 !important;
          }

          th, td {
            border: 1px solid #ddd !important;
            padding: 8px 10px !important;
            text-align: left !important;
          }

          th {
            background-color: #f5f5f5 !important;
            font-weight: bold !important;
          }

          /* Checkboxes no Tiptap para Listas de Tarefas */
          ul[data-type="taskList"] {
            list-style: none !important;
            padding-left: 0 !important;
          }
          ul[data-type="taskList"] li {
            display: flex !important;
            align-items: flex-start !important;
            gap: 8px !important;
            margin-bottom: 6px !important;
          }
          ul[data-type="taskList"] input[type="checkbox"] {
            appearance: none !important;
            -webkit-appearance: none !important;
            width: 12px !important;
            height: 12px !important;
            border: 1px solid #000 !important;
            border-radius: 2px !important;
            margin-top: 4px !important;
            position: relative !important;
            display: inline-block !important;
            background: white !important;
          }
          ul[data-type="taskList"] li[data-checked="true"] input[type="checkbox"]::after {
            content: "\\\\2713" !important; /* Símbolo check */
            font-size: 10px !important;
            font-weight: bold !important;
            position: absolute !important;
            top: -3px !important;
            left: 1px !important;
            color: #000 !important;
          }
          ul[data-type="taskList"] li[data-checked="true"] > div {
            text-decoration: line-through !important;
            opacity: 0.6 !important;
          }
        }
      </style>

      <!-- Cabeçalho Técnico de Metadados e Branding -->
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin-bottom: 30px; border-bottom: 2px solid #111; padding-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
          <div>
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <span style="display: inline-block; width: 8px; height: 8px; background-color: #FF4F00; border-radius: 50%;"></span>
              <span style="font-size: 8pt; font-weight: 800; tracking-widest: 0.15em; text-transform: uppercase; color: #111; letter-spacing: 0.1em;">SEGUNDO CÉREBRO</span>
            </div>
            <span style="font-size: 14pt; font-weight: 950; letter-spacing: 0.05em; text-transform: uppercase; color: #111;">MEMÓRIA NEURAL</span>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 7pt; font-weight: 700; color: #666; text-transform: uppercase; margin-bottom: 2px; letter-spacing: 0.05em;">REGISTRO ID</div>
            <div style="font-size: 8.5pt; font-family: monospace; font-weight: bold; color: #111;">${note.id ? note.id.substring(0, 8).toUpperCase() : 'N/A'}</div>
          </div>
        </div>

        <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 26pt; margin: 15px 0 20px 0; font-weight: 700; line-height: 1.25; color: #000; letter-spacing: -0.02em;">
          ${note.title || 'Sem título'}
        </h1>

        <!-- Ficha Técnico de Controle -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; background-color: #fcfcfc; border: 1px solid #e5e5e5; padding: 12px 15px; border-radius: 6px; font-size: 8.5pt; color: #111;">
          <div>
            <span style="color: #555; font-weight: 700; text-transform: uppercase; font-size: 7.5pt; display: block; margin-bottom: 3px; letter-spacing: 0.02em;">Criação</span>
            <span style="font-weight: 500;">${createdAtStr}</span>
          </div>
          <div>
            <span style="color: #555; font-weight: 700; text-transform: uppercase; font-size: 7.5pt; display: block; margin-bottom: 3px; letter-spacing: 0.02em;">Modificação</span>
            <span style="font-weight: 500;">${updatedAtStr}</span>
          </div>
          <div>
            <span style="color: #555; font-weight: 700; text-transform: uppercase; font-size: 7.5pt; display: block; margin-bottom: 3px; letter-spacing: 0.02em;">Marcadores</span>
            <div style="display: flex; flex-wrap: wrap; gap: 4px; font-weight: 500;">${tagsStr}</div>
          </div>
        </div>
      </div>

      <!-- Conteúdo Principal -->
      <div class="prose prose-sm max-w-none text-black" style="color: #111; font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; line-height: 1.65;">
        ${note.content}
      </div>

      <!-- Rodapé com Metadados e Hash de Assinatura -->
      <div style="margin-top: 60px; border-top: 1px solid #e5e5e5; padding-top: 15px; display: flex; justify-content: space-between; align-items: center; font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; font-size: 7.5pt; color: #666;">
        <span>Documento exportado via Segundo Cérebro • Sistema de Memória Neural</span>
        <span>Impresso em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</span>
      </div>
    `;

    // 3. Salva o título original do site e aplica temporariamente o título da nota
    // O navegador usa o <title> do documento como o nome padrão do arquivo "Salvar como PDF"
    const originalTitle = document.title;
    document.title = note.title ? note.title.trim() : 'Nota sem título';

    // 4. Acopla ao body e altera o modo de impressão global
    document.body.appendChild(printContainer);
    document.body.classList.add('is-printing-note');

    // 5. Aguarda um instante para o navegador reprocessar o layout e invoca a impressão nativa
    setTimeout(() => {
      window.print();

      // 6. Limpeza (Cleanup) - Volta o app ao normal imediatamente após a janela de impressão fechar
      document.title = originalTitle; // Devolve o título original do site
      document.body.classList.remove('is-printing-note');
      if (document.body.contains(printContainer)) {
        document.body.removeChild(printContainer);
      }
    }, 150);
  };

  const exportAsTXT = (note: Note) => {
    const element = document.createElement("a");
    const file = new Blob([note.content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${note.title}.txt`;
    document.body.appendChild(element);
    element.click();
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[var(--background)]">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-[var(--accent)] font-bold text-2xl"
        >
          Mente+
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[var(--background)] px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md"
        >
          <div className="bg-accent/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <Sparkles className="text-accent w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold mb-4 tracking-tight">Seu Segundo Cérebro</h1>
          <p className="text-muted-foreground mb-10 text-lg">
            Organize suas ideias, notas e planos de forma inteligente e sincronizada.
          </p>
          <button
            onClick={signIn}
            className="w-full bg-[#1a1a1a] text-white py-4 px-6 rounded-none font-medium hover:bg-black transition-all flex items-center justify-center gap-2 group shadow-xl"
          >
            Começar com Google
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen overflow-hidden bg-[var(--background)] ${isFullscreen ? 'p-0' : ''} touch-pan-y md:touch-auto`}>
      {/* SIDEBAR - Permanente, oculta apenas no Modo Foco */}
      <motion.aside
        initial={false}
        animate={{
          width: isFullscreen ? 0 : 320,
          opacity: isFullscreen ? 0 : 1,
          x: isFullscreen ? -320 : 0
        }}
        className="hidden lg:flex flex-col bg-[var(--sidebar-bg)] border-r border-[var(--border)] relative z-30 overflow-hidden"
      >
        <div className="p-10 flex-1 flex flex-col h-full">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <h2 className="font-serif italic text-3xl tracking-tight flex items-center gap-2">
                Cérebro²
              </h2>
              <button
                onClick={() => setIsSettingsOpen(true)}
                title="Ver detalhes da versão"
                className="text-[10px] font-mono tracking-widest uppercase opacity-40 hover:opacity-100 hover:text-[var(--accent)] transition-all flex items-center gap-1.5 mt-1 cursor-pointer"
              >
                <span>{APP_VERSION}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 inline-block" title="Sistema Operacional" />
              </button>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-none transition-colors text-[var(--foreground)] opacity-60 hover:opacity-100"
              title="Trocar Tema"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>

          <div className="mb-10">
            <button
              onClick={createNewNote}
              className="w-full bg-[var(--accent)] text-[var(--accent-foreground)] py-4 px-4 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-[4px_4px_0px_rgba(0,0,0,0.1)] border border-black/5"
            >
              Nova Nota
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto pb-6 space-y-8 custom-scrollbar">
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-widest text-[var(--foreground)]/40 font-bold">Principal</p>
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setView('all');
                    setActiveTag(null);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-2 rounded-none transition-all text-sm font-medium ${view === 'all' && !activeTag ? 'bg-[var(--muted)] text-[var(--foreground)]' : 'text-[var(--foreground)] opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className={`w-4 h-4 ${view === 'all' && !activeTag ? 'opacity-100' : 'opacity-40'}`} />
                    Todas as Notas
                  </div>
                  <span className="text-[10px] opacity-60 font-mono">{notes.length}</span>
                </button>
                <button
                  onClick={() => {
                    setView('favorites');
                    setActiveTag(null);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-2 rounded-none transition-all text-sm font-medium ${view === 'favorites' ? 'bg-[var(--muted)] text-[var(--foreground)]' : 'text-[var(--foreground)] opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`}
                >
                  <div className="flex items-center gap-3">
                    <Star className={`w-4 h-4 ${view === 'favorites' ? 'text-yellow-500 fill-yellow-500' : 'opacity-40'}`} />
                    Favoritos
                  </div>
                  <span className="text-[10px] opacity-60 font-mono">{notes.filter(n => n.isBookmarked).length}</span>
                </button>
                <button
                  onClick={() => {
                    setView('untagged');
                    setActiveTag(null);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-2 rounded-none transition-all text-sm font-medium ${
                    view === 'untagged'
                      ? 'bg-[var(--muted)] text-[var(--foreground)] border-l-2 border-[var(--accent)]'
                      : 'text-[var(--foreground)] opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <TagIcon className={`w-4 h-4 ${view === 'untagged' ? 'text-[var(--accent)]' : 'opacity-40'}`} />
                    Sem Etiquetas
                  </div>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-none ${
                      untaggedCount > 0
                        ? 'bg-[var(--accent)]/15 text-[var(--accent)] font-bold border border-[var(--accent)]/20'
                        : 'opacity-60'
                    }`}
                  >
                    {untaggedCount}
                  </span>
                </button>
                <button
                  onClick={() => {
                    setView('reminders');
                    setActiveTag(null);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-2 rounded-none transition-all text-sm font-medium ${view === 'reminders' ? 'bg-[var(--muted)] text-[var(--foreground)]' : 'text-[var(--foreground)] opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`}
                >
                  <div className="flex items-center gap-3">
                    <Bell className={`w-4 h-4 ${view === 'reminders' ? 'text-[var(--accent)]' : 'opacity-40'}`} />
                    Lembretes
                  </div>
                  <span className="text-[10px] opacity-60 font-mono">
                    {notes.filter(n => n.reminder || (n.reminders && n.reminders.length > 0)).length}
                  </span>
                </button>
                <button
                  onClick={() => {
                    setView('overdue');
                    setActiveTag(null);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-2 rounded-none transition-all text-sm font-medium ${
                    view === 'overdue'
                      ? 'bg-[var(--muted)] text-[var(--foreground)] border-l-2 border-red-500'
                      : 'text-[var(--foreground)] opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle
                      className={`w-4 h-4 ${
                        view === 'overdue' ? 'text-red-500' : 'text-red-500/70'
                      }`}
                    />
                    Notas Atrasadas
                  </div>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-none ${
                      overdueCount > 0
                        ? 'bg-red-500/15 text-red-600 dark:text-red-400 font-bold border border-red-500/20'
                        : 'opacity-60'
                    }`}
                  >
                    {overdueCount}
                  </span>
                </button>
                <button
                  onClick={() => {
                    setView('completed');
                    setActiveTag(null);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-2 rounded-none transition-all text-sm font-medium ${view === 'completed' ? 'bg-[var(--muted)] text-[var(--foreground)]' : 'text-[var(--foreground)] opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`}
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className={`w-4 h-4 ${view === 'completed' ? 'text-green-500' : 'opacity-40'}`} />
                    Notas Concluídas
                  </div>
                  <span className="text-[10px] opacity-60 font-mono">{notes.filter(n => n.isCompleted).length}</span>
                </button>
              </div>
              <Link
                href="/dashboard"
                className="block w-full text-left text-sm font-medium transition-all hover:italic hover:pl-2 text-accent flex items-center gap-2 pt-2"
              >
                <Brain className="w-4 h-4 opacity-40" />
                Dashboard Neural
              </Link>
            </div>

            <div className="">
              <p className="text-[10px] uppercase tracking-widest text-[var(--foreground)]/40 font-bold mb-4">Etiquetas</p>
              <div className="flex flex-wrap gap-2">
                {allTags.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhuma tag ainda</p>
                ) : (
                  <>
                    {allTags.slice(0, showAllSidebarTags ? undefined : 5).map(tag => (
                      <TagButton
                        key={tag}
                        tag={tag}
                        isActive={activeTag === tag}
                        onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                      />
                    ))}
                    {allTags.length > 5 && (
                      <button
                        onClick={() => setShowAllSidebarTags(!showAllSidebarTags)}
                        className="w-full text-[9px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity py-2 border border-[var(--border)] border-dashed hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/5 mt-2"
                      >
                        {showAllSidebarTags ? 'Ver menos' : `+${allTags.length - 5} Ver todas`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </nav>

          <div className="pt-8 border-t border-[var(--border)]">
            {/* Firebase Usage Monitor */}
            <div className="mb-6 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-nowrap">
                <span className="text-[9px] font-bold uppercase tracking-widest opacity-40 whitespace-nowrap">Capacidade Neural</span>
                <span className="text-[9px] font-mono opacity-40 whitespace-nowrap">{storageUsage.formatted} / 1GB</span>
              </div>
              <div className="h-1 w-full bg-[var(--muted)] rounded-none overflow-hidden border border-black/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${storageUsage.percentage}%` }}
                  className={`h-full transition-colors ${storageUsage.percentage > 90 ? 'bg-red-500' :
                      storageUsage.percentage > 70 ? 'bg-orange-500' :
                        'bg-[var(--accent)]'
                    }`}
                />
              </div>
              <p className="text-[8px] italic opacity-30 leading-tight">Limite do Plano Gratuito (Firestore)</p>
            </div>

            <div className="flex items-center gap-2 text-green-600 mb-6">
              <div className="w-2 h-2 rounded-none bg-current animate-pulse"></div>
              <span className="text-[11px] font-bold uppercase tracking-wider">Sincronizado</span>
            </div>
            <div className="flex items-center gap-3">
              <Image
                src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                width={32}
                height={32}
                className="rounded-none border border-border"
                alt="Avatar"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold truncate uppercase tracking-widest">{user.displayName || 'Usuário'}</p>
              </div>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 hover:bg-[var(--muted)] text-[var(--foreground)] rounded-none transition-colors"
                title="Configurações"
              >
                <Settings className="w-3 h-3" />
              </button>
              <button
                onClick={logOut}
                className="p-2 hover:bg-[var(--muted)] text-[var(--foreground)] rounded-none transition-colors"
                title="Sair"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </motion.aside>



      {/* NOTE LIST - Hidden on mobile if editor is open */}
      <section className={`w-full md:w-80 border-r border-[var(--border)] bg-[var(--background)] flex flex-col relative z-10 
        ${mobileView === 'editor' ? 'hidden md:flex' : 'flex'}`}
      >


        {/* Mobile Header for List View */}
        <div className="md:hidden flex items-center justify-between p-5 pb-0 bg-[var(--background)]">
          <div>
            <h2 className="font-serif italic text-2xl tracking-tight text-[var(--foreground)]">Cérebro²</h2>
            <button
              onClick={() => setIsSettingsOpen(true)}
              title="Ver detalhes da versão"
              className="text-[9px] font-mono tracking-widest uppercase opacity-40 hover:opacity-100 transition-all flex items-center gap-1 mt-0.5"
            >
              <span>{APP_VERSION}</span>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-specialist-chat'))}
              className="p-2 bg-[#FF4F00]/10 text-[#FF4F00] border border-[#FF4F00]/20 shadow-[2px_2px_0px_rgba(0,0,0,0.05)] transition-all active:scale-95"
              title="Especialista Neural"
            >
              <Brain className="w-5 h-5" />
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-[var(--muted)] text-[var(--foreground)]/60 transition-colors"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 hover:bg-[var(--muted)] text-[var(--foreground)]/60 transition-colors"
              title="Configurações"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={logOut}
              className="p-2 hover:bg-[var(--muted)] text-[var(--foreground)]/60 transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 md:p-8 pt-2 md:pt-8">
          <div className="relative mb-2 md:mb-6">
            <SearchIcon className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isSemanticSearch ? 'text-[var(--accent)] opacity-100' : 'opacity-30'}`} />
            <input
              type="text"
              placeholder={isSemanticSearch ? "Busca Semântica ativa..." : "Buscar..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-transparent pl-8 pr-12 py-1 outline-none text-sm font-sans font-medium text-[var(--foreground)] placeholder:text-[var(--foreground)]/30 transition-all ${isSemanticSearch ? 'text-[var(--accent)]' : ''}`}
            />
            <button
              onClick={() => setIsSemanticSearch(!isSemanticSearch)}
              className={`absolute right-0 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px] font-bold uppercase tracking-widest border transition-all ${isSemanticSearch ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-[2px_2px_0px_rgba(0,0,0,0.1)]' : 'border-[var(--border)] opacity-40 hover:opacity-100'}`}
              title="Ativar Busca Semântica"
            >
              {isSemanticLoading ? '...' : '✨'}
            </button>
          </div>
          <div className="flex items-center justify-between text-[10px] opacity-40 font-bold uppercase tracking-widest">
            <div className="flex gap-2 items-center">
              <span>{filteredNotes.length} Notas</span>
              {isSemanticSearch && semanticKeywords.length > 0 && (
                <div className="flex items-center gap-1 text-[var(--accent)] text-[7px] animate-pulse">
                  <div className="w-1 h-1 bg-[var(--accent)]" />
                  CONCEITOS: {semanticKeywords.join(' · ')}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 custom-scrollbar space-y-4">
          {filteredNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              isActive={activeNoteId === note.id}
              onClick={() => {
                setActiveNoteId(note.id);
                setMobileView('editor');
              }}
              onToggleComplete={(e) => {
                e.stopPropagation();
                updateNote(note.id, { isCompleted: !note.isCompleted });
              }}
              onSnooze={(e) => {
                e.stopPropagation();
                const nextDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
                updateNote(note.id, { expiryDate: Timestamp.fromDate(nextDay) });
              }}
            />
          ))}
          {filteredNotes.length === 0 && (
            <div className="py-20 text-center px-4">
              <p className="text-sm font-sans font-medium text-[var(--foreground)] opacity-50">
                {view === 'untagged'
                  ? 'Tudo organizado! Nenhuma nota pendente de etiquetas.'
                  : view === 'overdue'
                    ? 'Nenhuma nota atrasada no momento.'
                    : 'Nenhuma nota encontrada'}
              </p>
            </div>
          )}
          <div className="h-16 md:hidden"></div> {/* Spacer for mobile navbar */}
        </div>
      </section>

      {/* EDITOR - Full screen or mobile controlled */}
      <main className={`flex-1 bg-[var(--background)] flex flex-col overflow-hidden relative ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--background)]">
          <button
            onClick={() => {
              setMobileView('list');
              setIsFullscreen(false);
            }}
            className="flex items-center gap-1 text-sm font-bold uppercase text-[var(--foreground)]"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-specialist-chat'))}
              className="p-2 bg-[#FF4F00] text-white shadow-[4px_4px_0px_rgba(0,0,0,0.1)] active:scale-95 transition-all border border-black/5"
              title="Especialista Neural"
            >
              <Brain className="w-5 h-5" />
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-[var(--muted)] text-[var(--foreground)]/60 transition-colors"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 hover:bg-[var(--muted)] text-[var(--foreground)]/60 transition-colors"
              title="Configurações"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={logOut}
              className="p-2 hover:bg-[var(--muted)] text-[var(--foreground)]/60 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
        <AnimatePresence mode="wait">
          {activeNote ? (
            <ActiveNoteEditor
              key={activeNote.id}
              activeNote={activeNote}
              updateNote={updateNote}
              isFullscreen={isFullscreen}
              isAiLoading={isAiLoading}
              handleAiAction={handleAiAction}
              exportAsPDF={exportAsPDF}
              deleteNote={deleteNote}
              cloneNote={cloneNote}
              setIsFullscreen={setIsFullscreen}
              setIsTagModalOpen={setIsTagModalOpen}
              setNewTagInput={setNewTagInput}
              relatedNotes={relatedNotes}
              setActiveNoteId={setActiveNoteId}
              setIsAIAssistantOpen={setIsAIAssistantOpen}
              backlinks={backlinks}
              allNotes={notes}
              refreshKey={editorRefreshKey}
              setTagToDelete={setTagToDelete}
              setIsTagDeleteModalOpen={setIsTagDeleteModalOpen}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="bg-muted w-24 h-24 rounded-none flex items-center justify-center mb-6">
                <Plus className="text-muted-foreground w-8 h-8 opacity-20" />
              </div>
              <h3 className="text-xl font-bold mb-2">Selecione uma nota</h3>
              <p className="text-muted-foreground max-w-xs">
                Escolha uma nota ao lado ou crie uma nova para começar a capturar seus pensamentos.
              </p>
              <button
                onClick={createNewNote}
                className="mt-8 text-accent font-bold hover:underline"
              >
                + Criar nova nota agora
              </button>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* MOBILE NAVBAR */}
      {!isFullscreen && (
        <>
          <div className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-[var(--background)]/80 backdrop-blur-xl border-t border-[var(--border)] flex items-center z-40 px-4 pb-2">
            <div className="flex-1 flex justify-around pr-8">
              <button
                onClick={() => { setView('all'); setMobileView('list'); setActiveTag(null); }}
                className={`flex flex-col items-center gap-1 transition-all ${view === 'all' && !activeTag ? 'text-[var(--foreground)] scale-105' : 'text-[var(--foreground)]/30'}`}
                title="Notas"
              >
                <FileText className={`w-5.5 h-5.5 ${view === 'all' && !activeTag ? 'opacity-100' : 'opacity-40'}`} />
                <span className="text-[9px] font-bold uppercase tracking-widest">Notas</span>
              </button>

              <button
                onClick={() => { setView('favorites'); setMobileView('list'); setActiveTag(null); }}
                className={`flex flex-col items-center gap-1 transition-all ${view === 'favorites' ? 'text-[var(--foreground)] scale-105' : 'text-[var(--foreground)]/30'}`}
                title="Favoritos"
              >
                <Star className={`w-5.5 h-5.5 ${view === 'favorites' ? 'fill-current opacity-100' : 'opacity-40'}`} />
                <span className="text-[9px] font-bold uppercase tracking-widest">Favoritos</span>
              </button>
            </div>

            <div className="w-16"></div> {/* Center space for FAB */}

            <div className="flex-1 flex justify-around pl-4">
              <Link
                href="/dashboard"
                className="flex flex-col items-center gap-1 text-[var(--foreground)]/30 hover:text-[var(--foreground)] transition-all"
                title="Dashboard Neural"
              >
                <Brain className="w-5.5 h-5.5 opacity-40" />
                <span className="text-[9px] font-bold uppercase tracking-widest">Dash</span>
              </Link>

              <button
                onClick={() => setIsMobileTagsModalOpen(true)}
                className={`flex flex-col items-center gap-1 transition-all ${activeTag ? 'text-[var(--foreground)] scale-105' : 'text-[var(--foreground)]/30'}`}
                title="Tags"
              >
                <TagIcon className={`w-5.5 h-5.5 ${activeTag ? 'opacity-100' : 'opacity-40'}`} />
                <span className="text-[9px] font-bold uppercase tracking-widest">{activeTag ? `#${activeTag}` : 'Tags'}</span>
              </button>
            </div>
          </div>

          {/* FLOATING ACTION BUTTON (FAB) */}
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            initial={{ scale: 0, y: 100 }}
            animate={{ scale: 1, y: 0 }}
            onClick={createNewNote}
            className="md:hidden fixed bottom-8 left-1/2 -translate-x-1/2 w-14 h-14 bg-[var(--accent)] text-[var(--accent-foreground)] rounded-none shadow-[4px_4px_0px_rgba(0,0,0,0.1)] flex items-center justify-center z-50 border border-black/5 group"
          >
            <Plus className="w-7 h-7 transition-transform group-active:rotate-180" />
          </motion.button>
        </>
      )}

      {/* MOBILE TAGS SELECTION MODAL */}
      <AnimatePresence>
        {isMobileTagsModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-end md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileTagsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative bg-[var(--background)] rounded-t-[2.5rem] shadow-2xl p-8 pt-10 w-full border-t border-[var(--border)] max-h-[80vh] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-[var(--border)] rounded-none mx-auto mb-8 opacity-50" />

              <div className="mb-8">
                <h3 className="text-2xl font-sans font-bold mb-2 tracking-tight">Filtrar por Tags</h3>
                <p className="text-[10px] text-[var(--foreground)]/40 uppercase font-bold tracking-[0.2em]">Selecione uma etiqueta para filtrar</p>
              </div>

              <div className="flex flex-wrap gap-3 mb-10">
                <button
                  onClick={() => {
                    setActiveTag(null);
                    setIsMobileTagsModalOpen(false);
                  }}
                  className={`px-4 py-3 rounded-none text-xs font-bold uppercase tracking-widest transition-all ${!activeTag ? 'bg-[var(--foreground)] text-[var(--background)]' : 'bg-[var(--muted)] text-[var(--foreground)] opacity-60'}`}
                >
                  Todas as Notas
                </button>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      setActiveTag(tag === activeTag ? null : tag);
                      setIsMobileTagsModalOpen(false);
                    }}
                    className={`px-5 py-4 rounded-none text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 border-2 ${activeTag === tag
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)] shadow-inner'
                        : 'border-transparent bg-[var(--muted)] text-[var(--foreground)]/60'
                      }`}
                  >
                    {activeTag === tag && <div className="w-2 h-2 bg-[var(--accent)] animate-pulse" />}
                    #{tag}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setIsMobileTagsModalOpen(false)}
                className="w-full py-5 bg-[var(--muted)] text-[var(--foreground)] rounded-none font-bold uppercase text-[10px] tracking-[0.3em] hover:opacity-90 transition-all"
              >
                Fechar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TAG MODAL */}
      <AnimatePresence>
        {isTagModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTagModalOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              className="relative bg-[var(--background)] rounded-none shadow-2xl p-6 sm:p-7 max-w-md w-full border-2 border-[var(--border)] overflow-hidden"
            >
              {/* Neo-brutalist top accent (NO violet/purple!) */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--accent)]" />

              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 mb-5 pt-1">
                <div>
                  <div className="flex items-center gap-2">
                    <TagIcon className="w-4 h-4 text-[var(--accent)]" />
                    <h3 className="text-base sm:text-lg font-sans font-bold tracking-tight text-[var(--foreground)]">
                      Gerenciar Etiquetas
                    </h3>
                  </div>
                  <p className="text-[10px] text-[var(--foreground)]/50 uppercase font-bold tracking-wider mt-1">
                    {tagsToAssign.length} etiqueta(s) vinculada(s)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTagModalOpen(false)}
                  className="p-1.5 text-[var(--foreground)]/40 hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                  aria-label="Fechar modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Active Tags Chips (Currently bound to note) */}
              <div className="mb-4">
                <div className="text-[9px] uppercase font-bold tracking-widest text-[var(--foreground)]/40 mb-2 flex items-center justify-between">
                  <span>Etiquetas Vinculadas</span>
                  {tagsToAssign.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRemoveAllAssignedTags}
                      className="text-[9px] font-bold text-red-500/70 hover:text-red-500 uppercase tracking-widest transition-colors"
                    >
                      Remover todas
                    </button>
                  )}
                </div>
                {tagsToAssign.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar p-2 bg-[var(--muted)]/30 border border-[var(--border)]">
                    {tagsToAssign.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider bg-[var(--accent)] text-white shadow-sm"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveAssignedTag(tag)}
                          className="hover:bg-black/20 rounded p-0.5 transition-colors leading-none"
                          title="Remover etiqueta"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 border border-dashed border-[var(--border)] bg-[var(--muted)]/10 text-center">
                    <p className="text-[11px] text-[var(--foreground)]/40 italic">
                      Nenhuma etiqueta vinculada ainda.
                    </p>
                  </div>
                )}
              </div>

              {/* Botão de Sugestão Contextual por IA */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={handleAiSuggestTags}
                  disabled={isAiSuggestingTags}
                  className="w-full py-2.5 px-3 bg-[var(--accent)]/10 hover:bg-[var(--accent)] text-[var(--accent)] hover:text-white border border-[var(--accent)]/30 hover:border-[var(--accent)] transition-all flex items-center justify-between text-[10px] font-bold uppercase tracking-wider disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className={`w-3.5 h-3.5 ${isAiSuggestingTags ? 'animate-spin' : ''}`} />
                    <span>{isAiSuggestingTags ? 'Analisando nota com IA...' : 'Sugerir Tags com IA'}</span>
                  </div>
                  <span className="text-[9px] font-mono font-normal opacity-70 normal-case">
                    {isAiSuggestingTags ? 'Avaliando contexto...' : 'Reaproveita existentes + novas'}
                  </span>
                </button>
              </div>

              {/* Box de Sugestões da IA */}
              {aiSuggestedTags.length > 0 && (
                <div className="mb-4 p-3 bg-[var(--muted)]/40 border-2 border-[var(--accent)]/40 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between text-[9px] uppercase font-bold tracking-widest text-[var(--foreground)]/70 mb-2.5">
                    <span className="flex items-center gap-1.5 text-[var(--accent)]">
                      <Sparkles className="w-3 h-3" />
                      Sugestões da IA ({aiSuggestedTags.length})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const newTags = aiSuggestedTags.map(s => s.tag);
                          setTagsToAssign(prev => Array.from(new Set([...prev, ...newTags])));
                          setAiSuggestedTags([]);
                        }}
                        className="text-[9px] font-bold uppercase tracking-wider text-[var(--accent)] hover:underline"
                      >
                        + Aceitar Todas
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiSuggestedTags([])}
                        className="text-[9px] opacity-40 hover:opacity-100 p-0.5"
                        title="Descartar sugestões"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {aiSuggestedTags.map(item => (
                      <button
                        type="button"
                        key={item.tag}
                        onClick={() => {
                          setTagsToAssign(prev => Array.from(new Set([...prev, item.tag])));
                          setAiSuggestedTags(prev => prev.filter(s => s.tag !== item.tag));
                        }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider border transition-all cursor-pointer animate-in fade-in zoom-in-95 duration-200 ${
                          item.isExisting
                            ? 'bg-[var(--background)] text-[var(--foreground)] border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--muted)]'
                            : 'bg-[var(--accent)]/15 text-[var(--accent)] border-dashed border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white'
                        }`}
                        title={item.isExisting ? 'Tag já existente no sistema' : 'Nova tag conceitual sugerida pela IA'}
                      >
                        <Plus className="w-2.5 h-2.5" />
                        <span>#{item.tag}</span>
                        <span className={`text-[8px] px-1 py-0.2 font-sans uppercase font-bold rounded-sm ${
                          item.isExisting
                            ? 'bg-[var(--muted)] text-[var(--foreground)]/60'
                            : 'bg-[var(--accent)] text-white'
                        }`}>
                          {item.isExisting ? 'Existente' : 'Nova'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Omni-Input: Search & Create */}
              <div className="mb-4">
                <label className="block text-[9px] uppercase font-bold tracking-widest text-[var(--foreground)]/40 mb-1.5">
                  Buscar ou Adicionar Nova
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground)]/30" />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Ex: projeto, estudo, financas..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const raw = newTagInput.trim();
                          if (!raw) return;
                          const rawTokens = raw.split(/[,;\s]+/);
                          const normalizedTokens = rawTokens
                            .map(t => normalizeTag(t))
                            .filter(Boolean);
                          if (normalizedTokens.length > 0) {
                            setTagsToAssign(prev => Array.from(new Set([...prev, ...normalizedTokens])));
                            setNewTagInput('');
                          }
                        }
                      }}
                      className="w-full bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] py-2.5 pl-10 pr-3 text-xs font-mono focus:outline-none focus:border-[var(--accent)] transition-all placeholder:text-[var(--foreground)]/30 placeholder:font-sans"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const raw = newTagInput.trim();
                      if (!raw) return;
                      const rawTokens = raw.split(/[,;\s]+/);
                      const normalizedTokens = rawTokens
                        .map(t => normalizeTag(t))
                        .filter(Boolean);
                      if (normalizedTokens.length > 0) {
                        setTagsToAssign(prev => Array.from(new Set([...prev, ...normalizedTokens])));
                        setNewTagInput('');
                      }
                    }}
                    disabled={!newTagInput.trim()}
                    className="px-3 py-2.5 bg-[var(--foreground)] text-[var(--background)] disabled:opacity-30 disabled:cursor-not-allowed font-bold text-[10px] uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white transition-colors flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Suggested / Filtered Tags List */}
              <div className="mb-5">
                <div className="flex items-center justify-between text-[9px] uppercase font-bold tracking-widest text-[var(--foreground)]/40 mb-2">
                  <span>
                    {newTagInput.trim() ? 'Resultados da Busca' : 'Todas as Etiquetas'} ({filteredAvailableTags.length})
                  </span>
                  <span className="text-[8px] font-normal normal-case opacity-60">
                    Clique para alternar
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-2 bg-[var(--muted)]/20 border border-[var(--border)]">
                  {/* If user typed something that doesn't exist yet, offer instant create */}
                  {(() => {
                    const typedNorm = normalizeTag(newTagInput);
                    const alreadyExists = allTags.includes(typedNorm);
                    const alreadyAssigned = tagsToAssign.includes(typedNorm);
                    if (typedNorm && !alreadyExists && !alreadyAssigned) {
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setTagsToAssign(prev => Array.from(new Set([...prev, typedNorm])));
                            setNewTagInput('');
                          }}
                          className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider bg-[var(--accent)]/15 text-[var(--accent)] border border-dashed border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Criar #{typedNorm}
                        </button>
                      );
                    }
                    return null;
                  })()}

                  {filteredAvailableTags.map(tag => {
                    const isSelected = tagsToAssign.includes(tag);
                    const count = tagCountMap[tag] || 0;
                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => {
                          if (isSelected) {
                            setTagsToAssign(prev => prev.filter(t => t !== tag));
                          } else {
                            setTagsToAssign(prev => [...prev, tag]);
                          }
                        }}
                        className={`px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider transition-all border flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm'
                            : 'bg-[var(--background)] text-[var(--foreground)] border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--muted)]'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        <span>#{tag}</span>
                        <span className={`text-[8px] px-1 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-[var(--muted)] text-[var(--foreground)]/50'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}

                  {filteredAvailableTags.length === 0 && !newTagInput.trim() && (
                    <p className="text-[10px] opacity-40 italic p-2">Nenhuma etiqueta cadastrada ainda.</p>
                  )}
                  {filteredAvailableTags.length === 0 && newTagInput.trim() && !normalizeTag(newTagInput) && (
                    <p className="text-[10px] opacity-40 italic p-2">Nenhuma etiqueta encontrada.</p>
                  )}
                </div>
              </div>

              {/* Fast Unification Status / Notice */}
              {unifyMessage && (
                <div className="mb-4 p-2 bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[10px] font-mono text-[var(--accent)] text-center">
                  {unifyMessage}
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleUnifyAndCleanAllTags}
                  disabled={isUnifyingTags}
                  title="Varre todas as notas e padroniza tags minúsculas e sem duplicatas"
                  className="px-2.5 py-2 text-[9px] font-bold uppercase tracking-widest text-[var(--foreground)]/60 hover:text-[var(--accent)] border border-transparent hover:border-[var(--border)] transition-colors flex items-center gap-1 disabled:opacity-40"
                >
                  <RefreshCw className={`w-3 h-3 ${isUnifyingTags ? 'animate-spin text-[var(--accent)]' : ''}`} />
                  {isUnifyingTags ? 'Unificando...' : 'Unificar Banco'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsTagModalOpen(false)}
                    className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--foreground)]/50 hover:text-[var(--foreground)] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      let finalTags = [...tagsToAssign];
                      const raw = newTagInput.trim();
                      if (raw) {
                        const rawTokens = raw.split(/[,;\s]+/);
                        const normalizedTokens = rawTokens
                          .map(t => normalizeTag(t))
                          .filter(Boolean);
                        finalTags = [...finalTags, ...normalizedTokens];
                      }
                      const uniqueNormalized = Array.from(new Set(finalTags));

                      if (activeNote) {
                        updateNote(activeNote.id, { tags: uniqueNormalized });
                      }
                      setIsTagModalOpen(false);
                    }}
                    className="px-4 py-2 bg-[var(--accent)] text-white font-bold uppercase text-[10px] tracking-widest hover:opacity-90 transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Salvar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        notes={notes}
        onAction={handleCommandAction}
      />

      <AIAssistantModal
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        content={activeNote?.content || ""}
        onApply={handleAIAssistantApply}
        onAddTags={handleAIAssistantTags}
        existingTags={allExistingTags}
      />

      {/* CUSTOM DELETE MODAL */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-[var(--background)] border border-red-500/30 p-8 shadow-[20px_20px_0px_rgba(239,68,68,0.1)]"
            >
              <div className="flex items-center gap-3 text-red-500 mb-6">
                <AlertTriangle className="w-6 h-6" />
                <h2 className="text-xl font-bold uppercase tracking-widest">Excluir Nota?</h2>
              </div>
              <p className="text-sm text-[var(--foreground)]/60 mb-8 leading-relaxed">
                Você está prestes a apagar permanentemente esta nota. Esta ação não pode ser desfeita após o período de restauração.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest border border-[var(--border)] hover:bg-[var(--muted)] transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={executeDelete}
                  className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 shadow-[4px_4px_0px_rgba(0,0,0,0.2)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* UNDO TOAST */}
      <AnimatePresence>
        {showUndoToast && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[120] bg-black text-white px-6 py-4 flex items-center gap-6 shadow-2xl border border-white/10"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-4 h-4 text-red-400" />
              <span className="text-xs font-bold uppercase tracking-widest">Nota excluída</span>
            </div>
            <button
              onClick={undoDelete}
              className="flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-widest hover:underline"
            >
              <RotateCcw className="w-3 h-3" /> Desfazer
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NEURAL REMINDER ALERT MODAL */}
      <AnimatePresence>
        {isReminderAlertOpen && currentReminderNote && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-[var(--background)] border-2 border-[var(--accent)] p-8 shadow-[20px_20px_0px_rgba(0,0,0,0.1)]"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-[var(--accent)] rounded-full animate-ping opacity-20" />
                  <div className="relative w-16 h-16 bg-[var(--accent)] flex items-center justify-center shadow-lg">
                    <Bell className="w-8 h-8 text-white animate-bounce" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-[var(--accent)]">Alerta Neural</span>
                    {currentReminderLabel && (
                      <span className="px-2 py-0.5 bg-[var(--accent)]/15 text-[var(--accent)] text-[9px] font-mono font-bold uppercase tracking-wider border border-[var(--accent)]/30">
                        {currentReminderLabel}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-sans font-semibold text-[var(--foreground)]">{currentReminderNote.title || 'Pensamento Sem Título'}</h2>
                  <p className="text-xs opacity-60 line-clamp-2 max-w-[280px] mx-auto">
                    {((currentReminderNote.content || '').replace(/<[^>]*>/g, '') || 'Este pensamento requer sua atenção agora.').substring(0, 120)}...
                  </p>
                </div>

                <div className="w-full pt-4 flex flex-col gap-3">
                  <button
                    onClick={() => {
                      if (currentReminderNote) {
                        const noteId = currentReminderNote.id;
                        setIsReminderAlertOpen(false);
                        setActiveNoteId(noteId);
                        setMobileView('editor');
                      }
                    }}
                    className="w-full py-4 bg-[var(--accent)] text-white text-[10px] font-bold uppercase tracking-[0.2em] shadow-[4px_4px_0px_rgba(0,0,0,0.2)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowRight className="w-4 h-4" /> Expandir Pensamento
                  </button>
                  <button
                    onClick={() => setIsReminderAlertOpen(false)}
                    className="w-full py-3 text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-all"
                  >
                    Ignorar por enquanto
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SETTINGS MODAL */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg bg-[var(--background)] border border-[var(--border)] shadow-[40px_40px_0px_rgba(0,0,0,0.1)] flex flex-col max-h-[90vh]"
            >
              <div className="p-6 md:p-10 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <h2 className="text-2xl font-sans font-bold mb-2 tracking-tight">Configurações</h2>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">Personalize sua interface neural</p>
                  </div>
                  <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 transition-all">
                    <X className="w-5 h-5 opacity-40" />
                  </button>
                </div>

                <div className="space-y-10">
                  <section className="space-y-6">
                    <div className="flex items-center gap-3 border-l-4 border-[var(--accent)] pl-4">
                      <Bell className="w-5 h-5 text-[var(--accent)]" />
                      <h3 className="text-sm font-bold uppercase tracking-widest">Alarme Neural</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { id: 'neural', name: 'Neural', desc: 'Sutil e decrescente' },
                        { id: 'crystal', name: 'Crystal', desc: 'Agudo e direto' },
                        { id: 'pulsar', name: 'Pulsar', desc: 'Alerta duplo' },
                        { id: 'zen', name: 'Zen', desc: 'Harmônico longo' }
                      ].map(type => (
                        <button
                          key={type.id}
                          onClick={() => {
                            setAlarmType(type.id as any);
                            localStorage.setItem('alarmType', type.id);
                            playNeuralSound(type.id);
                          }}
                          className={`text-left p-4 border-2 transition-all group ${alarmType === type.id
                              ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                              : 'border-[var(--border)] hover:border-[var(--accent)]/30'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${alarmType === type.id ? 'text-[var(--accent)]' : 'opacity-40'}`}>
                              {type.name}
                            </span>
                            {alarmType === type.id && <div className="w-2 h-2 bg-[var(--accent)]" />}
                          </div>
                          <p className="text-[10px] opacity-60 leading-relaxed">{type.desc}</p>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-6">
                    <div className="flex items-center justify-between border-l-4 border-[var(--accent)] pl-4">
                      <div className="flex items-center gap-3">
                        <TagIcon className="w-5 h-5 text-[var(--accent)]" />
                        <h3 className="text-sm font-bold uppercase tracking-widest">Gerenciar Tags</h3>
                      </div>
                      <button
                        type="button"
                        onClick={handleUnifyAndCleanAllTags}
                        disabled={isUnifyingTags}
                        className="px-3 py-1.5 bg-[var(--foreground)] text-[var(--background)] text-[9px] font-bold uppercase tracking-wider hover:bg-[var(--accent)] hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-40"
                        title="Verificar todas as notas e corrigir tags duplicadas ou com caixas diferentes"
                      >
                        <RefreshCw className={`w-3 h-3 ${isUnifyingTags ? 'animate-spin' : ''}`} />
                        {isUnifyingTags ? 'Unificando...' : 'Unificar Tags Globais'}
                      </button>
                    </div>

                    {unifyMessage && (
                      <div className="p-2.5 bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-xs font-mono text-[var(--accent)] flex items-center gap-2">
                        <Check className="w-4 h-4 shrink-0" />
                        <span>{unifyMessage}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2 p-1">
                      {allTags.map(tag => (
                        <div key={tag} className="group relative">
                          <span className="px-3 py-2 bg-[var(--muted)] text-[var(--foreground)] text-[10px] font-bold uppercase tracking-widest border border-[var(--border)] flex items-center gap-2">
                            #{tag}
                            <button
                              onClick={() => {
                                setGlobalTagToDelete(tag);
                                setIsGlobalTagDeleteModalOpen(true);
                              }}
                              className="text-red-500 opacity-40 hover:opacity-100 transition-opacity"
                              title="Excluir de todas as notas"
                            >
                              <Trash2 size={12} />
                            </button>
                          </span>
                        </div>
                      ))}
                      {allTags.length === 0 && (
                        <p className="text-[10px] opacity-30 italic">Nenhuma etiqueta criada ainda.</p>
                      )}
                    </div>
                  </section>

                  {/* SOBRE O SISTEMA */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-3 border-l-4 border-[var(--accent)] pl-4">
                      <Info className="w-5 h-5 text-[var(--accent)]" />
                      <h3 className="text-sm font-bold uppercase tracking-widest">Sobre o Sistema</h3>
                    </div>

                    <div className="p-4 border border-[var(--border)] bg-[var(--muted)]/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium opacity-60">Aplicação</span>
                        <span className="text-xs font-bold font-sans">{APP_NAME}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium opacity-60">Versão Atual</span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">
                          {APP_VERSION}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium opacity-60">Ambiente</span>
                        <span className="text-[10px] font-mono uppercase tracking-wider opacity-60">
                          {process.env.NODE_ENV === 'production' ? 'Produção' : 'Desenvolvimento'}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-[var(--border)] space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">Notas da Atualização ({APP_VERSION})</p>
                        <p className="text-[10px] opacity-70 leading-relaxed">
                          • <strong>Mapa Mental Neural</strong>: Nova visualização em árvore com agrupamento automático por tags e agrupamento semântico por IA.<br />
                          • <strong>Múltiplos Lembretes por Nota</strong>: Gestão de múltiplos alertas com rótulos personalizados e disparo sonoro neural.<br />
                          • <strong>Grafo com Zoom Cinemático & Target Lock</strong>: Feedback tátil com radar pulsante e card HUD de alta legibilidade no hover.<br />
                          • <strong>Seletor Brutalista Aperfeiçoado</strong>: Alinhamento vertical centralizado e rolagem suave nos seletores de horário.<br />
                          • <strong>Resiliência de IA (Fallback Dinâmico)</strong>: Execução principal no Gemini 3.8 Flash otimizado para economia de tokens, com contingência automática para 3.1 Flash Lite em alta demanda.
                        </p>
                      </div>
                      <div className="pt-2 border-t border-[var(--border)] text-[10px] opacity-40 leading-relaxed">
                        Sistema neural de gestão de conhecimento, notas estruturadas e síntese cognitiva.
                      </div>
                    </div>
                  </section>
                </div>

                <div className="mt-12 pt-8 border-t border-[var(--border)]">
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="w-full py-4 bg-[var(--foreground)] text-[var(--background)] text-[10px] font-bold uppercase tracking-[0.2em] shadow-[8px_8px_0px_rgba(0,0,0,0.1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                  >
                    Salvar e Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TAG DELETE MODAL */}
      <AnimatePresence>
        {isTagDeleteModalOpen && tagToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsTagDeleteModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-[var(--background)] border border-red-500/30 p-8 shadow-[20px_20px_0px_rgba(239,68,68,0.1)]"
            >
              <div className="flex items-center gap-3 text-red-500 mb-6">
                <TagIcon className="w-6 h-6" />
                <h2 className="text-xl font-bold uppercase tracking-widest">Remover Tag?</h2>
              </div>
              <p className="text-sm text-[var(--foreground)]/60 mb-8 leading-relaxed">
                Deseja remover a etiqueta <span className="font-bold text-[var(--foreground)]">#{tagToDelete.tag}</span> deste pensamento?
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsTagDeleteModalOpen(false)}
                  className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest border border-[var(--border)] hover:bg-[var(--muted)] transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={executeTagDelete}
                  className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 shadow-[4px_4px_0px_rgba(0,0,0,0.2)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GLOBAL TAG DELETE MODAL */}
      <AnimatePresence>
        {isGlobalTagDeleteModalOpen && globalTagToDelete && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsGlobalTagDeleteModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-[var(--background)] border border-red-500/30 p-8 shadow-[20px_20px_0px_rgba(239,68,68,0.1)]"
            >
              <div className="flex items-center gap-3 text-red-500 mb-6">
                <AlertTriangle className="w-6 h-6" />
                <h2 className="text-xl font-bold uppercase tracking-widest">Exclusão Global</h2>
              </div>
              <p className="text-sm text-[var(--foreground)]/60 mb-8 leading-relaxed">
                Você está prestes a remover a tag <span className="font-bold text-[var(--foreground)]">#{globalTagToDelete}</span> de <span className="font-bold text-[var(--foreground)]">{notes.filter(n => n.tags?.includes(globalTagToDelete)).length} notas</span>. Deseja continuar?
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsGlobalTagDeleteModalOpen(false)}
                  className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest border border-[var(--border)] hover:bg-[var(--muted)] transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={executeGlobalTagDelete}
                  className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 shadow-[4px_4px_0px_rgba(0,0,0,0.2)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TAG UNDO TOAST */}
      <AnimatePresence>
        {showTagUndoToast && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[120] bg-black text-white px-6 py-4 flex items-center gap-6 shadow-2xl border border-white/10"
          >
            <div className="flex items-center gap-3">
              <TagIcon className="w-4 h-4 text-accent" />
              <span className="text-xs font-bold uppercase tracking-widest">
                {lastDeletedTag?.affectedNoteIds ? `Tag removida de ${lastDeletedTag.affectedNoteIds.length} notas` : `Tag removida: #${lastDeletedTag?.tag}`}
              </span>
            </div>
            <button
              onClick={undoTagDelete}
              className="flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-widest hover:underline"
            >
              <RotateCcw className="w-3 h-3" /> Desfazer
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI FALLBACK TRANSPARENCY TOAST */}
      <AnimatePresence>
        {aiFallbackToast && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[130] bg-[#141414] text-white px-5 py-3.5 flex items-center gap-4 shadow-2xl border border-amber-500/40 max-w-[92vw] sm:max-w-md backdrop-blur-md"
          >
            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                  Alta Demanda na IA
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 bg-amber-500/20 text-amber-300 font-bold uppercase">
                  {aiFallbackToast.modelUsed}
                </span>
              </div>
              <p className="text-[11px] text-white/70 leading-snug mt-0.5">
                {aiFallbackToast.reason || `Modelo principal sobrecarregado. Alternado automaticamente para ${aiFallbackToast.modelUsed} com menor consumo de tokens.`}
              </p>
            </div>
            <button
              onClick={() => setAiFallbackToast(null)}
              className="text-white/40 hover:text-white p-1 transition-colors shrink-0"
              aria-label="Fechar notificação"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
