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
  Filter,
  Bookmark,
  Sun,
  Moon
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
// Removido import do SDK do Google no frontend por segurança
import dynamic from 'next/dynamic';
import Image from 'next/image';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { 
  ssr: false,
  loading: () => <div className="h-[60vh] w-full animate-pulse bg-black/5 rounded-xl" />
});

// Helper to strip HTML for previews
const stripHtml = (html: string) => {
  if (typeof window === 'undefined') return html;
  const doc = new Range().createContextualFragment(html);
  return doc.textContent || "";
};

// --- COMPONENTS ---

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');
  const [view, setView] = useState<'all' | 'favorites'>('all');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');


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
  
  // Local state for editing to avoid "jumping" when typing
  const [localTitle, setLocalTitle] = useState('');
  const [localContent, setLocalContent] = useState('');

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

  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      const matchesSearch = 
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = activeTag ? note.tags?.includes(activeTag) : true;
      const matchesView = view === 'favorites' ? note.isBookmarked : true;
      return matchesSearch && matchesTag && matchesView;
    });
  }, [notes, searchQuery, activeTag, view]);

  const activeNote = notes.find(n => n.id === activeNoteId);

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

  // Sync local state when active note changes
  useEffect(() => {
    if (activeNote) {
      setLocalTitle(activeNote.title);
      setLocalContent(activeNote.content);
    } else {
      setLocalTitle('');
      setLocalContent('');
    }
  }, [activeNoteId]);

  // Debounced update for Title
  useEffect(() => {
    if (!activeNote || localTitle === activeNote.title) return;
    
    const timeout = setTimeout(() => {
      updateNote(activeNote.id, { title: localTitle });
    }, 1000);

    return () => clearTimeout(timeout);
  }, [localTitle]);

  // Debounced update for Content (only if not from editor)
  // Actually, RichTextEditor should handle its own content
  useEffect(() => {
    if (!activeNote || localContent === activeNote.content) return;
    
    const timeout = setTimeout(() => {
      updateNote(activeNote.id, { content: localContent });
    }, 1000);

    return () => clearTimeout(timeout);
  }, [localContent]);

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

  const deleteNote = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta nota?')) {
      await deleteDoc(doc(db, 'notes', id));
      if (activeNoteId === id) setActiveNoteId(null);
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
    const file = new Blob([note.content], {type: 'text/plain'});
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
            className="w-full bg-[#1a1a1a] text-white py-4 px-6 rounded-2xl font-medium hover:bg-black transition-all flex items-center justify-center gap-2 group shadow-xl"
          >
            Começar com Google
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen overflow-hidden bg-[var(--background)] ${isFullscreen ? 'p-0' : ''}`}>
      {/* SIDEBAR - Hidden on mobile if editor is open */}
      <AnimatePresence>
        {isSidebarOpen && !isFullscreen && (
          <motion.aside 
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className={`w-64 border-r border-[var(--border)] bg-[var(--sidebar-bg)] flex flex-col z-20 p-8 ${mobileView === 'editor' ? 'hidden md:flex' : 'flex'}`}
          >
            <div className="mb-10 flex items-center justify-between">
              <h2 className="font-serif italic text-3xl tracking-tight flex items-center gap-2">
                Cérebro²
              </h2>
              <button 
                onClick={toggleTheme}
                className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors text-[var(--foreground)] opacity-60 hover:opacity-100"
                title="Trocar Tema"
              >
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-2 hover:bg-muted rounded-lg"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-10">
               <button 
                onClick={createNewNote}
                className="w-full bg-[#1a1a1a] dark:bg-white text-white dark:text-black py-4 px-4 text-xs font-bold uppercase tracking-widest hover:bg-black/80 transition-colors"
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
                    className={`w-full flex items-center justify-between px-2 py-2 rounded-lg transition-all text-sm font-medium ${view === 'all' && !activeTag ? 'bg-[var(--muted)] text-[var(--foreground)]' : 'text-[var(--foreground)] opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`}
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
                    className={`w-full flex items-center justify-between px-2 py-2 rounded-lg transition-all text-sm font-medium ${view === 'favorites' ? 'bg-[var(--muted)] text-[var(--foreground)]' : 'text-[var(--foreground)] opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'}`}
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
                <a 
                  href="/dashboard"
                  className="block w-full text-left text-sm font-medium transition-all hover:italic hover:pl-2 text-accent flex items-center gap-2"
                >
                  <Layers className="w-4 h-4 opacity-40" />
                  Dashboard Neural
                </a>
              </div>

              <div className="">
                <p className="text-[10px] uppercase tracking-widest text-[var(--foreground)]/40 font-bold mb-4">Etiquetas</p>
                <div className="flex flex-wrap gap-2">
                  {allTags.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Nenhuma tag ainda</p>
                  ) : (
                    allTags.map(tag => (
                      <button 
                        key={tag}
                        onClick={() => setActiveTag(tag === activeTag ? null : tag)}
                        className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${activeTag === tag ? 'bg-[var(--accent)] text-[var(--accent-foreground)]' : 'bg-[var(--muted)] hover:bg-black/10 dark:hover:bg-white/10 text-[var(--foreground)]'}`}
                      >
                        #{tag}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </nav>

            <div className="pt-8 border-t border-[var(--border)]">
              <div className="flex items-center gap-2 text-green-600 mb-6">
                <div className="w-2 h-2 rounded-full bg-current animate-pulse"></div>
                <span className="text-[11px] font-bold uppercase tracking-wider">Sincronizado</span>
              </div>
              <div className="flex items-center gap-3">
                <Image 
                  src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} 
                  width={32}
                  height={32}
                  className="rounded-full border border-border"
                  alt="Avatar"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold truncate uppercase tracking-widest">{user.displayName || 'Usuário'}</p>
                </div>
                <button 
                  onClick={logOut}
                  className="p-2 hover:bg-[var(--muted)] text-[var(--foreground)] rounded-lg transition-colors"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.aside>
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
            className="absolute -left-3 top-6 bg-[var(--background)] border border-[var(--border)] rounded-full p-1.5 shadow-sm hover:scale-110 transition-all text-[var(--foreground)]"
          >
            <Plus className="w-3 h-3 rotate-45" />
          </button>
        )}
        
        <div className="p-8">
          <div className="relative mb-6">
            <SearchIcon className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
            <input 
              type="text" 
              placeholder="Buscar no cérebro..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent pl-8 pr-4 py-2 outline-none text-sm font-serif italic text-lg text-[var(--foreground)] placeholder:text-[var(--foreground)]/20"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] opacity-40 font-bold uppercase tracking-widest">
            <span>{filteredNotes.length} Notas</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 custom-scrollbar space-y-4">
          {filteredNotes.map(note => (
            <motion.div 
              layout
              key={note.id}
              onClick={() => {
                setActiveNoteId(note.id);
                setMobileView('editor');
              }}
              className={`p-6 border-l-2 transition-all cursor-pointer ${activeNoteId === note.id ? 'bg-[var(--muted)] border-[var(--accent)]' : 'border-transparent hover:bg-[var(--muted)]/50'}`}
            >
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-tighter opacity-40 text-[var(--foreground)]">
                  {note.updatedAt ? format(note.updatedAt.toDate(), 'dd MMM', { locale: ptBR }) : 'Agora'}
                </p>
                {note.isBookmarked && <Bookmark className="w-3 h-3 fill-[var(--accent)] text-[var(--accent)] opacity-30" />}
              </div>
              <h3 className="font-serif text-lg leading-tight mb-2 line-clamp-2 text-[var(--foreground)]">{note.title || 'Sem título'}</h3>
              <p className="text-xs opacity-60 line-clamp-2 leading-relaxed text-[var(--foreground)]">
                {stripHtml(note.content) || 'Sem conteúdo...'}
              </p>
            </motion.div>
          ))}
          {filteredNotes.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma nota encontrada</p>
            </div>
          )}
        </div>
      </section>

      {/* EDITOR - Full screen or mobile controlled */}
      <main className={`flex-1 bg-[var(--background)] flex flex-col overflow-hidden relative ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--background)]">
           <button onClick={() => setMobileView('list')} className="flex items-center gap-1 text-sm font-bold uppercase text-[var(--foreground)]">
             <ArrowLeft className="w-4 h-4" /> Voltar
           </button>
           <span className="font-serif italic text-[var(--foreground)]">Editando</span>
        </div>
        <AnimatePresence mode="wait">
          {activeNote ? (
            <motion.div 
              key={activeNote.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col h-full overflow-hidden"
            >
              {/* Toolbar */}
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
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <p className="hidden sm:block text-[10px] md:text-[11px] opacity-40 font-bold uppercase tracking-widest text-[var(--foreground)]">Sincronizado</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 md:gap-6 h-8 overflow-x-auto no-scrollbar flex-nowrap pr-4">
                  <button 
                    onClick={() => handleAiAction(activeNote)}
                    disabled={isAiLoading}
                    className="flex-shrink-0 flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold uppercase tracking-tighter hover:text-[var(--foreground)] transition-all group text-[var(--foreground)]"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-pulse text-blue-500' : 'text-blue-400 group-hover:text-blue-600'}`} />
                    <span className="whitespace-nowrap">{isAiLoading ? 'Pensando...' : 'Assistente IA'}</span>
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

              {/* Editor Content */}
              <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                <div className="max-w-5xl mx-auto w-full">
                  <div className="mb-10 flex justify-between items-end border-b border-[var(--border)] pb-6">
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {activeNote.tags?.map(tag => (
                          <span key={tag} className="px-2 py-1 bg-[var(--muted)] text-[var(--foreground)] text-[10px] font-bold uppercase tracking-widest rounded flex items-center gap-1 group">
                            #{tag}
                            <button 
                              onClick={() => updateNote(activeNote.id, { tags: activeNote.tags.filter(t => t !== tag) })}
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
                    className="w-full text-6xl font-serif tracking-tighter leading-none bg-transparent border-none focus:outline-none mb-10 placeholder:text-[var(--foreground)]/40 text-[var(--foreground)]"
                  />

                  <div className="grid grid-cols-2 gap-8 mb-10 pb-8 border-b border-[var(--border)]">
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
                    onChange={(html) => setLocalContent(html)}
                  />

                  {/* Related Notes Footer */}
                  {relatedNotes.length > 0 && (
                    <div className="mt-20 pt-12 border-t border-[var(--border)] pb-20">
                      <div className="flex items-center gap-3 mb-8">
                        <div className="w-8 h-[1px] bg-[var(--accent)]"></div>
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">Pensamentos Conectados</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {relatedNotes.map(note => (
                          <motion.div 
                            key={note.id}
                            whileHover={{ y: -5 }}
                            onClick={() => {
                              setActiveNoteId(note.id);
                              // Scroll to top of editor when switching related notes
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="p-5 rounded-2xl bg-[var(--muted)]/30 border border-[var(--border)] cursor-pointer hover:bg-[var(--muted)]/50 transition-all group"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <Brain className="w-3.5 h-3.5 opacity-20 group-hover:text-[var(--accent)] group-hover:opacity-100 transition-all" />
                              <div className="flex flex-wrap justify-end gap-1">
                                {note.tags?.filter(t => activeNote.tags?.includes(t)).slice(0, 2).map(t => (
                                  <span key={t} className="text-[8px] font-bold uppercase text-[var(--accent)] tracking-tighter">#{t}</span>
                                ))}
                              </div>
                            </div>
                            <h5 className="font-serif italic text-lg leading-tight mb-2 line-clamp-1 text-[var(--foreground)]">{note.title || 'Sem título'}</h5>
                            <p className="text-[10px] opacity-40 line-clamp-2 leading-relaxed text-[var(--foreground)]">
                              {stripHtml(note.content) || 'Sem conteúdo...'}
                            </p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
               <div className="bg-muted w-24 h-24 rounded-full flex items-center justify-center mb-6">
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
              className="relative bg-[var(--background)] rounded-2xl shadow-2xl p-8 max-w-sm w-full border border-[var(--border)] overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
              
              <div className="mb-6">
                <h3 className="text-2xl font-serif mb-2 tracking-tight text-[var(--foreground)]">Nova Etiqueta</h3>
                <p className="text-xs text-[var(--foreground)]/40 uppercase font-bold tracking-widest">Organize seu pensamento</p>
              </div>

              <div className="relative mb-8">
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
                  className="w-full bg-[var(--muted)] text-[var(--foreground)] rounded-xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/10 transition-all placeholder:text-[var(--foreground)]/20"
                />
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
                  className="flex-1 py-4 bg-[var(--accent)] text-[var(--accent-foreground)] rounded-xl font-bold uppercase text-[10px] tracking-widest hover:opacity-90 transition-all shadow-lg shadow-black/5"
                >
                  Adicionar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
