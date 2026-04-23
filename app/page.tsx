'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Download,
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
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
// Removido import do SDK do Google no frontend por segurança
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), {
  ssr: false,
  loading: () => <div className="h-[60vh] w-full animate-pulse bg-black/5 rounded-none" />
});

const CommandPalette = dynamic(() => import('@/components/CommandPalette'), { ssr: false });

// Helper to strip HTML for previews
const stripHtml = (html: string) => {
  if (typeof window === 'undefined') return html;
  const doc = new Range().createContextualFragment(html);
  return doc.textContent || "";
};


const NoteCard = React.memo(({ 
  note, 
  isActive, 
  onClick 
}: { 
  note: Note, 
  isActive: boolean, 
  onClick: () => void 
}) => {
  return (
    <motion.div
      layout
      onClick={onClick}
      className={`p-6 border transition-all cursor-pointer mb-3 rounded-none ${isActive ? 'bg-[var(--muted)] border-[var(--accent)] shadow-sm' : 'border-[var(--border)] hover:border-[var(--foreground)]/10 hover:bg-[var(--muted)]/50'}`}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-tighter opacity-40 text-[var(--foreground)]">
          {note.updatedAt ? format(note.updatedAt.toDate(), 'dd MMM', { locale: ptBR }) : 'Agora'}
        </p>
        {note.isBookmarked && <Bookmark className="w-3 h-3 fill-[var(--accent)] text-[var(--accent)] opacity-30" />}
      </div>
      <h3 className="font-serif font-bold text-base md:text-lg leading-snug mb-1 line-clamp-3 text-[var(--foreground)]">{note.title || 'Sem título'}</h3>
      <p className="text-[13px] opacity-60 line-clamp-2 leading-tight text-[var(--foreground)]">
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

const TEMPLATES = [
  { id: 'meeting', label: 'Ata de Reunião', icon: '📅', content: '<h2>📅 Detalhes</h2><p><b>Data:</b> ' + new Date().toLocaleDateString('pt-BR') + '</p><p><b>Participantes:</b> </p><hr><h2>📝 Pauta</h2><ul><li></li></ul><hr><h2>✅ Decisões</h2><ul><li></li></ul><hr><h2>🚀 Próximos Passos</h2><ul><li></li></ul>' },
  { id: 'project', label: 'Plano de Projeto', icon: '🎯', content: '<h2>🎯 Objetivos</h2><p></p><hr><h2>📦 Entregáveis</h2><ul><li></li></ul><hr><h2>⏳ Cronograma</h2><ul><li>Fase 1: </li></ul>' },
  { id: 'diary', label: 'Diário', icon: '🧠', content: '<h2>🧠 Reflexões do Dia</h2><p></p><hr><h2>🙏 Gratidão</h2><ul><li></li></ul><hr><h2>📅 Para Amanhã</h2><ul><li></li></ul>' },
  { id: 'study', label: 'Estudo', icon: '📖', content: '<h2>📖 Assunto Principal</h2><p></p><hr><h2>💡 Pontos Chave</h2><ul><li></li></ul><hr><h2>❓ Dúvidas / Revisar</h2><p></p>' },
];

const ActiveNoteEditor = React.memo(({ activeNote, updateNote, isFullscreen, isAiLoading, handleAiAction, exportAsPDF, deleteNote, setIsFullscreen, setIsTagModalOpen, setNewTagInput, relatedNotes, setActiveNoteId, setIsTemplateModalOpen }: any) => {
  const [localTitle, setLocalTitle] = useState(activeNote.title || '');
  const [localContent, setLocalContent] = useState(activeNote.content || '');

  useEffect(() => {
    setLocalTitle(activeNote.title || '');
    setLocalContent(activeNote.content || '');
  }, [activeNote.id]);

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
      <div className="px-4 md:px-12 py-4 md:py-6 border-b border-[var(--border)] flex items-center justify-between bg-[var(--background)]/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-3 md:gap-6">
          <button
            onClick={() => updateNote(activeNote.id, { isBookmarked: !activeNote.isBookmarked })}
            className={`p-1.5 transition-all ${activeNote.isBookmarked ? 'bg-[var(--accent)] text-[var(--accent-foreground)] rounded-md' : 'text-[var(--foreground)]/40 hover:text-[var(--foreground)]'}`}
            title="Favoritar"
          >
            <Bookmark className={`w-3.5 h-3.5 ${activeNote.isBookmarked ? 'fill-white' : ''}`} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-none animate-pulse" />
            <p className="hidden sm:block text-[10px] md:text-[11px] opacity-40 font-bold uppercase tracking-widest text-[var(--foreground)]">Sincronizado</p>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-6 h-8 overflow-x-auto no-scrollbar flex-nowrap pr-4">
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="flex-shrink-0 flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold uppercase tracking-tighter hover:text-[var(--foreground)] transition-all group text-[var(--foreground)]"
          >
            <Layout className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
            <span className="whitespace-nowrap">Modelos</span>
          </button>
          <div className="flex-shrink-0 w-[1px] h-3 bg-[var(--border)] hidden md:block" />
          <button
            onClick={() => exportAsPDF(activeNote)}
            className="flex-shrink-0 flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold uppercase tracking-tighter hover:text-[var(--foreground)] transition-all group text-[var(--foreground)]"
          >
            <Download className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
            <span className="whitespace-nowrap">Exportar</span>
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 lg:p-12 custom-scrollbar">
        <div className="max-w-5xl mx-auto w-full">
          <div className="mb-6 md:mb-10 flex justify-between items-end border-b border-[var(--border)] pb-4 md:pb-6">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {activeNote.tags?.map((tag: string) => (
                  <span key={tag} className="px-2 py-1 bg-[var(--muted)] text-[var(--foreground)] text-[10px] font-bold uppercase tracking-widest rounded flex items-center gap-1 group">
                    #{tag}
                    <button
                      onClick={() => updateNote(activeNote.id, { tags: activeNote.tags.filter((t: string) => t !== tag) })}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </span>
                ))}
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
          <input
            type="text"
            value={localTitle}
            placeholder="Título da nota"
            onChange={(e) => setLocalTitle(e.target.value)}
            className="w-full text-3xl md:text-3xl lg:text-4xl xl:text-6xl font-serif font-bold tracking-tighter leading-none bg-transparent border-none focus:outline-none mb-6 md:mb-10 placeholder:text-[var(--foreground)]/40 text-[var(--foreground)]"
          />
          <div className="grid grid-cols-2 gap-4 md:gap-8 mb-6 md:mb-10 pb-6 md:pb-8 border-b border-[var(--border)]">
            <div className="space-y-1">
              <p className="text-[10px] opacity-40 uppercase font-bold tracking-widest">Lembrete</p>
              <input
                type="datetime-local"
                className="w-full bg-[var(--muted)] text-[var(--foreground)] px-3 py-2 text-xs font-bold uppercase tracking-wider rounded border-none focus:outline-none"
                value={activeNote.reminder ? format(activeNote.reminder.toDate(), "yyyy-MM-dd'T'HH:mm") : ''}
                onChange={(e) => updateNote(activeNote.id, { reminder: e.target.value ? Timestamp.fromDate(new Date(e.target.value)) : null })}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] opacity-40 uppercase font-bold tracking-widest">Vencimento</p>
              <input
                type="date"
                className="w-full bg-[var(--muted)] text-[var(--foreground)] px-3 py-2 text-xs font-bold uppercase tracking-wider rounded border-none focus:outline-none"
                value={activeNote.expiryDate ? format(activeNote.expiryDate.toDate(), 'yyyy-MM-dd') : ''}
                onChange={(e) => updateNote(activeNote.id, { expiryDate: e.target.value ? Timestamp.fromDate(new Date(e.target.value)) : null })}
              />
            </div>
          </div>
          <RichTextEditor
            content={localContent}
            onChange={(html: string) => setLocalContent(html)}
            isFocusMode={isFullscreen}
          />

          {/* Related Notes (AI Auto-Linker) */}
          {relatedNotes && relatedNotes.length > 0 && (
            <div className="mt-20 pt-10 border-t border-[var(--border)] pb-20">
              <div className="flex items-center gap-3 mb-8">
                <Brain className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--foreground)] opacity-40">Conexões Sugeridas pela IA</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedNotes.map((note: any) => (
                  <button
                    key={note.id}
                    onClick={() => setActiveNoteId(note.id)}
                    className="group relative p-6 bg-[var(--muted)]/20 border border-[var(--border)] hover:border-[var(--accent)] transition-all text-left"
                  >
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="w-3 h-3 text-[var(--accent)]" />
                    </div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--foreground)] opacity-20 mb-3">Nota Relacionada</p>
                    <h4 className="text-sm font-serif italic mb-4 leading-snug group-hover:text-[var(--accent)] transition-colors">{note.title || 'Sem título'}</h4>
                    <div className="flex flex-wrap gap-1.5">
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [lastDeletedNote, setLastDeletedNote] = useState<Note | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');
  const [view, setView] = useState<'all' | 'favorites'>('all');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isMobileTagsModalOpen, setIsMobileTagsModalOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  // Sidebar responsiveness
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

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

      if (u && "Notification" in window) {
        Notification.requestPermission();
      }
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
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Note[];
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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
      const matchesView = view === 'favorites' ? note.isBookmarked : true;
      return matchesSearch && matchesTag && matchesView;
    });
  }, [notes, searchQuery, activeTag, view, isSemanticSearch, semanticKeywords]);

  const activeNote = useMemo(() => notes.find(n => n.id === activeNoteId), [notes, activeNoteId]);

  const relatedNotes = useMemo(() => {
    if (!activeNote || !activeNote.tags?.length) return [];

    return notes
      .filter(n => n.id !== activeNote.id)
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

  const updateNote = async (id: string, updates: Partial<Note>) => {
    const noteRef = doc(db, 'notes', id);
    await updateDoc(noteRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
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
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text(note.title, 20, 20);
    doc.setFontSize(12);
    const splitContent = doc.splitTextToSize(note.content, 170);
    doc.text(splitContent, 20, 40);
    doc.save(`${note.title}.pdf`);
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
      {/* SIDEBAR - Hidden on mobile by default, toggled via menu */}
      <AnimatePresence>
        {isSidebarOpen && !isFullscreen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className={`w-64 border-r border-[var(--border)] bg-[var(--sidebar-bg)] hidden md:flex flex-col z-30 p-8 
              ${isFullscreen ? 'hidden' : ''} 
              relative h-full`}
          >
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
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-2 hover:bg-muted rounded-none"
              >
                <ArrowLeft className="w-4 h-4" />
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
                    <span className="text-[10px] opacity-40 font-mono">{notes.length}</span>
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
                    <span className="text-[10px] opacity-40 font-mono">{notes.filter(n => n.isBookmarked).length}</span>
                  </button>
                </div>
                <button
                  className="block w-full text-left text-sm font-medium transition-all hover:italic hover:pl-2 text-[var(--foreground)] flex items-center gap-2"
                >
                  <Bell className="w-4 h-4 opacity-40" />
                  Lembretes
                </button>
                <Link
                  href="/dashboard"
                  className="block w-full text-left text-sm font-medium transition-all hover:italic hover:pl-2 text-accent flex items-center gap-2"
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
                    allTags.map(tag => (
                      <TagButton
                        key={tag}
                        tag={tag}
                        isActive={activeTag === tag}
                        onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                      />
                    ))
                  )}
                </div>
              </div>
            </nav>

            <div className="pt-8 border-t border-[var(--border)]">
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
                  onClick={logOut}
                  className="p-2 hover:bg-[var(--muted)] text-[var(--foreground)] rounded-none transition-colors"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile Overlay for Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && !isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* NOTE LIST - Hidden on mobile if editor is open */}
      <section className={`w-full md:w-80 border-r border-[var(--border)] bg-[var(--background)] flex flex-col relative z-10 
        ${isFullscreen ? 'hidden' : ''} 
        ${mobileView === 'editor' ? 'hidden md:flex' : 'flex'}`}
      >
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="hidden md:block absolute -left-3 top-6 bg-[var(--background)] border border-[var(--border)] rounded-none p-1.5 shadow-sm hover:scale-110 transition-all text-[var(--foreground)]"
          >
            <Plus className="w-3 h-3 rotate-45" />
          </button>
        )}

        {/* Mobile Header for List View */}
        <div className="md:hidden flex items-center justify-between p-5 pb-0 bg-[var(--background)]">
          <h2 className="font-serif italic text-2xl tracking-tight text-[var(--foreground)]">Cérebro²</h2>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsCommandPaletteOpen(true)}
              className="p-2 bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 shadow-[2px_2px_0px_rgba(0,0,0,0.05)] transition-all active:scale-95"
              title="Terminal Neural"
            >
              <Command className="w-4 h-4" />
            </button>
            <button 
              onClick={toggleTheme}
              className="p-2 hover:bg-[var(--muted)] text-[var(--foreground)]/60 transition-colors"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button 
              onClick={logOut}
              className="p-2 hover:bg-[var(--muted)] text-[var(--foreground)]/60 transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
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
                onClick={() => setIsCommandPaletteOpen(true)}
                className="p-2 bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 active:scale-95 transition-all"
                title="Terminal Neural"
              >
                <Command className="w-4 h-4" />
              </button>
              <button 
                onClick={toggleTheme}
                className="p-2 hover:bg-[var(--muted)] text-[var(--foreground)]/60 transition-colors"
              >
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>
              <button 
                onClick={logOut}
                className="p-2 hover:bg-[var(--muted)] text-[var(--foreground)]/60 transition-colors"
              >
                <LogOut className="w-4 h-4" />
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
              setIsTemplateModalOpen={setIsTemplateModalOpen}
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
          <div className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-[var(--background)]/80 backdrop-blur-xl border-t border-[var(--border)] flex items-center justify-around z-40 px-6 pb-2">
            <button 
              onClick={() => { setView('all'); setMobileView('list'); setActiveTag(null); }}
              className={`flex flex-col items-center gap-1 transition-all ${view === 'all' && !activeTag ? 'text-[var(--foreground)] scale-105' : 'text-[var(--foreground)]/30'}`}
              title="Notas"
            >
              <FileText className={`w-4.5 h-4.5 ${view === 'all' && !activeTag ? 'opacity-100' : 'opacity-40'}`} />
              <span className="text-[8px] font-bold uppercase tracking-widest">Notas</span>
            </button>
            
            <button 
              onClick={() => { setView('favorites'); setMobileView('list'); setActiveTag(null); }}
              className={`flex flex-col items-center gap-1 transition-all ${view === 'favorites' ? 'text-[var(--foreground)] scale-105' : 'text-[var(--foreground)]/30'}`}
              title="Favoritos"
            >
              <Star className={`w-4.5 h-4.5 ${view === 'favorites' ? 'fill-current opacity-100' : 'opacity-40'}`} />
              <span className="text-[8px] font-bold uppercase tracking-widest">Favoritos</span>
            </button>

            <div className="w-10"></div> {/* Center space for FAB */}

            <Link 
              href="/dashboard"
              className="flex flex-col items-center gap-1 text-[var(--foreground)]/30 hover:text-[var(--foreground)] transition-all"
              title="Dashboard Neural"
            >
              <Brain className="w-4.5 h-4.5 opacity-40" />
              <span className="text-[8px] font-bold uppercase tracking-widest">Dash</span>
            </Link>

            <button 
              onClick={() => setIsMobileTagsModalOpen(true)}
              className={`flex flex-col items-center gap-1 transition-all ${activeTag ? 'text-[var(--foreground)] scale-105' : 'text-[var(--foreground)]/30'}`}
              title="Tags"
            >
              <TagIcon className={`w-4.5 h-4.5 ${activeTag ? 'opacity-100' : 'opacity-40'}`} />
              <span className="text-[8px] font-bold uppercase tracking-widest">{activeTag ? `#${activeTag}` : 'Tags'}</span>
            </button>
          </div>

          {/* FLOATING ACTION BUTTON (FAB) */}
          <motion.button 
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            initial={{ scale: 0, y: 100 }}
            animate={{ scale: 1, y: 0 }}
            onClick={createNewNote}
            className="md:hidden fixed bottom-10 left-1/2 -translate-x-1/2 w-14 h-14 bg-[var(--accent)] text-[var(--accent-foreground)] rounded-none shadow-[4px_4px_0px_rgba(0,0,0,0.1)] flex items-center justify-center z-50 border border-black/5 group"
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
                    className={`px-4 py-3 rounded-none text-xs font-bold uppercase tracking-widest transition-all ${activeTag === tag ? 'bg-[var(--accent)] text-[var(--accent-foreground)] shadow-lg' : 'bg-[var(--muted)] text-[var(--foreground)]'}`}
                  >
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
                <p className="text-[9px] text-[var(--foreground)]/40 uppercase font-bold tracking-widest mb-3">Sugeridas ou Existentes</p>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                  {allTags
                    .filter(tag => !activeNote?.tags?.includes(tag))
                    .map(tag => (
                      <button
                        key={tag}
                        onClick={() => {
                          if (activeNote) {
                            updateNote(activeNote.id, { tags: [...(activeNote.tags || []), tag] });
                            setIsTagModalOpen(false);
                          }
                        }}
                        className="px-2 py-1 bg-[var(--muted)] hover:bg-[var(--accent)] hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all border border-transparent hover:border-black/5"
                      >
                        #{tag}
                      </button>
                    ))
                  }
                  {allTags.filter(tag => !activeNote?.tags?.includes(tag)).length === 0 && (
                    <p className="text-[9px] opacity-20 italic">Nenhuma tag nova para sugerir</p>
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
                    if (newTagInput.trim()) {
                      const tag = newTagInput.trim();
                      if (activeNote && !activeNote.tags?.includes(tag)) {
                        updateNote(activeNote.id, { tags: [...(activeNote.tags || []), tag] });
                      }
                    }
                    setIsTagModalOpen(false);
                  }}
                  className="flex-1 py-4 bg-[var(--accent)] text-[var(--accent-foreground)] rounded-none font-bold uppercase text-[10px] tracking-widest hover:opacity-90 transition-all shadow-lg shadow-black/5"
                >
                  Adicionar
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

      {/* TEMPLATE SELECTOR MODAL */}
      <AnimatePresence>
        {isTemplateModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsTemplateModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-2xl bg-[var(--background)] border border-[var(--border)] p-10 shadow-[30px_30px_0px_rgba(0,0,0,0.1)]"
            >
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h2 className="text-2xl font-serif italic mb-1">Escolher Modelo</h2>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">Estruture seu pensamento</p>
                </div>
                <button onClick={() => setIsTemplateModalOpen(false)} className="opacity-40 hover:opacity-100 transition-opacity text-2xl">×</button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (activeNote) {
                        const newContent = t.content + (activeNote.content ? '<hr>' + activeNote.content : '');
                        const newTitle = t.label + ': ' + (activeNote.title === 'Nova Nota' ? '' : activeNote.title);
                        updateNote(activeNote.id, { content: newContent, title: newTitle });
                        setIsTemplateModalOpen(false);
                      }
                    }}
                    className="p-6 border border-[var(--border)] bg-[var(--muted)]/20 hover:bg-[var(--accent)]/5 hover:border-[var(--accent)] transition-all text-left group"
                  >
                    <div className="text-3xl mb-4 group-hover:scale-110 transition-transform origin-left">{t.icon}</div>
                    <h4 className="text-sm font-bold uppercase tracking-widest mb-2 group-hover:text-[var(--accent)] transition-colors">{t.label}</h4>
                    <p className="text-[10px] opacity-40 leading-relaxed">Clique para aplicar este formato à sua nota atual.</p>
                  </button>
                ))}
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
    </div>
  );
}
