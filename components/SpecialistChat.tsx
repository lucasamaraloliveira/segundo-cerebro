'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Note } from '@/lib/types';
import { db, auth } from '@/lib/firebase';
import { doc, updateDoc, collection, query, where, onSnapshot, setDoc, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { X, Send, Brain, Loader2, Info, ChevronDown, ChevronUp, Paperclip, Copy, Check, History, ArrowLeft, ArrowRight, Plus, Trash2, Link2, Globe, Sparkles, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { extractImagesFromHtml } from '@/lib/image-utils';
import { computeNoteNumbersMap } from '@/lib/note-utils';

// Helper to resolve display title for a note (including image-only notes)
function getNoteDisplayTitle(note: Partial<Note>): string {
  if (note.title && note.title.trim()) return note.title.trim();
  const content = note.content || '';
  const imgMatch = content.match(/<img[^>]*alt=["']([^"']+)["'][^>]*>/i);
  if (imgMatch && imgMatch[1]?.trim() && imgMatch[1].trim().toLowerCase() !== 'image') {
    return `🖼️ ${imgMatch[1].trim()}`;
  }
  if (/<img\b/i.test(content)) return '🖼️ [Imagem Capturada]';
  return 'Sem título';
}

// Helper to parse user message and extract attachment and @mentioned notes metadata if present
function parseUserMessage(rawContent: string): {
  attachmentName: string | null;
  mentionedNoteTitles: string[];
  cleanContent: string;
} {
  if (!rawContent) return { attachmentName: null, mentionedNoteTitles: [], cleanContent: '' };

  let text = rawContent;
  let attachmentName: string | null = null;
  let mentionedNoteTitles: string[] = [];

  // Extract "📎 [Anexo: nome_do_arquivo.ext]" if present
  const matchBracket = text.match(/^📎\s*\[Anexo:\s*(.*?)\](?:\r?\n)*([\s\S]*)$/);
  if (matchBracket) {
    attachmentName = matchBracket[1].trim();
    text = matchBracket[2] || '';
  } else {
    const matchAttached = text.match(/^📎\s*Anexou arquivo:\s*(.*?)$/);
    if (matchAttached) {
      return {
        attachmentName: matchAttached[1].trim(),
        mentionedNoteTitles: [],
        cleanContent: '',
      };
    }
  }

  // Extract "📌 [Notas: Título 1 | Título 2]" if present
  const matchMentioned = text.match(/^📌\s*\[Notas:\s*(.*?)\](?:\r?\n)*([\s\S]*)$/);
  if (matchMentioned) {
    mentionedNoteTitles = matchMentioned[1]
      .split('|')
      .map((t) => t.trim())
      .filter(Boolean);
    text = matchMentioned[2] || '';
  }

  return {
    attachmentName,
    mentionedNoteTitles,
    cleanContent: text.trim(),
  };
}

// Subcomponente otimizado para exibir notas referenciadas com visualização colapsável
// Subcomponente discreto e compacto para exibir notas referenciadas
const MessageSources = ({ sources }: { sources: Array<{ id: string; title: string }> }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  const visibleSources = isExpanded ? sources : sources.slice(0, 3);
  const remainingCount = sources.length - 3;

  const handleOpenNote = (noteId: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-note-by-id', { detail: noteId }));
    }
  };

  return (
    <div className="mt-2.5 pt-2 border-t border-[var(--border)]/50">
      <div className="flex flex-wrap items-center gap-1.5 text-[9px]">
        <span className="text-[var(--foreground)]/40 font-mono font-medium flex items-center gap-1 mr-0.5 select-none">
          <FileText className="w-2.5 h-2.5 opacity-60" />
          Fontes:
        </span>

        {visibleSources.map((s, idx) => (
          <button
            type="button"
            key={`${s.id}-${idx}`}
            onClick={() => handleOpenNote(s.id)}
            title={`Abrir "${s.title || 'Sem título'}"`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-black/[0.04] dark:bg-white/[0.06] hover:bg-[#FF4F00]/10 hover:text-[#FF4F00] hover:border-[#FF4F00]/40 border border-black/5 dark:border-white/10 text-[9px] text-[var(--foreground)]/70 transition-colors cursor-pointer truncate max-w-[130px] sm:max-w-[170px]"
          >
            <span className="truncate">{s.title || 'Sem título'}</span>
          </button>
        ))}

        {sources.length > 3 && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[9px] font-mono font-semibold text-[#FF4F00] hover:underline px-1 py-0.5 transition-colors cursor-pointer"
          >
            {isExpanded ? 'Recolher' : `+${remainingCount} mais`}
          </button>
        )}
      </div>

      {isExpanded && sources.length > 3 && (
        <p className="mt-1 text-[8px] font-mono text-[var(--foreground)]/30">
          {sources.length} notas referenciadas nesta resposta
        </p>
      )}
    </div>
  );
};

export default function SpecialistChat() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [size, setSize] = useState({ width: 380, height: 480 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDir, setResizeDir] = useState<string | null>(null);

  // History State
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'chat' | 'history' | 'history-detail'>('chat');
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [historyNoteId, setHistoryNoteId] = useState<string | null>(null);

  // Delete & Undo States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [sessionToDelete, setSessionToDelete] = useState<any | null>(null);
  const [isUndoVisible, setIsUndoVisible] = useState<boolean>(false);
  const [deletedSessionBuffer, setDeletedSessionBuffer] = useState<any | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Pending attachment for multimodal chat
  const [pendingFile, setPendingFile] = useState<{
    data: string;
    mimeType: string;
    name: string;
  } | null>(null);

  // Pending external links for cross-referencing
  const [pendingUrls, setPendingUrls] = useState<string[]>([]);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState<boolean>(false);
  const [newUrlInput, setNewUrlInput] = useState<string>('');

  // @ Mention state for anchoring specific notes
  const [mentionedNotes, setMentionedNotes] = useState<Note[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState<number>(0);

  const noteNumbersMap = React.useMemo(() => computeNoteNumbersMap(notes), [notes]);

  const formatNoteWithId = (note: Partial<Note>) => {
    const num = note.id ? noteNumbersMap.get(note.id) : undefined;
    const title = getNoteDisplayTitle(note);
    return num !== undefined ? `#${num} ${title}` : title;
  };

  const normalizeSearch = (str: string) =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const mentionSuggestions = React.useMemo(() => {
    if (mentionQuery === null) return [];
    const normQuery = normalizeSearch(mentionQuery.trim());
    const cleanIdQuery = normQuery.replace(/^#+/, '').trim();
    const available = notes.filter(
      (n) =>
        n.title !== '__neural_chat_history__' &&
        !mentionedNotes.some((m) => m.id === n.id)
    );
    if (!normQuery) {
      return [...available]
        .sort((a, b) => (noteNumbersMap.get(a.id) ?? 0) - (noteNumbersMap.get(b.id) ?? 0))
        .slice(0, 8);
    }

    const matches = available.filter((n) => {
      const noteNum = noteNumbersMap.get(n.id);
      const numStr = noteNum !== undefined ? String(noteNum) : '';
      const idMatch = cleanIdQuery !== '' && (numStr === cleanIdQuery || numStr.startsWith(cleanIdQuery));
      const displayTitle = normalizeSearch(getNoteDisplayTitle(n));
      const tagsMatch = (n.tags || []).some((t) =>
        normalizeSearch(t).includes(normQuery)
      );
      return idMatch || displayTitle.includes(normQuery) || tagsMatch;
    });

    return matches
      .sort((a, b) => {
        const aNumStr = String(noteNumbersMap.get(a.id) ?? '');
        const bNumStr = String(noteNumbersMap.get(b.id) ?? '');
        const aExact = cleanIdQuery !== '' && aNumStr === cleanIdQuery ? 2 : (cleanIdQuery !== '' && aNumStr.startsWith(cleanIdQuery) ? 1 : 0);
        const bExact = cleanIdQuery !== '' && bNumStr === cleanIdQuery ? 2 : (cleanIdQuery !== '' && bNumStr.startsWith(cleanIdQuery) ? 1 : 0);
        if (aExact !== bExact) return bExact - aExact;
        return (noteNumbersMap.get(a.id) ?? 0) - (noteNumbersMap.get(b.id) ?? 0);
      })
      .slice(0, 8);
  }, [mentionQuery, notes, mentionedNotes, noteNumbersMap]);

  const updateMentionTriggerFromCursor = (text: string, cursorPos: number) => {
    const textBeforeCursor = text.slice(0, cursorPos);
    const match = textBeforeCursor.match(/(?:^|[\s\n])@([^\n@]*)$/);
    if (match) {
      const atIndex = textBeforeCursor.lastIndexOf('@');
      const searchStr = textBeforeCursor.slice(atIndex + 1);
      setMentionStartIndex(atIndex);
      setMentionQuery(searchStr);
      setMentionSelectedIndex(0);
    } else {
      setMentionQuery(null);
      setMentionStartIndex(null);
    }
  };

  const handleSelectMention = (note: Note) => {
    setMentionedNotes((prev) =>
      prev.some((n) => n.id === note.id) ? prev : [...prev, note]
    );

    if (mentionStartIndex !== null) {
      const cursorPos = textareaRef.current?.selectionStart ?? queryText.length;
      const before = queryText.slice(0, mentionStartIndex);
      const after = queryText.slice(cursorPos);
      // Clean up extra space if before ends with space and after starts with space or is empty
      const nextText =
        after.length === 0
          ? before.replace(/\s+$/, (m) => (m.includes('\n') ? '\n' : ''))
          : before.endsWith(' ') && after.startsWith(' ')
            ? before + after.slice(1)
            : before + after;

      setQueryText(nextText);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newCursor = Math.min(before.length, nextText.length);
          textareaRef.current.setSelectionRange(newCursor, newCursor);
        }
      }, 0);
    }

    setMentionQuery(null);
    setMentionStartIndex(null);
    setMentionSelectedIndex(0);
  };

  const handleOpenNoteByIdOrTitle = (noteId?: string, noteTitle?: string) => {
    if (typeof window === 'undefined') return;
    if (noteId) {
      window.dispatchEvent(new CustomEvent('open-note-by-id', { detail: noteId }));
      return;
    }
    if (noteTitle) {
      const numPrefixMatch = noteTitle.match(/^#(\d+)\b/);
      const matched = notes.find((n) => {
        if (formatNoteWithId(n).toLowerCase() === noteTitle.toLowerCase()) return true;
        if (getNoteDisplayTitle(n).toLowerCase() === noteTitle.toLowerCase()) return true;
        if (numPrefixMatch && noteNumbersMap.get(n.id) === Number(numPrefixMatch[1])) return true;
        return false;
      });
      if (matched) {
        window.dispatchEvent(new CustomEvent('open-note-by-id', { detail: matched.id }));
      }
    }
  };

  // Active note tracking from main editor
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if ((window as any).__activeNoteId) {
        setActiveNoteId((window as any).__activeNoteId);
      }
      const handleActiveNote = (e: any) => {
        if (e.detail?.noteId) {
          setActiveNoteId(e.detail.noteId);
        }
      };
      window.addEventListener('active-note-changed', handleActiveNote);
      return () => window.removeEventListener('active-note-changed', handleActiveNote);
    }
  }, []);

  // Resize handler
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (resizeDir === 'top') {
        const newHeight = window.innerHeight - e.clientY - 96; // 96 is bottom-24
        if (newHeight > 300 && newHeight < 800) setSize(prev => ({ ...prev, height: newHeight }));
      } else if (resizeDir === 'left') {
        const newWidth = window.innerWidth - e.clientX - 32; // 32 is right-8
        if (newWidth > 300 && newWidth < 800) setSize(prev => ({ ...prev, width: newWidth }));
      } else if (resizeDir === 'both') {
        const newHeight = window.innerHeight - e.clientY - 96;
        const newWidth = window.innerWidth - e.clientX - 32;
        if (newHeight > 300 && newHeight < 800) setSize(prev => ({ ...prev, height: newHeight }));
        if (newWidth > 300 && newWidth < 800) setSize(prev => ({ ...prev, width: newWidth }));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeDir(null);
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeDir]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const qNotes = query(collection(db, 'notes'), where('userId', '==', currentUser.uid));
        const unsubscribeNotes = onSnapshot(qNotes, async (snapshot) => {
          const notesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Note[];

          let historyNote = notesData.find(n => n.title === '__neural_chat_history__');

          if (!historyNote) {
            try {
              const newNoteRef = await addDoc(collection(db, 'notes'), {
                userId: currentUser.uid,
                title: '__neural_chat_history__',
                content: '[]',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
              setHistoryNoteId(newNoteRef.id);
            } catch (e) {
              console.error('Error creating hidden history note', e);
            }
          } else {
            setHistoryNoteId(historyNote.id);
            if (historyNote.content) {
              try {
                setChatHistory(JSON.parse(historyNote.content));
              } catch (e) {
                console.error('Error parsing hidden history note', e);
              }
            }
          }

          const visibleNotes = notesData.filter(n => n.title !== '__neural_chat_history__');
          setNotes(visibleNotes);
        });

        setCurrentSessionId(Date.now().toString());

        return () => {
          unsubscribeNotes();

        };
      } else {
        setNotes([]);
        setChatHistory([]);
      }
    });
    return () => unsubscribeAuth();
  }, []);


  const notesWithoutEmbeddings = notes.filter(n => !n.isTemporary && !n.embedding);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isLoading, isUploading, viewMode]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [queryText]);

  // Listen for global open events (for mobile nav integration)
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-specialist-chat', handleOpen);
    return () => window.removeEventListener('open-specialist-chat', handleOpen);
  }, []);

  const handleIndexNotes = async () => {
    if (isIndexing || notesWithoutEmbeddings.length === 0) return;
    setIsIndexing(true);
    setIndexProgress(10);

    try {
      const texts = notesWithoutEmbeddings.map(n => `${n.title}\n${n.content}`);
      const res = await fetch('/api/ai/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      if (data.embeddings && Array.isArray(data.embeddings)) {
        setIndexProgress(50);
        for (let i = 0; i < notesWithoutEmbeddings.length; i++) {
          const note = notesWithoutEmbeddings[i];
          const embedding = data.embeddings[i];
          if (embedding) {
            const noteRef = doc(db, 'notes', note.id);
            await updateDoc(noteRef, { embedding });
          }
        }
        setIndexProgress(100);
      }
    } catch (e) {
      console.error('Error batch indexing notes:', e);
    } finally {
      setTimeout(() => {
        setIsIndexing(false);
        setIndexProgress(0);
      }, 1000);
    }
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
      const isText = file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md');
      const isDoc = file.name.endsWith('.doc') || file.name.endsWith('.docx');

      if (!isImage && !isPdf && !isText && !isDoc) {
        alert('Formato não suportado. Envie PDFs, DOCs, Imagens, Áudios ou Vídeos.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const base64Data = base64.split(',')[1];

        let mime = file.type;
        if (!mime) {
          if (file.name.endsWith('.pdf')) mime = 'application/pdf';
          else if (file.name.endsWith('.docx')) mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          else if (file.name.endsWith('.doc')) mime = 'application/msword';
          else if (file.name.endsWith('.txt')) mime = 'text/plain';
          else mime = 'application/octet-stream';
        }

        setPendingFile({
          data: base64Data,
          mimeType: mime,
          name: file.name
        });
      };
      reader.readAsDataURL(file);
      return;
    }

    setIsUploading(true);
    const userMsg = { role: 'user', content: `📎 Anexou arquivo: ${file.name}` };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = Date.now().toString();
      setCurrentSessionId(sessionId);
    }

    try {
      let updatedHistory = [...chatHistory];
      const existingIndex = updatedHistory.findIndex((s: any) => s.id === currentSessionId);

      if (existingIndex >= 0) {
        updatedHistory[existingIndex] = {
          ...updatedHistory[existingIndex],
          messages: newMessages,
          updatedAt: Date.now()
        };
      } else {
        updatedHistory.push({
          id: currentSessionId,
          title: `Arquivo: ${file.name}`,
          timestamp: Date.now(),
          updatedAt: Date.now(),
          messages: newMessages
        });
      }

      if (historyNoteId) {
        const historyNoteRef = doc(db, 'notes', historyNoteId);
        await updateDoc(historyNoteRef, {
          content: JSON.stringify(updatedHistory),
          updatedAt: serverTimestamp()
        });
      }

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      if (data.text) {
        const finalMessages = [...newMessages, {
          role: 'assistant',
          content: `### Transcrição concluída: ${file.name}\n\n${data.text}`
        }];
        setMessages(finalMessages);

        let finalHistory = [...updatedHistory];
        const idx = finalHistory.findIndex((s: any) => s.id === currentSessionId);
        if (idx >= 0) {
          finalHistory[idx] = {
            ...finalHistory[idx],
            messages: finalMessages,
            updatedAt: Date.now()
          };
        }

        if (historyNoteId) {
          const historyNoteRef = doc(db, 'notes', historyNoteId);
          await updateDoc(historyNoteRef, {
            content: JSON.stringify(finalHistory),
            updatedAt: serverTimestamp()
          });
        }
      } else {
        throw new Error(data.error || 'Falha na transcrição');
      }
    } catch (error: any) {
      const errMessages = [...newMessages, { role: 'assistant', content: `Erro ao transcrever arquivo: ${error.message}` }];
      setMessages(errMessages);

      let finalHistory = [...chatHistory];
      const idx = finalHistory.findIndex((s: any) => s.id === currentSessionId);
      if (idx >= 0) {
        finalHistory[idx] = {
          ...finalHistory[idx],
          messages: errMessages,
          updatedAt: Date.now()
        };
      }

      if (historyNoteId) {
        const historyNoteRef = doc(db, 'notes', historyNoteId);
        await updateDoc(historyNoteRef, {
          content: JSON.stringify(finalHistory),
          updatedAt: serverTimestamp()
        });
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;

    const updatedHistory = chatHistory.filter((s: any) => s.id !== sessionToDelete.id);
    setDeletedSessionBuffer(sessionToDelete);
    setChatHistory(updatedHistory);
    setIsUndoVisible(true);
    setIsDeleteModalOpen(false);
    setSessionToDelete(null);

    if (historyNoteId) {
      try {
        const historyNoteRef = doc(db, 'notes', historyNoteId);
        await updateDoc(historyNoteRef, {
          content: JSON.stringify(updatedHistory),
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.error('Error deleting session from note', e);
      }
    }

    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => {
      setIsUndoVisible(false);
      setDeletedSessionBuffer(null);
    }, 5000);
  };

  const handleUndoDelete = async () => {
    if (!deletedSessionBuffer) return;

    const restoredHistory = [deletedSessionBuffer, ...chatHistory];
    restoredHistory.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));

    setChatHistory(restoredHistory);
    setIsUndoVisible(false);
    setDeletedSessionBuffer(null);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);

    if (historyNoteId) {
      try {
        const historyNoteRef = doc(db, 'notes', historyNoteId);
        await updateDoc(historyNoteRef, {
          content: JSON.stringify(restoredHistory),
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.error('Error restoring session to note', e);
      }
    }
  };
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!queryText.trim() && mentionedNotes.length === 0) || isLoading) return;

    const currentMentionedNotes = [...mentionedNotes];
    let rawQuestion = queryText.trim();
    if (!rawQuestion && currentMentionedNotes.length > 0) {
      rawQuestion = 'Analise o conteúdo desta(s) nota(s) ancorada(s).';
    }

    let userMessage = rawQuestion;
    if (currentMentionedNotes.length > 0) {
      const titlesStr = currentMentionedNotes
        .map((n) => formatNoteWithId(n))
        .join(' | ');
      userMessage = `📌 [Notas: ${titlesStr}]\n\n${userMessage}`;
    }
    if (pendingFile) {
      userMessage = `📎 [Anexo: ${pendingFile.name}]\n\n${userMessage}`;
    }

    setQueryText('');
    setMentionedNotes([]);
    setMentionQuery(null);
    setMentionStartIndex(null);

    const newMessages = [
      ...messages,
      {
        role: 'user',
        content: userMessage,
        mentionedNotes: currentMentionedNotes.map((n) => ({
          id: n.id,
          title: formatNoteWithId(n),
        })),
      },
    ];
    setMessages(newMessages);
    setIsLoading(true);

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = Date.now().toString();
      setCurrentSessionId(sessionId);
    }

    try {
      let updatedHistory = [...chatHistory];
      const existingIndex = updatedHistory.findIndex((s: any) => s.id === currentSessionId);

      if (existingIndex >= 0) {
        updatedHistory[existingIndex] = {
          ...updatedHistory[existingIndex],
          messages: newMessages,
          updatedAt: Date.now()
        };
      } else {
        const title = rawQuestion.substring(0, 30) + (rawQuestion.length > 30 ? '...' : '');
        updatedHistory.push({
          id: currentSessionId,
          title: title,
          timestamp: Date.now(),
          updatedAt: Date.now(),
          messages: newMessages
        });
      }

      if (historyNoteId) {
        const historyNoteRef = doc(db, 'notes', historyNoteId);
        await updateDoc(historyNoteRef, {
          content: JSON.stringify(updatedHistory),
          updatedAt: serverTimestamp()
        });
      }

      let urlsContent = '';
      if (pendingUrls.length > 0) {
        try {
          const scrapedTexts = await Promise.all(
            pendingUrls.map(async (url) => {
              const scrapeRes = await fetch('/api/ai/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
              });
              const scrapeData = await scrapeRes.json();
              if (scrapeData.text) {
                return `[FONTE EXTERNA: ${url}]\n${scrapeData.text}`;
              }
              return `[FONTE EXTERNA: ${url}]\n(Falha ao carregar conteúdo)`;
            })
          );
          urlsContent = scrapedTexts.join('\n\n---\n\n');
        } catch (e) {
          console.error('Error scraping URLs', e);
        }
      }

      // 1. Extração inteligente de imagens: prioridade máxima nas notas ancoradas (@) -> nota ativa -> notas relevantes (até 3 imagens)
      const currentOpenNote = activeNoteId ? notes.find((n) => n.id === activeNoteId) : null;
      const mentionedIdsSet = new Set(currentMentionedNotes.map((n) => n.id));
      let noteImagesToSend: Array<{ noteTitle: string; data: string; mimeType: string; alt?: string }> = [];

      // 1a. Imagens das notas ancoradas com @
      for (const mNote of currentMentionedNotes) {
        if (noteImagesToSend.length >= 3) break;
        const mExtracted = extractImagesFromHtml(mNote.content || '');
        for (const img of mExtracted) {
          if (noteImagesToSend.length >= 3) break;
          noteImagesToSend.push({
            ...img,
            noteTitle: getNoteDisplayTitle(mNote),
          });
        }
      }

      // 1b. Imagens da nota atualmente aberta no editor (se já não foi extraída via @)
      if (currentOpenNote && !mentionedIdsSet.has(currentOpenNote.id) && noteImagesToSend.length < 3) {
        const activeExtracted = extractImagesFromHtml(currentOpenNote.content || '');
        activeExtracted.forEach((img) => {
          if (noteImagesToSend.length < 3) {
            noteImagesToSend.push({
              ...img,
              noteTitle: getNoteDisplayTitle(currentOpenNote),
            });
          }
        });
      }

      // 1c. Imagens de outras notas relevantes por palavra-chave
      if (noteImagesToSend.length < 3) {
        const queryLower = rawQuestion.toLowerCase();
        const otherNotes = notes.filter(
          (n) =>
            n.id !== activeNoteId &&
            !mentionedIdsSet.has(n.id) &&
            n.title !== '__neural_chat_history__'
        );

        for (const n of otherNotes) {
          if (noteImagesToSend.length >= 3) break;
          const titleLower = (n.title || '').toLowerCase();
          const tagsLower = (n.tags || []).map((t) => t.toLowerCase());

          const isRelevant = titleLower.split(/\s+/).some((word) => word.length > 2 && queryLower.includes(word)) ||
            tagsLower.some((t) => queryLower.includes(t));

          if (isRelevant) {
            const extracted = extractImagesFromHtml(n.content || '');
            for (const img of extracted) {
              if (noteImagesToSend.length >= 3) break;
              noteImagesToSend.push({
                ...img,
                noteTitle: getNoteDisplayTitle(n),
              });
            }
          }
        }
      }

      if (currentOpenNote && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('neural-analysis-start', {
            detail: {
              noteId: currentOpenNote.id,
              hasImages: noteImagesToSend.length > 0,
            },
          })
        );
      }

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: rawQuestion,
          activeNoteId,
          mentionedNoteIds: currentMentionedNotes.map((n) => n.id),
          noteImages: noteImagesToSend.slice(0, 3),
          notes: notes.map((n) => {
            const isAnchored = mentionedIdsSet.has(n.id);
            return {
              id: n.id,
              seqId: noteNumbersMap.get(n.id),
              title: getNoteDisplayTitle(n),
              tags: n.tags || [],
              content: (n.content || '')
                .replace(/data:[^;]+;base64,[a-zA-Z0-9+/=]+/g, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, isAnchored ? 4000 : 1500)
            };
          }),
          file: pendingFile,
          urlsContent
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      if (data.text) {
        if (data.meta?.isFallback && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ai-fallback-triggered', { detail: data.meta }));
        }

        const finalMessages = [...newMessages, {
          role: 'assistant',
          content: data.text,
          sources: data.sources,
          meta: data.meta
        }];
        setMessages(finalMessages);

        let finalHistory = [...updatedHistory];
        const idx = finalHistory.findIndex((s: any) => s.id === currentSessionId);
        if (idx >= 0) {
          finalHistory[idx] = {
            ...finalHistory[idx],
            messages: finalMessages,
            updatedAt: Date.now()
          };
        }

        if (historyNoteId) {
          const historyNoteRef = doc(db, 'notes', historyNoteId);
          await updateDoc(historyNoteRef, {
            content: JSON.stringify(finalHistory),
            updatedAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao processar consulta. Tente novamente.' }]);
    } finally {
      setIsLoading(false);
      setPendingFile(null);
      setPendingUrls([]);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('neural-analysis-end'));
      }
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Botão Flutuante (Apenas Desktop) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hidden md:flex fixed bottom-8 right-8 z-[100] w-14 h-14 bg-[#FF4F00] text-white rounded-none shadow-[12px_12px_0px_rgba(0,0,0,0.1)] items-center justify-center hover:translate-y-[-2px] hover:shadow-[12px_14px_0px_rgba(0,0,0,0.15)] transition-all active:translate-y-[0px] active:shadow-none border border-black/5"
      >
        {isOpen ? <X size={24} /> : <Brain size={24} />}
      </button>


      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop apenas para Mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[90] md:hidden backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            {/* Modal / Bottom Sheet Responsivo */}
            <motion.div
              style={{
                width: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${size.width}px` : undefined,
                height: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${size.height}px` : undefined
              }}
              initial={typeof window !== 'undefined' && window.innerWidth >= 768 ? { scale: 0.9, opacity: 0 } : { y: "100%" }}
              animate={typeof window !== 'undefined' && window.innerWidth >= 768 ? { scale: 1, opacity: 1 } : { y: 0 }}
              exit={typeof window !== 'undefined' && window.innerWidth >= 768 ? { scale: 0.9, opacity: 0 } : { y: "100%" }}
              transition={typeof window !== 'undefined' && window.innerWidth >= 768 ? { type: "spring", damping: 25, stiffness: 200 } : { type: "spring", damping: 30, stiffness: 300 }}
              drag={typeof window !== 'undefined' && window.innerWidth < 768 ? "y" : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 150) setIsOpen(false);
              }}
              className={`
              fixed z-[100] bg-[var(--background)] text-[var(--foreground)] border-black flex flex-col
              /* Desktop Styles - Optimized for 1366x768 */
               md:bottom-24 md:right-8 md:border md:border-black/10 md:shadow-[12px_12px_0px_rgba(0,0,0,0.1)] md:rounded-none
              /* Mobile Styles (Bottom Sheet) */
              max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:w-full max-md:h-[85vh] max-md:rounded-t-[2.5rem] max-md:border-t-2
            `}>
              {/* Resize Handles (Desktop Only) */}
              <div
                className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize z-[110] hidden md:block"
                onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); setResizeDir('both'); document.body.style.cursor = 'nwse-resize'; }}
              />
              <div
                className="absolute top-0 left-4 right-4 h-1 cursor-ns-resize z-[110] hidden md:block"
                onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); setResizeDir('top'); document.body.style.cursor = 'ns-resize'; }}
              />
              <div
                className="absolute left-0 top-4 bottom-4 w-1 cursor-ew-resize z-[110] hidden md:block"
                onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); setResizeDir('left'); document.body.style.cursor = 'ew-resize'; }}
              />

              {/* Header com Handle para Mobile */}
              <div className="relative p-4 bg-[#FF4F00] text-white border-b border-black/10 flex items-center justify-between md:rounded-none rounded-t-[2.5rem] touch-none">
                {/* Drag handle visual para mobile */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-black/20 rounded-full md:hidden" />

                <div className="flex items-center gap-2 mt-2 md:mt-0">
                  <Brain size={20} />
                  <span className="font-bold uppercase tracking-widest text-xs">Especialista Neural</span>
                </div>

                <div className="flex items-center gap-1 mt-2 md:mt-0">
                  {viewMode === 'chat' && messages.length > 0 && (
                    <button
                      onClick={() => {
                        setMessages([]);
                        setCurrentSessionId(Date.now().toString());
                      }}
                      className="p-1.5 hover:bg-white/10 rounded transition-colors"
                      title="Nova Conversa"
                    >
                      <Plus size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => setViewMode(viewMode === 'chat' ? 'history' : 'chat')}
                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                    title="Histórico"
                  >
                    <History size={18} />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="hover:opacity-60 transition-opacity p-1.5"
                  >
                    <span className="hidden md:block"><X size={18} /></span>
                    <span className="md:hidden"><ChevronDown size={22} /></span>
                  </button>
                </div>
              </div>

              {/* Indexing Banner */}
              {notesWithoutEmbeddings.length > 0 && !isIndexing && (
                <div className="p-3 bg-black text-white flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-tight">
                    <Info size={12} className="text-[#FF4F00]" />
                    <span>{notesWithoutEmbeddings.length} Notas pendentes de indexação</span>
                  </div>
                  <button
                    onClick={handleIndexNotes}
                    className="text-[9px] font-bold underline text-[#FF4F00] hover:text-white"
                  >
                    Indexar
                  </button>
                </div>
              )}

              {isIndexing && (
                <div className="p-3 bg-black text-white flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[9px] font-bold uppercase">
                    <Loader2 size={12} className="animate-spin text-[#FF4F00]" />
                    <span>Mapeando Cérebro... {indexProgress}%</span>
                  </div>
                </div>
              )}

              {viewMode === 'chat' && (
                <>
                  <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--background)] border-b border-[var(--border)] custom-scrollbar"
                  >
                    {messages.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-30">
                        <Brain size={48} className="mb-4" />
                        <p className="text-sm font-sans font-medium text-[var(--foreground)]">
                          &quot;O conhecimento está latente. Faça sua pergunta.&quot;
                        </p>
                      </div>
                    )}

                    {messages.map((msg, i) => {
                      const isUser = msg.role === 'user';
                      const parsed = isUser ? parseUserMessage(msg.content) : null;

                      return (
                        <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] w-fit min-w-0 overflow-hidden border border-black/5 relative group select-text ${
                            isUser
                              ? 'bg-[#FF4F00]/50 text-white shadow-[2px_2px_0px_rgba(0,0,0,0.1)] px-3 py-2'
                              : 'bg-[var(--muted)] text-[var(--foreground)] shadow-[2px_2px_0px_rgba(0,0,0,0.1)] p-3'
                          }`}>
                            {msg.role === 'assistant' && (
                              <button
                                onClick={() => copyToClipboard(msg.content, i.toString())}
                                className="absolute -top-2 -right-2 w-7 h-7 bg-black text-white border border-white flex items-center justify-center hover:bg-[#FF4F00] transition-colors z-10 opacity-0 group-hover:opacity-100 shadow-md"
                                title="Copiar transcrição"
                              >
                                {copiedId === i.toString() ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            )}

                            {isUser ? (
                              <div className="text-sm leading-tight whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0">
                                {parsed?.attachmentName && (
                                  <div
                                    className="mb-2 inline-flex items-center gap-1.5 px-2 py-1 bg-black/25 hover:bg-black/35 border border-white/20 text-white text-[11px] font-sans font-medium rounded-none max-w-full transition-colors cursor-default select-none"
                                    title={parsed.attachmentName}
                                  >
                                    <Paperclip size={12} className="shrink-0 text-white/80" />
                                    <span className="truncate max-w-[190px] sm:max-w-[280px]">
                                      {parsed.attachmentName}
                                    </span>
                                  </div>
                                )}
                                {parsed?.mentionedNoteTitles && parsed.mentionedNoteTitles.length > 0 && (
                                  <div className="mb-2 flex flex-wrap gap-1.5">
                                    {parsed.mentionedNoteTitles.map((mTitle, mIdx) => {
                                      const matchedRef = msg.mentionedNotes?.[mIdx];
                                      return (
                                        <button
                                          key={mIdx}
                                          type="button"
                                          onClick={() =>
                                            handleOpenNoteByIdOrTitle(matchedRef?.id, mTitle)
                                          }
                                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#141414] hover:bg-black border border-white/30 text-white text-[10px] font-mono font-bold rounded-none max-w-full transition-colors cursor-pointer shadow-[2px_2px_0px_rgba(0,0,0,0.3)]"
                                          title={`Abrir nota ancorada: ${mTitle}`}
                                        >
                                          <span className="text-[#FF4F00]">@</span>
                                          <span className="truncate max-w-[180px] sm:max-w-[240px]">
                                            {mTitle}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                {parsed?.cleanContent && (
                                  <div className="break-words [overflow-wrap:anywhere]">
                                    {parsed.cleanContent}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm leading-snug prose prose-sm dark:prose-invert max-w-none break-words [overflow-wrap:anywhere] prose-p:my-0.5 prose-ul:my-1 prose-li:my-0 prose-headings:text-[var(--foreground)] prose-strong:text-inherit">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                              </div>
                            )}

                            {msg.meta?.isFallback && (
                              <div className="mt-3 flex items-center gap-1.5 text-[9px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1">
                                <Sparkles className="w-3 h-3 shrink-0 animate-pulse text-amber-500" />
                                <span>Respondido via {msg.meta.modelUsed} (Alta demanda no modelo principal)</span>
                              </div>
                            )}

                            {msg.sources && msg.sources.length > 0 && (
                              <MessageSources sources={msg.sources} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {(isLoading || isUploading) && (
                      <div className="flex justify-start">
                        <div className="bg-[var(--muted)] p-3 border border-black/5 shadow-[2px_2px_0px_rgba(0,0,0,0.1)] flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin text-[#FF4F00]" />
                          <span className="text-[9px] font-bold uppercase text-[var(--foreground)]">
                            {isUploading
                              ? 'Analisando Mídia...'
                              : pendingUrls.length > 0
                                ? 'Extraindo fontes externas...'
                                : 'Processando Sinapses...'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSendMessage} className="relative p-4 bg-[var(--background)] border-t border-black/10">
                    {/* Popover Brutalista de Autocomplete para Menção de Notas (@) */}
                    {mentionQuery !== null && (
                      <div className="absolute bottom-full left-4 right-4 mb-1.5 bg-[#141414] text-white border-2 border-black shadow-[4px_4px_0px_#FF4F00] z-[130] rounded-none overflow-hidden">
                        <div className="px-3 py-1.5 bg-black border-b border-white/10 flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-white/60 select-none">
                          <span className="flex items-center gap-1.5 text-[#FF4F00] font-bold">
                            <span>@</span> Ancorar Nota (@1, @#2 ou @Nome)
                          </span>
                          <span className="hidden sm:inline text-[8px] text-white/40">
                            ↑↓ Navegar • Enter/Tab Selecionar • Esc
                          </span>
                        </div>

                        {mentionSuggestions.length === 0 ? (
                          <div className="px-3 py-3 text-[11px] font-mono text-white/50 text-center">
                            Nenhuma nota encontrada para &quot;@{mentionQuery}&quot;
                          </div>
                        ) : (
                          <div className="max-h-[210px] overflow-y-auto divide-y divide-white/5 custom-scrollbar">
                            {mentionSuggestions.map((sNote, sIdx) => {
                              const isActive = sIdx === mentionSelectedIndex;
                              const noteNum = noteNumbersMap.get(sNote.id);
                              const displayTitle = getNoteDisplayTitle(sNote);
                              const noteTags = (sNote.tags || []).slice(0, 2);

                              return (
                                <button
                                  key={sNote.id}
                                  type="button"
                                  onMouseEnter={() => setMentionSelectedIndex(sIdx)}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectMention(sNote);
                                  }}
                                  className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer rounded-none ${
                                    isActive
                                      ? 'bg-[#FF4F00] text-white'
                                      : 'hover:bg-white/10 text-white/85'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {noteNum !== undefined ? (
                                      <span
                                        className={`px-1.5 py-0.5 text-[10px] font-mono font-bold border shrink-0 ${
                                          isActive
                                            ? 'bg-black text-white border-white/40'
                                            : 'bg-black/60 text-[#FF4F00] border-[#FF4F00]/40'
                                        }`}
                                      >
                                        #{noteNum}
                                      </span>
                                    ) : (
                                      <FileText
                                        size={13}
                                        className={`shrink-0 ${
                                          isActive ? 'text-white' : 'text-[#FF4F00]'
                                        }`}
                                      />
                                    )}
                                    <span className="text-xs font-mono font-bold truncate">
                                      {displayTitle}
                                    </span>
                                  </div>
                                  {noteTags.length > 0 && (
                                    <div className="flex items-center gap-1 shrink-0">
                                      {noteTags.map((tag, tIdx) => (
                                        <span
                                          key={tIdx}
                                          className={`px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-tight border ${
                                            isActive
                                              ? 'bg-black/25 border-white/30 text-white'
                                              : 'bg-white/5 border-white/15 text-white/60'
                                          }`}
                                        >
                                          #{tag.replace(/^#+/, '')}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col bg-[var(--muted)] border border-black/10 focus-within:ring-2 focus-within:ring-[#FF4F00] transition-all shadow-[4px_4px_0px_rgba(0,0,0,0.05)]">
                      {mentionedNotes.length > 0 && (
                        <div className="px-3 py-2 bg-black/5 dark:bg-white/5 border-b border-black/10 flex flex-wrap items-center gap-1.5 z-10">
                          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#FF4F00] mr-0.5 select-none">
                            Ancoradas:
                          </span>
                          {mentionedNotes.map((mNote) => (
                            <div
                              key={mNote.id}
                              className="inline-flex items-center gap-1.5 bg-[#141414] text-white border border-black px-2 py-0.5 shadow-[2px_2px_0px_#FF4F00] text-[10px] font-mono font-bold max-w-full rounded-none"
                            >
                              <span className="text-[#FF4F00]">@</span>
                              <span className="truncate max-w-[160px]">
                                {formatNoteWithId(mNote)}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setMentionedNotes((prev) =>
                                    prev.filter((n) => n.id !== mNote.id)
                                  )
                                }
                                className="text-white/50 hover:text-[#FF4F00] transition-colors ml-0.5 cursor-pointer"
                                title="Remover nota ancorada"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {pendingFile && (
                        <div className="px-4 py-2 bg-black/5 dark:bg-white/5 border-b border-black/10 flex justify-between items-center z-10">
                          <span className="text-[10px] font-bold text-[#FF4F00] truncate max-w-[80%] flex items-center gap-1">
                            📎 Pronto para análise: {pendingFile.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPendingFile(null)}
                            className="text-[var(--foreground)]/40 hover:text-red-500 text-[9px] font-bold uppercase tracking-widest transition-colors"
                          >
                            Remover
                          </button>
                        </div>
                      )}
                      {pendingUrls.length > 0 && (
                        <div className="px-4 py-2 bg-black/5 dark:bg-white/5 border-b border-black/10 flex flex-wrap gap-2 z-10">
                          {pendingUrls.map((url, uIdx) => (
                            <div key={uIdx} className="flex items-center gap-1 bg-[var(--muted)] border border-black/10 px-2 py-0.5 shadow-[2px_2px_0px_rgba(0,0,0,0.05)] text-[9px] font-bold">
                              <Globe size={10} className="text-[#FF4F00]" />
                              <span className="truncate max-w-[120px]">{url}</span>
                              <button
                                type="button"
                                onClick={() => setPendingUrls(prev => prev.filter((_, i) => i !== uIdx))}
                                className="text-[var(--foreground)]/40 hover:text-red-500 ml-1"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <textarea
                        ref={textareaRef}
                        value={queryText}
                        onChange={(e) => {
                          const val = e.target.value;
                          const cursorPos = e.target.selectionStart ?? val.length;
                          setQueryText(val);
                          updateMentionTriggerFromCursor(val, cursorPos);
                        }}
                        onClick={(e) => {
                          const target = e.currentTarget;
                          updateMentionTriggerFromCursor(
                            target.value,
                            target.selectionStart ?? target.value.length
                          );
                        }}
                        onKeyDown={(e) => {
                          if (mentionQuery !== null) {
                            if (e.key === 'ArrowDown' && mentionSuggestions.length > 0) {
                              e.preventDefault();
                              setMentionSelectedIndex(
                                (prev) => (prev + 1) % mentionSuggestions.length
                              );
                              return;
                            }
                            if (e.key === 'ArrowUp' && mentionSuggestions.length > 0) {
                              e.preventDefault();
                              setMentionSelectedIndex(
                                (prev) =>
                                  (prev - 1 + mentionSuggestions.length) %
                                  mentionSuggestions.length
                              );
                              return;
                            }
                            if (
                              (e.key === 'Enter' || e.key === 'Tab') &&
                              mentionSuggestions.length > 0
                            ) {
                              e.preventDefault();
                              const chosen =
                                mentionSuggestions[mentionSelectedIndex] ||
                                mentionSuggestions[0];
                              if (chosen) {
                                handleSelectMention(chosen);
                              }
                              return;
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              setMentionQuery(null);
                              setMentionStartIndex(null);
                              return;
                            }
                          }

                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e as any);
                          }
                        }}
                        placeholder="Pergunte ao seu cérebro... (Digite @1 ou @nome para ancorar nota)"
                        className="w-full bg-transparent text-[var(--foreground)] p-4 text-sm focus:outline-none placeholder:text-[var(--foreground)]/30 resize-none max-h-[160px] custom-scrollbar min-h-[60px]"
                        rows={1}
                      />
                      <div className="flex justify-between items-center px-4 pb-4">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 text-[var(--foreground)]/60 hover:text-[#FF4F00] hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                            title="Anexar arquivo (PDF, DOC, Imagens, Áudio/Vídeo)"
                          >
                            <Paperclip size={20} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsUrlModalOpen(true)}
                            className="p-2 text-[var(--foreground)]/60 hover:text-[#FF4F00] hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                            title="Vincular Link Externo"
                          >
                            <Link2 size={20} />
                          </button>
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept="audio/*,video/*,image/*,.pdf,.doc,.docx,.txt,.md"
                            className="hidden"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={
                            isLoading ||
                            isIndexing ||
                            isUploading ||
                            (!queryText.trim() && mentionedNotes.length === 0)
                          }
                          className="p-2 bg-black text-white hover:bg-[#FF4F00] hover:text-black disabled:opacity-30 disabled:hover:bg-black disabled:hover:text-white transition-all flex items-center justify-center"
                        >
                          <Send size={18} />
                        </button>
                      </div>
                    </div>
                  </form>
                </>
              )}

              {viewMode === 'history' && (
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[var(--background)] border-b border-[var(--border)] custom-scrollbar">
                  <div className="flex items-center gap-2 mb-2 text-[var(--foreground)]/60">
                    <button
                      onClick={() => setViewMode('chat')}
                      className="hover:text-[var(--foreground)] transition-colors flex items-center gap-1"
                    >
                      <ArrowLeft size={16} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Voltar ao Chat</span>
                    </button>
                  </div>

                  {chatHistory.length === 0 ? (
                    <p className="text-xs opacity-40 text-center py-16 font-sans">Nenhuma conversa registrada.</p>
                  ) : (
                    <div className="space-y-3">
                      {chatHistory.map((session) => (
                        <div
                          key={session.id}
                          onClick={() => {
                            setSelectedSession(session);
                            setViewMode('history-detail');
                          }}
                          className="p-4 bg-[var(--muted)] hover:bg-[var(--accent)]/5 border border-black/5 cursor-pointer transition-all shadow-[4px_4px_0px_rgba(0,0,0,0.02)] flex justify-between items-center group"
                        >
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-xs font-bold tracking-tight text-[var(--foreground)] group-hover:text-[var(--accent)] truncate pr-2">
                              {session.title}
                            </span>
                            <span className="text-[8px] font-bold uppercase tracking-widest opacity-30">
                              {new Date(session.timestamp).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[8px] font-bold uppercase tracking-widest bg-black/10 dark:bg-white/10 px-2.5 py-1 text-[var(--foreground)]/60">
                              {session.messages.length} msgs
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSessionToDelete(session);
                                setIsDeleteModalOpen(true);
                              }}
                              className="p-1.5 text-[var(--foreground)]/40 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                              title="Excluir conversa"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {viewMode === 'history-detail' && selectedSession && (
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[var(--background)] border-b border-[var(--border)] custom-scrollbar">
                  <div className="flex items-center justify-between mb-2 text-[var(--foreground)]/60 pb-2 border-b border-[var(--border)]/10">
                    <button
                      onClick={() => setViewMode('history')}
                      className="hover:text-[var(--foreground)] transition-colors flex items-center gap-1"
                    >
                      <ArrowLeft size={16} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Voltar ao Histórico</span>
                    </button>
                    <span className="text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 bg-black text-white/80">Consulta</span>
                  </div>

                  <div className="space-y-4">
                    {selectedSession.messages.map((msg: any, i: number) => {
                      const isUser = msg.role === 'user';
                      const parsed = isUser ? parseUserMessage(msg.content) : null;

                      return (
                        <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] w-fit min-w-0 overflow-hidden border border-black/5 relative group select-text ${
                            isUser
                              ? 'bg-[#FF4F00]/50 text-white shadow-[2px_2px_0px_rgba(0,0,0,0.1)] px-3 py-2'
                              : 'bg-[var(--muted)]/60 text-[var(--foreground)]/70 shadow-[2px_2px_0px_rgba(0,0,0,0.1)] p-3'
                          }`}>
                            {isUser ? (
                              <div className="text-sm leading-tight whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0">
                                {parsed?.attachmentName && (
                                  <div
                                    className="mb-2 inline-flex items-center gap-1.5 px-2 py-1 bg-black/25 hover:bg-black/35 border border-white/20 text-white text-[11px] font-sans font-medium rounded-none max-w-full transition-colors cursor-default select-none"
                                    title={parsed.attachmentName}
                                  >
                                    <Paperclip size={12} className="shrink-0 text-white/80" />
                                    <span className="truncate max-w-[190px] sm:max-w-[280px]">
                                      {parsed.attachmentName}
                                    </span>
                                  </div>
                                )}
                                {parsed?.mentionedNoteTitles && parsed.mentionedNoteTitles.length > 0 && (
                                  <div className="mb-2 flex flex-wrap gap-1.5">
                                    {parsed.mentionedNoteTitles.map((mTitle, mIdx) => {
                                      const matchedRef = msg.mentionedNotes?.[mIdx];
                                      return (
                                        <button
                                          key={mIdx}
                                          type="button"
                                          onClick={() =>
                                            handleOpenNoteByIdOrTitle(matchedRef?.id, mTitle)
                                          }
                                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#141414] hover:bg-black border border-white/30 text-white text-[10px] font-mono font-bold rounded-none max-w-full transition-colors cursor-pointer"
                                          title={`Abrir nota ancorada: ${mTitle}`}
                                        >
                                          <span className="text-[#FF4F00]">@</span>
                                          <span className="truncate max-w-[180px] sm:max-w-[240px]">
                                            {mTitle}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                {parsed?.cleanContent && (
                                  <div className="break-words [overflow-wrap:anywhere]">
                                    {parsed.cleanContent}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm leading-snug prose prose-sm dark:prose-invert max-w-none break-words [overflow-wrap:anywhere] prose-p:my-0.5 prose-ul:my-1 prose-li:my-0 prose-headings:text-[var(--foreground)]/80 prose-strong:text-inherit">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Modal de Confirmação de Exclusão */}
              {/* Modal de Vinculação de Link */}
              {isUrlModalOpen && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newUrlInput.trim()) {
                        let formattedUrl = newUrlInput.trim();
                        if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
                          formattedUrl = 'https://' + formattedUrl;
                        }
                        setPendingUrls(prev => [...prev, formattedUrl]);
                        setNewUrlInput('');
                        setIsUrlModalOpen(false);
                      }
                    }}
                    className="bg-[var(--background)] border-2 border-black p-6 shadow-[8px_8px_0px_rgba(0,0,0,0.2)] max-w-sm w-full"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--foreground)] mb-3 flex items-center gap-1">
                      <Link2 size={14} className="text-[#FF4F00]" /> Vincular URL Externa
                    </p>
                    <input
                      type="text"
                      value={newUrlInput}
                      onChange={(e) => setNewUrlInput(e.target.value)}
                      placeholder="ex: https://wikipedia.org/wiki/AI"
                      className="w-full bg-[var(--muted)] border border-black/10 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF4F00] placeholder:text-[var(--foreground)]/30 font-sans mb-4"
                      autoFocus
                    />
                    <div className="flex gap-3 justify-end">
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-black text-white text-[10px] font-bold uppercase tracking-wider hover:bg-[#FF4F00] hover:text-black transition-all shadow-[3px_3px_0px_rgba(0,0,0,0.1)]"
                      >
                        Adicionar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsUrlModalOpen(false);
                          setNewUrlInput('');
                        }}
                        className="px-3 py-1.5 bg-[var(--muted)] text-[var(--foreground)]/70 text-[10px] font-bold uppercase tracking-wider hover:bg-[var(--muted)]/80 transition-colors border border-black/10 shadow-[3px_3px_0px_rgba(0,0,0,0.1)]"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              )}
              {isDeleteModalOpen && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
                  <div className="bg-[var(--background)] border-2 border-black p-6 shadow-[8px_8px_0px_rgba(0,0,0,0.2)] max-w-xs w-full text-center">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--foreground)] mb-4">
                      Deseja realmente excluir esta conversa?
                    </p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={handleDeleteSession}
                        className="px-3 py-1.5 bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-red-600 transition-colors shadow-[3px_3px_0px_rgba(0,0,0,0.1)]"
                      >
                        Excluir
                      </button>
                      <button
                        onClick={() => {
                          setIsDeleteModalOpen(false);
                          setSessionToDelete(null);
                        }}
                        className="px-3 py-1.5 bg-[var(--muted)] text-[var(--foreground)]/70 text-[10px] font-bold uppercase tracking-wider hover:bg-[var(--muted)]/80 transition-colors border border-black/10 shadow-[3px_3px_0px_rgba(0,0,0,0.1)]"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Toast de Desfazer */}
              {isUndoVisible && (
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[120] bg-black text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 shadow-[4px_4px_0px_rgba(0,0,0,0.2)] flex items-center gap-3">
                  <span>Conversa excluída</span>
                  <button
                    onClick={handleUndoDelete}
                    className="text-[#FF4F00] underline hover:text-white transition-colors"
                  >
                    Desfazer
                  </button>
                </div>
              )}

              <p className="mt-2 text-[8px] text-center opacity-30 font-bold uppercase tracking-widest">
                IA pode cometer erros. Verifique informações importantes.
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
