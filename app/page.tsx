'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { Note } from '@/lib/types';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
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
  Check
} from 'lucide-react';
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

// Helper to strip HTML for previews
const stripHtml = (html: string) => {
  if (typeof window === 'undefined') return html;
  const doc = new Range().createContextualFragment(html);
  return doc.textContent || "";
};


const NoteCard = React.memo(({ 
  note, 
  isActive, 
  onClick,
  onToggleComplete
}: { 
  note: Note, 
  isActive: boolean, 
  onClick: () => void,
  onToggleComplete: (e: React.MouseEvent) => void
}) => {
  return (
    <motion.div
      layout
      onClick={onClick}
      className={`p-6 border transition-all cursor-pointer mb-3 rounded-none group ${isActive ? 'bg-[var(--muted)] border-[var(--accent)] shadow-sm' : 'border-[var(--border)] hover:border-[var(--foreground)]/10 hover:bg-[var(--muted)]/50'} ${note.isCompleted ? 'opacity-60' : 'opacity-100'}`}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-tighter opacity-40 text-[var(--foreground)]">
          {note.updatedAt ? format(note.updatedAt.toDate(), 'dd MMM', { locale: ptBR }) : 'Agora'}
        </p>
        <div className="flex items-center gap-2">
          <button 
            onClick={onToggleComplete}
            className={`w-5 h-5 border-2 rounded-full flex items-center justify-center transition-all ${note.isCompleted ? 'bg-[#FF4F00] border-[#FF4F00] text-white' : 'border-[var(--border)] hover:border-[#FF4F00] text-transparent'}`}
          >
            {note.isCompleted && <Check size={12} strokeWidth={3} />}
          </button>
          {note.isBookmarked && <Bookmark className="w-3 h-3 fill-[var(--accent)] text-[var(--accent)] opacity-30" />}
        </div>
      </div>
      <h3 className={`font-serif font-bold text-base md:text-lg leading-snug mb-1 line-clamp-3 text-[var(--foreground)] ${note.isCompleted ? 'line-through opacity-40' : ''}`}>
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


const ActiveNoteEditor = React.memo(({ activeNote, updateNote, isFullscreen, isAiLoading, handleAiAction, exportAsPDF, deleteNote, setIsFullscreen, setIsTagModalOpen, setNewTagInput, relatedNotes, setActiveNoteId, setIsAIAssistantOpen, backlinks, allNotes, refreshKey, setTagToDelete, setIsTagDeleteModalOpen }: any) => {
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [localTitle, setLocalTitle] = useState(activeNote.title || '');
  const [localContent, setLocalContent] = useState(activeNote.content || '');
  const [showAllTags, setShowAllTags] = useState(false);
  const localTitleRef = useRef(activeNote.id);

  // Auto-resize title textarea
  React.useLayoutEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = 'auto';
      titleRef.current.style.height = `${titleRef.current.scrollHeight}px`;
    }
  }, [localTitle]);

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
      {!isFullscreen && (
        <div className="px-4 md:px-12 py-4 md:py-6 border-b border-[var(--border)] flex items-center justify-between bg-[var(--background)]/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-3 md:gap-6">
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
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-none animate-pulse" />
            <p className="hidden sm:block text-[10px] md:text-[11px] opacity-40 font-bold uppercase tracking-widest text-[var(--foreground)]">Sincronizado</p>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-6 h-8 overflow-x-auto no-scrollbar flex-nowrap pr-4">
          <button
            onClick={() => setIsAIAssistantOpen(true)}
            className="flex-shrink-0 flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold uppercase tracking-tighter hover:text-[#FF4F00] transition-all group text-[var(--foreground)]"
          >
            <Sparkles className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:text-[#FF4F00]" />
            <span className="whitespace-nowrap">Assistente IA</span>
          </button>
          <div className="flex-shrink-0 w-[1px] h-3 bg-[var(--border)] hidden md:block" />
          <button
            onClick={() => exportAsPDF(activeNote)}
            className="flex-shrink-0 flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold uppercase tracking-tighter hover:text-[var(--foreground)] transition-all group text-[var(--foreground)]"
          >
            <Printer className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
            <span className="whitespace-nowrap">Imprimir</span>
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex-shrink-0 flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold uppercase tracking-tighter hover:text-[var(--foreground)] transition-all group text-[var(--foreground)]"
          >
            <Maximize2 className={`w-3.5 h-3.5 ${isFullscreen ? 'text-blue-600' : 'opacity-40 group-hover:opacity-100'}`} />
            <span className="whitespace-nowrap">{isFullscreen ? 'Sair Foco' : 'Modo Foco'}</span>
          </button>
          <button
            onClick={() => deleteNote(activeNote.id)}
            className="flex-shrink-0 flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold uppercase tracking-tighter text-red-400 hover:text-red-600 transition-all group"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">Excluir</span>
          </button>
        </div>
      </div>
      )}

      {/* Floating Exit Focus Button (Top Right) - Only visible in Fullscreen */}
      {isFullscreen && (
        <div className="fixed top-6 right-8 z-[100] animate-in fade-in zoom-in duration-300">
          <button
            onClick={() => setIsFullscreen(false)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--background)]/80 backdrop-blur-md border border-[var(--border)] shadow-xl hover:bg-[var(--accent)] hover:text-white transition-all rounded-full text-[10px] font-bold uppercase tracking-widest group"
          >
            <Maximize2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            <span>Sair Foco</span>
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-12 lg:p-20 bg-[var(--muted)]/30 custom-scrollbar">
        <div className="max-w-[850px] mx-auto w-full bg-[var(--background)] shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] min-h-[1100px] border border-[var(--border)] overflow-visible">
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
              <p className="text-sm font-serif italic">
                {activeNote.updatedAt ? format(activeNote.updatedAt.toDate(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'Agora'}
              </p>
            </div>
          </div>
          <textarea
            ref={titleRef}
            rows={1}
            value={localTitle}
            placeholder="Título da nota"
            onChange={(e) => setLocalTitle(e.target.value.replace(/\n/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
              }
            }}
            className="w-full text-3xl md:text-3xl lg:text-4xl xl:text-6xl font-serif font-bold tracking-tighter leading-[1.1] bg-transparent border-none focus:outline-none mb-0 p-0 placeholder:text-[var(--foreground)]/40 text-[var(--foreground)] resize-none overflow-hidden"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4 mb-0 pb-3 border-b border-[var(--border)] mt-4 md:mt-6">
            <div className="space-y-1">
              <p className="text-[10px] opacity-40 uppercase font-bold tracking-widest">Lembrete</p>
              <input
                type="datetime-local"
                className="w-full bg-[var(--muted)] text-[var(--foreground)] px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold uppercase tracking-normal sm:tracking-wider rounded border-none focus:outline-none"
                value={activeNote.reminder ? format(activeNote.reminder.toDate(), "yyyy-MM-dd'T'HH:mm") : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    updateNote(activeNote.id, { reminder: null });
                  } else {
                    const d = new Date(val);
                    if (!isNaN(d.getTime())) {
                      updateNote(activeNote.id, { reminder: Timestamp.fromDate(d) });
                    }
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] opacity-40 uppercase font-bold tracking-widest">Vencimento</p>
              <input
                type="datetime-local"
                className="w-full bg-[var(--muted)] text-[var(--foreground)] px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold uppercase tracking-normal sm:tracking-wider rounded border-none focus:outline-none"
                value={activeNote.expiryDate ? format(activeNote.expiryDate.toDate(), "yyyy-MM-dd'T'HH:mm") : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    updateNote(activeNote.id, { expiryDate: null });
                  } else {
                    const d = new Date(val);
                    if (!isNaN(d.getTime())) {
                      updateNote(activeNote.id, { expiryDate: Timestamp.fromDate(d) });
                    }
                  }
                }}
              />
            </div>
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
                    <h4 className="text-sm font-serif italic mb-2 leading-snug group-hover:text-[var(--accent)] transition-colors line-clamp-2">{note.title || 'Sem título'}</h4>
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
                    <h4 className="text-sm font-serif italic mb-2 leading-snug group-hover:text-[var(--accent)] transition-colors line-clamp-2">{note.title || 'Sem título'}</h4>
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
  const [editorRefreshKey, setEditorRefreshKey] = useState(0);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [showAllSidebarTags, setShowAllSidebarTags] = useState(false);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [lastDeletedNote, setLastDeletedNote] = useState<Note | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');
  const [view, setView] = useState<'all' | 'favorites' | 'reminders' | 'completed'>('all');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isMobileTagsModalOpen, setIsMobileTagsModalOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [tagsToAssign, setTagsToAssign] = useState<string[]>([]);
  const [notifiedReminders, setNotifiedReminders] = useState<Set<string>>(new Set());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReminderAlertOpen, setIsReminderAlertOpen] = useState(false);
  const [currentReminderNote, setCurrentReminderNote] = useState<Note | null>(null);
  const [isTagDeleteModalOpen, setIsTagDeleteModalOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<{ noteId: string, tag: string } | null>(null);
  const [isGlobalTagDeleteModalOpen, setIsGlobalTagDeleteModalOpen] = useState(false);
  const [globalTagToDelete, setGlobalTagToDelete] = useState<string | null>(null);
  const [showTagUndoToast, setShowTagUndoToast] = useState(false);
  const [lastDeletedTag, setLastDeletedTag] = useState<{ noteId: string, tag: string, affectedNoteIds?: string[] } | null>(null);
  const [alarmType, setAlarmType] = useState<'neural' | 'crystal' | 'pulsar' | 'zen'>('neural');

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

    switch(type) {
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
        // 1. Handle regular reminders
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
            setIsReminderAlertOpen(true);
            playNeuralSound();
            
            setNotifiedReminders(prev => new Set(prev).add(note.id));
            
            // AUTOMATICALLY REMOVE REMOVED (As requested)
            updateNote(note.id, { reminder: null });
          }
        }

        // 2. Handle expiryDate - if note is expired, clear reminder to avoid zombie alerts
        if (note.expiryDate && note.reminder) {
          const expiryTime = note.expiryDate.toDate();
          if (expiryTime < now) {
            updateNote(note.id, { reminder: null });
          }
        }
      });
    };

    const interval = setInterval(checkReminders, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [notes, notifiedReminders]);



  // Initialize tagsToAssign when modal opens
  useEffect(() => {
    if (isTagModalOpen && activeNote) {
      setTagsToAssign(activeNote.tags || []);
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

  // Derived state
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    notes.forEach(note => note.tags?.forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [notes]);

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
        view === 'reminders' ? !!note.reminder : 
        view === 'completed' ? note.isCompleted : true;
      return matchesSearch && matchesTag && matchesView;
    });
  }, [notes, searchQuery, activeTag, view, isSemanticSearch, semanticKeywords]);

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

    const dateStr = note.updatedAt 
      ? format(note.updatedAt.toDate(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) 
      : 'Agora';

    // 2. Injeta o HTML. Usamos classes prose nativas para paridade 1:1 com o editor.
    printContainer.innerHTML = `
      <style>
        /* Regras de impressão estritas */
        @media print {
          @page { margin: 20mm; }
          
          /* Reseta o tamanho da tela para evitar páginas em branco no final */
          html, body {
            height: auto !important;
            min-height: auto !important;
            background: white !important;
            overflow: visible !important;
          }

          /* Esconde todo o aplicativo, mostra apenas a nota */
          body.is-printing-note > *:not(#printable-note-container) {
            display: none !important;
          }
          
          #printable-note-container {
            display: block !important;
          }

          /* FORÇA ABSOLUTA de cor preta, esmagando qualquer herança do Tailwind/Dark Mode */
          #printable-note-container,
          #printable-note-container * {
            color: #000000 !important;
          }

          /* Oculta URLs injetadas pelo Chrome no rodapé dos links */
          a[href]:after { content: none !important; }
        }
      </style>
      <div style="border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 30px;">
        <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 28pt; margin: 0 0 15px 0; font-weight: 700; line-height: 1.2; color: #000;">
          ${note.title || 'Sem título'}
        </h1>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 10pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; background: #000; color: #fff; padding: 4px 8px;">MEMÓRIA NEURAL</span>
          <span style="font-size: 11pt; font-weight: 500; color: #666;">${dateStr}</span>
        </div>
      </div>
      <!-- Classe prose garante o exato mesmo visual do editor -->
      <div class="prose prose-sm max-w-none text-black" style="color: #000;">
        ${note.content}
      </div>
    `;

    // 3. Salva o título original do site e aplica temporariamente o título da nota
    // O navegador usa o <title> do documento como o nome padrão do arquivo "Salvar como PDF"
    const originalTitle = document.title;
    document.title = note.title ? note.title.trim() : 'Nota sem título';

    // 4. Acopla ao body e ativa o modo de impressão global
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
              <h2 className="font-serif italic text-3xl tracking-tight flex items-center gap-2">
                Cérebro²
              </h2>
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
                      setView('reminders');
                      setActiveTag(null);
                    }}
                    className={`w-full flex items-center justify-between px-2 py-2 rounded-none transition-all text-sm font-medium ${view === 'reminders' ? 'bg-[var(--muted)] text-[var(--foreground)]' : 'text-[var(--foreground)] opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Bell className={`w-4 h-4 ${view === 'reminders' ? 'text-[var(--accent)]' : 'opacity-40'}`} />
                      Lembretes
                    </div>
                    <span className="text-[10px] opacity-60 font-mono">{notes.filter(n => n.reminder).length}</span>
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
                    className={`h-full transition-colors ${
                      storageUsage.percentage > 90 ? 'bg-red-500' : 
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
        ${isFullscreen ? 'hidden' : ''} 
        ${mobileView === 'editor' ? 'hidden md:flex' : 'flex'}`}
      >


        {/* Mobile Header for List View */}
        <div className="md:hidden flex items-center justify-between p-5 pb-0 bg-[var(--background)]">
          <h2 className="font-serif italic text-2xl tracking-tight text-[var(--foreground)]">Cérebro²</h2>
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
              className={`w-full bg-transparent pl-8 pr-12 py-1 outline-none text-sm font-serif italic text-base md:text-lg text-[var(--foreground)] placeholder:text-[var(--foreground)]/20 transition-all ${isSemanticSearch ? 'text-[var(--accent)]' : ''}`}
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
            />
          ))}
          {filteredNotes.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma nota encontrada</p>
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
                <h3 className="text-3xl font-serif mb-2 tracking-tight">Filtrar por Tags</h3>
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
                    className={`px-5 py-4 rounded-none text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 border-2 ${
                      activeTag === tag 
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
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-[var(--background)] rounded-none shadow-2xl p-8 max-w-sm w-full border border-[var(--border)] overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

              <div className="mb-6">
                <h3 className="text-2xl font-serif mb-2 tracking-tight text-[var(--foreground)]">Nova Etiqueta</h3>
                <p className="text-xs text-[var(--foreground)]/40 uppercase font-bold tracking-widest">Organize seu pensamento</p>
              </div>

              <div className="relative mb-6">
                <TagIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground)]/30" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Ex: Projetos, Estudo..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTagInput.trim()) {
                      const tag = newTagInput.trim();
                      if (activeNote && !activeNote.tags?.includes(tag)) {
                        updateNote(activeNote.id, { tags: [...(activeNote.tags || []), tag] });
                      }
                      setIsTagModalOpen(false);
                    }
                  }}
                  className="w-full bg-[var(--muted)] text-[var(--foreground)] rounded-none py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/10 transition-all placeholder:text-[var(--foreground)]/20"
                />
              </div>

              {/* Suggestions */}
              <div className="mb-8">
                <p className="text-[9px] text-[var(--foreground)]/40 uppercase font-bold tracking-widest mb-3">Selecione ou adicione tags</p>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                  {allTags
                    .map(tag => {
                      const isSelected = tagsToAssign.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => {
                            if (isSelected) {
                              setTagsToAssign(prev => prev.filter(t => t !== tag));
                            } else {
                              setTagsToAssign(prev => [...prev, tag]);
                            }
                          }}
                          className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest transition-all border ${isSelected ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-[var(--muted)] text-[var(--foreground)] border-transparent hover:border-black/5 hover:bg-[var(--muted)]/80'}`}
                        >
                          #{tag}
                        </button>
                      );
                    })
                  }
                  {allTags.length === 0 && (
                    <p className="text-[9px] opacity-20 italic">Crie sua primeira etiqueta acima</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsTagModalOpen(false)}
                  className="flex-1 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--foreground)]/40 hover:text-[var(--foreground)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    let finalTags = [...tagsToAssign];
                    if (newTagInput.trim()) {
                      const newTag = newTagInput.trim();
                      if (!finalTags.includes(newTag)) {
                        finalTags.push(newTag);
                      }
                    }
                    
                    if (activeNote) {
                      updateNote(activeNote.id, { tags: finalTags });
                    }
                    setIsTagModalOpen(false);
                  }}
                  className="flex-1 py-4 bg-[var(--accent)] text-[var(--accent-foreground)] rounded-none font-bold uppercase text-[10px] tracking-widest hover:opacity-90 transition-all shadow-lg shadow-black/5"
                >
                  Salvar
                </button>
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
                  <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold text-[var(--accent)]">Alerta Neural</h3>
                  <h2 className="text-2xl font-serif italic">{currentReminderNote.title || 'Pensamento Sem Título'}</h2>
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
                    <h2 className="text-3xl font-serif italic mb-2 tracking-tight">Configurações</h2>
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
                          className={`text-left p-4 border-2 transition-all group ${
                            alarmType === type.id 
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
                    <div className="flex items-center gap-3 border-l-4 border-[var(--accent)] pl-4">
                      <TagIcon className="w-5 h-5 text-[var(--accent)]" />
                      <h3 className="text-sm font-bold uppercase tracking-widest">Gerenciar Tags</h3>
                    </div>

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
                Você está prestes a remover a tag <span className="font-bold text-[var(--foreground)]">#{globalTagToDelete}</span> de <span className="font-bold text-[var(--foreground)] font-serif italic">{notes.filter(n => n.tags?.includes(globalTagToDelete)).length} notas</span>. Deseja continuar?
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

    </div>
  );
}
