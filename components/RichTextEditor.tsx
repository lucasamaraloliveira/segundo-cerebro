'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Extension, getHTMLFromFragment } from '@tiptap/core';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { Highlight } from '@tiptap/extension-highlight';
import { Link } from '@tiptap/extension-link';
import { TextAlign } from '@tiptap/extension-text-align';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  List, 
  ListOrdered, 
  CheckSquare,
  Type, 
  Palette,
  Quote,
  Code,
  SquareCode,
  Undo,
  Redo,
  Link as LinkIcon,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ChevronDown,
  Mic,
  Maximize2,
  Layers,
  Sparkles,
  AudioLines,
  Trash2,
  Play,
  Pause,
  Loader2,
  Volume2,
  MoreHorizontal
} from 'lucide-react';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    }
  }
}

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize,
            renderHTML: (attributes: Record<string, any>) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
          fontFamily: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontFamily,
            renderHTML: (attributes: Record<string, any>) => {
              if (!attributes.fontFamily) return {}
              return { style: `font-family: ${attributes.fontFamily}` }
            },
          },
        },
      },
      {
        types: ['paragraph', 'heading', 'listItem', 'bulletList', 'orderedList'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize,
            renderHTML: (attributes: Record<string, any>) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
          fontFamily: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontFamily,
            renderHTML: (attributes: Record<string, any>) => {
              if (!attributes.fontFamily) return {}
              return { style: `font-family: ${attributes.fontFamily}` }
            },
          },
        },
      }
    ]
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize }).run()
      },
      unsetFontSize: () => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize: null }).run()
      },
    }
  },
})

export const GhostTextPluginKey = new PluginKey('ghostText');

export const GhostText = Extension.create({
  name: 'ghostText',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: GhostTextPluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, set) {
            set = set.map(tr.mapping, tr.doc);
            const action = tr.getMeta(GhostTextPluginKey);
            if (action && action.type === 'set') {
              const widget = document.createElement('span');
              widget.className = 'text-[var(--foreground)] opacity-30 font-serif italic pointer-events-none select-none';
              widget.textContent = action.text;
              const deco = Decoration.widget(action.pos, widget, {
                side: 1, // insert after cursor
                suggestionText: action.text
              });
              return DecorationSet.create(tr.doc, [deco]);
            } else if (action && action.type === 'clear') {
              return DecorationSet.empty;
            }
            // Clear if user types
            if (tr.docChanged && !tr.getMeta(GhostTextPluginKey)) {
               return DecorationSet.empty;
            }
            return set;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
          handleKeyDown(view, event) {
            const state = this.getState(view.state);
            const hasDecoration = state && state.find().length > 0;
            
            if (hasDecoration) {
              if (event.key === 'Tab' || event.key === 'ArrowRight') {
                const deco = state.find()[0];
                const text = deco.spec.suggestionText;
                view.dispatch(
                  view.state.tr
                    .insertText(text, deco.from)
                    .setMeta(GhostTextPluginKey, { type: 'clear' })
                );
                return true; // prevent default (don't insert tab, just accept text)
              } else if (event.key !== 'Shift' && event.key !== 'Control' && event.key !== 'Alt') {
                view.dispatch(view.state.tr.setMeta(GhostTextPluginKey, { type: 'clear' }));
              }
            }
            return false;
          }
        },
      }),
    ];
  },
});

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  isFocusMode?: boolean;
  notes?: any[];
  activeNoteId?: string;
  onSelectionChange?: (selection: { text: string; html: string } | null) => void;
  replaceSelectionContent?: string | null;
  onReplaceSelectionComplete?: () => void;
}

export const FONT_OPTIONS = [
  { label: 'Inter', value: 'Inter', category: 'Sans Moderna', fontFamily: 'var(--font-sans), Inter, sans-serif' },
  { label: 'Roboto', value: 'Roboto', category: 'Sans Material', fontFamily: 'var(--font-roboto), Roboto, sans-serif' },
  { label: 'Ubuntu', value: 'Ubuntu', category: 'Sans Humanista', fontFamily: 'var(--font-ubuntu), Ubuntu, sans-serif' },
  { label: 'Plus Jakarta', value: 'Plus Jakarta Sans', category: 'Sans Geométrica', fontFamily: 'var(--font-plus-jakarta), "Plus Jakarta Sans", sans-serif' },
  { label: 'Arial', value: 'Arial', category: 'Sans Padrão', fontFamily: 'Arial, Helvetica, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman', category: 'Serif Acadêmica', fontFamily: '"Times New Roman", Times, serif' },
  { label: 'Cormorant', value: 'Cormorant Garamond', category: 'Serif Literária', fontFamily: 'var(--font-serif), "Cormorant Garamond", Georgia, serif' },
  { label: 'Lora', value: 'Lora', category: 'Serif Editorial', fontFamily: 'var(--font-lora), Lora, Georgia, serif' },
  { label: 'JetBrains', value: 'JetBrains Mono', category: 'Mono Código', fontFamily: 'var(--font-mono), "JetBrains Mono", monospace' },
  { label: 'Space Mono', value: 'Space Mono', category: 'Mono Terminal', fontFamily: 'var(--font-space-mono), "Space Mono", monospace' },
  { label: 'Caveat', value: 'Caveat', category: 'Manuscrita', fontFamily: 'var(--font-caveat), Caveat, cursive' },
];

export const COLOR_OPTIONS = [
  { label: 'Padrão', value: 'default', color: 'currentColor' },
  { label: 'Preto', value: '#000000', color: '#000000' },
  { label: 'Cinza', value: '#666666', color: '#666666' },
  { label: 'Vermelho', value: '#EF4444', color: '#EF4444' },
  { label: 'Laranja', value: '#F97316', color: '#F97316' },
  { label: 'Amarelo', value: '#EAB308', color: '#EAB308' },
  { label: 'Verde', value: '#22C55E', color: '#22C55E' },
  { label: 'Azul', value: '#3B82F6', color: '#3B82F6' },
  { label: 'Roxo', value: '#A855F7', color: '#A855F7' },
];

export const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '30px', '36px'];

export const ALIGNMENT_OPTIONS = [
  { label: 'Esquerda', value: 'left', icon: AlignLeft },
  { label: 'Centro', value: 'center', icon: AlignCenter },
  { label: 'Direita', value: 'right', icon: AlignRight },
  { label: 'Justificado', value: 'justify', icon: AlignJustify },
];

// Sub-components moved outside to avoid re-definition and state loss on render
const ToolbarButton = ({ 
  onClick, 
  isActive = false, 
  children, 
  title,
  className = ''
}: { 
  onClick: () => void; 
  isActive?: boolean; 
  children: React.ReactNode;
  title: string;
  className?: string;
}) => (
  <button
    onClick={(e) => {
      e.preventDefault();
      onClick();
    }}
    title={title}
    className={`w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-none transition-all relative shrink-0 ${
      isActive 
        ? 'bg-[var(--accent)] text-white shadow-sm' 
        : 'hover:bg-[var(--muted)] text-[var(--foreground)] opacity-70 hover:opacity-100 hover:scale-105 active:scale-95'
    } ${className}`}
  >
    {children}
  </button>
);

const ToolbarGroup = ({ children, label }: { children: React.ReactNode, label?: string }) => (
  <div className="flex flex-col gap-0 flex-shrink-0">
    {label && <span className="hidden md:block text-[6px] font-mono font-bold uppercase tracking-[0.15em] opacity-20 px-0.5">{label}</span>}
    <div className="flex items-center gap-1 bg-[var(--muted)]/5 p-1 rounded-none border border-[var(--border)]/5">
      {children}
    </div>
  </div>
);

const CustomSelect = ({ 
  icon: Icon, 
  value, 
  onChange, 
  options, 
  label,
  hideLabel = false,
  colorIndicator = false,
}: { 
  icon: any, 
  value?: string, 
  onChange: (val: string) => void, 
  options: { label: string, value: string, isActive?: boolean, color?: string, icon?: any, fontFamily?: string, category?: string }[],
  label: string,
  hideLabel?: boolean,
  colorIndicator?: boolean,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const selectedOption = options.find(opt => opt.value === value);
  const selectedLabel = selectedOption?.label || label;

  const toggleOpen = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 200;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 12));
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < 280 && rect.top > 280 ? Math.max(8, rect.top - 280) : rect.bottom + 6;
      setCoords({
        top,
        left,
      });
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleOpen();
        }}
        title={label}
        className={`flex items-center justify-center gap-1 ${
          hideLabel ? 'w-8 h-8 sm:w-7 sm:h-7 p-1' : 'h-8 sm:h-7 px-1.5 py-1'
        } rounded-none bg-[var(--muted)]/50 text-[var(--foreground)] border border-[var(--border)]/10 hover:border-[var(--accent)]/50 transition-all group shrink-0 ${
          isOpen ? 'ring-1 ring-[var(--accent)] border-[var(--accent)]/50' : ''
        }`}
      >
        <Icon className="w-3.5 h-3.5 sm:w-3 sm:h-3 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
        {colorIndicator && (
          <span 
            className="w-2 h-2 rounded-full border border-black/20 shrink-0" 
            style={{ backgroundColor: value && value !== 'default' ? value : 'var(--foreground)' }} 
          />
        )}
        {!hideLabel && (
          <>
            <span className="text-[9px] font-bold uppercase tracking-wider truncate max-w-[62px]">
              {selectedLabel}
            </span>
            <ChevronDown className={`w-2.5 h-2.5 ml-auto opacity-30 group-hover:opacity-100 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              <div 
                className="fixed inset-0 z-[9990]" 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }} 
              />
              <motion.div 
                initial={{ opacity: 0, y: 5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5, scale: 0.95 }}
                style={{
                  position: 'fixed',
                  top: coords.top,
                  left: coords.left,
                }}
                className="z-[9999] bg-[var(--background)]/95 backdrop-blur-xl border border-[var(--border)] shadow-[6px_6px_0px_rgba(0,0,0,0.15)] rounded-none min-w-[190px] py-1.5 overflow-hidden"
              >
                <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                  {options.map(opt => {
                    const OptionIcon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onChange(opt.value);
                          setIsOpen(false); 
                        }}
                        className={`w-full text-left px-3.5 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white transition-colors text-[var(--foreground)] flex items-center justify-between group/opt ${opt.isActive || value === opt.value ? 'bg-[var(--accent)]/5 text-[var(--accent)]' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          {OptionIcon && <OptionIcon className="w-3.5 h-3.5 opacity-70 group-hover/opt:text-white" />}
                          {opt.color && (
                            <span 
                              className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0" 
                              style={{ backgroundColor: opt.color === 'currentColor' ? 'var(--foreground)' : opt.color }}
                            />
                          )}
                          <div className="flex flex-col">
                            <span 
                              className="text-[11px] normal-case tracking-normal" 
                              style={opt.fontFamily ? { fontFamily: opt.fontFamily } : undefined}
                            >
                              {opt.label}
                            </span>
                            {opt.category && (
                              <span className="text-[7.5px] opacity-40 group-hover/opt:text-white/80 group-hover/opt:opacity-100 uppercase tracking-wider font-mono font-normal">
                                {opt.category}
                              </span>
                            )}
                          </div>
                        </div>
                        {(opt.isActive || value === opt.value) && <div className="w-1.5 h-1.5 bg-[var(--accent)] group-hover/opt:bg-white rounded-full shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

const cleanHtmlTags = (text: string) => {
  if (!text) return '';
  return text
    // Replace <bold> or <strong> or <b> tags with markdown **
    .replace(/<(?:bold|strong|b)(?:\s+[^>]*?)?>(.*?)<\/(?:bold|strong|b)>/gi, '**$1**')
    // Replace <em> or <i> tags with markdown *
    .replace(/<(?:em|i)(?:\s+[^>]*?)?>(.*?)<\/(?:em|i)>/gi, '*$1*')
    // Replace h1, h2, h3 tags with markdown #, ##, ###
    .replace(/<h1(?:\s+[^>]*?)?>(.*?)<\/h1>/gi, '# $1')
    .replace(/<h2(?:\s+[^>]*?)?>(.*?)<\/h2>/gi, '## $1')
    .replace(/<h3(?:\s+[^>]*?)?>(.*?)<\/h3>/gi, '### $1')
    // Replace p tags
    .replace(/<p(?:\s+[^>]*?)?>(.*?)<\/p>/gi, '\n\n$1\n\n')
    // Replace br tags
    .replace(/<br\s*\/?>/gi, '\n');
};

const markdownToHtml = (markdown: string) => {
  if (!markdown) return '';
  
  return markdown
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .split('<li>')
    .map((s, i) => i === 0 ? s : `<li>${s}`)
    .join('')
    .replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>')
    .replace(/<\/ul><ul>/g, '');
};

export default function RichTextEditor({ content, onChange, placeholder, isFocusMode = false, notes = [], activeNoteId, onSelectionChange, replaceSelectionContent, onReplaceSelectionComplete }: RichTextEditorProps) {
  const [pasteModal, setPasteModal] = useState<{ show: boolean, text: string, html: string } | null>(null);
  const [noteLinkModal, setNoteLinkModal] = useState(false);
  const [noteSearch, setNoteSearch] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<any>(null);
  const [neuralSuggestion, setNeuralSuggestion] = useState<{ id: string, title: string, score: number } | null>(null);
  const [ignoredSuggestions, setIgnoredSuggestions] = useState<Set<string>>(new Set());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isPopoverFontExpanded, setIsPopoverFontExpanded] = useState(false);
  const [isMobileFontExpanded, setIsMobileFontExpanded] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const [moreCoords, setMoreCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
    return 850;
  });

  useLayoutEffect(() => {
    if (editorContainerRef.current && editorContainerRef.current.offsetWidth > 0) {
      setContainerWidth(editorContainerRef.current.offsetWidth);
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
    let rafId: number | null = null;
    const updateWidth = (w: number) => {
      if (w <= 0) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setContainerWidth(w);
      });
    };

    if (editorContainerRef.current && editorContainerRef.current.offsetWidth > 0) {
      updateWidth(editorContainerRef.current.offsetWidth);
    }

    const handleWindowResize = () => {
      if (editorContainerRef.current && editorContainerRef.current.offsetWidth > 0) {
        updateWidth(editorContainerRef.current.offsetWidth);
      } else if (typeof window !== 'undefined') {
        updateWidth(window.innerWidth);
      }
    };

    window.addEventListener('resize', handleWindowResize, { passive: true });

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && editorContainerRef.current) {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            updateWidth(entry.contentRect.width);
          }
        }
      });
      observer.observe(editorContainerRef.current);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleWindowResize);
      if (observer) observer.disconnect();
    };
  }, []);

  const isTier2Visible = containerWidth >= 480;
  const isTier3Visible = containerWidth >= 720;
  
  const lastAnalyzedText = useRef('');

  // Temporary Audio Recording States
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingAudioDuration, setRecordingAudioDuration] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showAudioProcessingModal, setShowAudioProcessingModal] = useState(false);
  const [showAudioDeleteConfirmModal, setShowAudioDeleteConfirmModal] = useState(false);
  const [selectedAudioFormat, setSelectedAudioFormat] = useState<'transcribe' | 'meeting_minutes' | 'email' | 'summary' | 'tasks'>('transcribe');
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [audioProcessingError, setAudioProcessingError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingAudioIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Audio Playback Listener
  useEffect(() => {
    if (audioUrl && audioPlayerRef.current) {
      const player = audioPlayerRef.current;
      const onPlay = () => setIsPlayingAudio(true);
      const onPause = () => setIsPlayingAudio(false);
      const onEnded = () => setIsPlayingAudio(false);

      player.addEventListener('play', onPlay);
      player.addEventListener('pause', onPause);
      player.addEventListener('ended', onEnded);

      return () => {
        player.removeEventListener('play', onPlay);
        player.removeEventListener('pause', onPause);
        player.removeEventListener('ended', onEnded);
      };
    }
  }, [audioUrl, showAudioProcessingModal]);

  // Cleanup Object URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (recordingAudioIntervalRef.current) {
        clearInterval(recordingAudioIntervalRef.current);
      }
    };
  }, [audioUrl]);

  // Start recording audio
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setShowAudioProcessingModal(true);
        
        // Stop all tracks in the stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingAudio(true);
      setRecordingAudioDuration(0);

      recordingAudioIntervalRef.current = setInterval(() => {
        setRecordingAudioDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Erro ao acessar microfone para gravação:", err);
      alert("Não foi possível acessar seu microfone para gravação.");
    }
  };

  // Stop recording audio
  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      if (recordingAudioIntervalRef.current) {
        clearInterval(recordingAudioIntervalRef.current);
      }
    }
  };

  // Format recording duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Process recorded audio with Gemini API
  const handleProcessAudio = async () => {
    if (!audioBlob) return;
    setIsProcessingAudio(true);
    setAudioProcessingError(null);

    const formData = new FormData();
    formData.append('file', audioBlob, 'temp_audio.webm');
    formData.append('promptType', selectedAudioFormat);

    try {
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.text) {
        // Apply formatted text to the editor
        if (editor) {
          editor.chain().focus().insertContent(markdownToHtml(cleanHtmlTags(data.text))).run();
        }
        // Success: clear audio and close modal
        handleDeleteAudio(true); // Bypass confirmation to clean up after successful use
      } else {
        throw new Error(data.error || 'Falha ao processar o áudio.');
      }
    } catch (e: any) {
      console.error(e);
      setAudioProcessingError(e.message || 'Erro de rede ou de API.');
    } finally {
      setIsProcessingAudio(false);
    }
  };

  // Delete recorded audio
  const handleDeleteAudio = (bypassConfirm = false) => {
    if (bypassConfirm) {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      setAudioBlob(null);
      setAudioUrl(null);
      setShowAudioProcessingModal(false);
      setShowAudioDeleteConfirmModal(false);
      setIsPlayingAudio(false);
      setRecordingAudioDuration(0);
      setAudioProcessingError(null);
    } else {
      setShowAudioDeleteConfirmModal(true);
    }
  };

  const [isAiAutocompleteEnabled, setIsAiAutocompleteEnabled] = useState(false);
  const autocompleteTimer = useRef<NodeJS.Timeout | null>(null);

  const editor = useEditor({
    extensions: [
      GhostText,
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      StarterKit.configure({
        bulletList: false,
        orderedList: false,
      }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
      }),
      BulletList.configure({
        HTMLAttributes: {
          class: 'bullet-list',
        },
      }),
      OrderedList.configure({
        HTMLAttributes: {
          class: 'ordered-list',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      FontSize,
      Placeholder.configure({
        placeholder: placeholder || 'Escreva seus pensamentos aqui...',
      }),
    ],
    content: content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from === to) {
        if (editor.isFocused) {
          onSelectionChange?.(null);
        }
      } else {
        const text = editor.state.doc.textBetween(from, to, ' ');
        const html = getHTMLFromFragment(editor.state.selection.content().content, editor.schema);
        onSelectionChange?.({ text, html });
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm md:prose-base lg:prose-lg xl:prose-xl dark:prose-invert max-w-none focus:outline-none min-h-[70vh] font-sans pb-40',
      },
      handlePaste(view, event) {
        const text = event.clipboardData?.getData('text/plain') || '';
        const html = event.clipboardData?.getData('text/html') || '';
        if (!html || html === text) return false;
        setPasteModal({ show: true, text, html });
        return true;
      },
    },
  });

  const currentFontFamily = editor?.getAttributes('textStyle')?.fontFamily || 'Inter';
  const currentFont = FONT_OPTIONS.find(f => f.value === currentFontFamily) || FONT_OPTIONS[0];
  
  // Sync external content changes (e.g. from AI Assistant)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Update editor attributes when font changes
  useEffect(() => {
    if (editor) {
        editor.setOptions({
          editorProps: {
            attributes: {
              class: 'prose prose-sm md:prose-base lg:prose-lg xl:prose-xl dark:prose-invert max-w-none focus:outline-none min-h-[70vh] font-sans pb-40',
            },
            handlePaste(view, event) {
              const text = event.clipboardData?.getData('text/plain') || '';
              const html = event.clipboardData?.getData('text/html') || '';
              if (!html || html === text) return false;
              setPasteModal({ show: true, text, html });
              return true;
            },
          },
        });
    }
  }, [editor]);

  const handlePasteChoice = (keep: boolean) => {
    if (!editor || !pasteModal) return;
    if (keep) {
      editor.chain().focus().insertContent(pasteModal.html).run();
    } else {
      editor.chain().focus().insertContent(pasteModal.text).run();
    }
    setPasteModal(null);
  };

  // Auto-complete logic
  useEffect(() => {
    if (!editor) return;

    if (!isAiAutocompleteEnabled) {
      editor.view.dispatch(editor.state.tr.setMeta(GhostTextPluginKey, { type: 'clear' }));
      return;
    }

    const handleInteraction = () => {
      if (autocompleteTimer.current) {
        clearTimeout(autocompleteTimer.current);
      }
      
      // We clear the ghost text right away when typing happens within the extension's apply logic,
      // but we also reset the timer here.
      
      autocompleteTimer.current = setTimeout(async () => {
        // Double check state inside timeout just in case it was toggled off
        if (!isAiAutocompleteEnabled) return;
        
        const text = editor.getText();
        if (text.length < 5) return; 
        
        const { from, to } = editor.state.selection;
        if (from !== to) return; // Don't suggest if text is highlighted

        try {
          const context = text.slice(Math.max(0, text.length - 800)); // Get last 800 chars
          const res = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              prompt: `Você é uma IA de autocompletar texto trabalhando de forma invisível. Analise o contexto abaixo e preveja APENAS AS PRÓXIMAS PALAVRAS (1 a 8 palavras no máximo) que completariam a frase atual de forma natural e fluida. Retorne APENAS o texto da sugestão, sem aspas, sem formatação e sem comentários. Se não houver nada natural a sugerir ou se a frase já estiver perfeitamente concluída, retorne vazio.\n\nCONTEXTO:\n${context}` 
            })
          });
          const data = await res.json();
          
          if (data.text && data.text.trim().length > 0) {
             const suggestion = data.text.trim();
             // Ensure cursor hasn't moved while fetching
             if (editor.state.selection.from === from && isAiAutocompleteEnabled) {
                const textBeforeCursor = editor.state.doc.textBetween(Math.max(0, from - 1), from);
                const needsSpace = textBeforeCursor && !textBeforeCursor.match(/\s/) && !suggestion.match(/^\s/);
                const finalSuggestion = needsSpace ? ` ${suggestion}` : suggestion;
                
                editor.view.dispatch(
                  editor.state.tr.setMeta(GhostTextPluginKey, {
                    type: 'set',
                    text: finalSuggestion,
                    pos: from
                  })
                );
             }
          }
        } catch (e) {
          console.error('Autocomplete error:', e);
        }
      }, 1200); // 1.2s debounce
    };

    editor.on('update', handleInteraction);
    editor.on('selectionUpdate', handleInteraction);

    return () => {
      editor.off('update', handleInteraction);
      editor.off('selectionUpdate', handleInteraction);
      if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    };
  }, [editor, isAiAutocompleteEnabled]);

  const toggleTranscription = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      setInterimText('');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Seu navegador não suporta transcrição de áudio.");
      return;
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = !isMobile; // Disable interim results on mobile to avoid duplication with native Android

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          currentInterim += transcript;
        }
      }

      setInterimText(currentInterim);

      if (finalTranscript && editor) {
        const processed = finalTranscript
          .replace(/ vírgula/gi, ',')
          .replace(/ ponto final/gi, '.')
          .replace(/ ponto/gi, '.')
          .replace(/ nova linha/gi, '<br>')
          .replace(/ próximo parágrafo/gi, '<br><br>')
          .replace(/ parágrafo/gi, '<br><br>')
          .replace(/ interrogação/gi, '?')
          .replace(/ exclamação/gi, '!');
        
        editor.chain().focus().insertContent(processed + " ").run();
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Erro na transcrição:', event.error);
      setIsRecording(false);
      setInterimText('');
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimText('');
    };
    
    try {
      recognition.start();
      setIsRecording(true);
      recognitionRef.current = recognition;
    } catch (e) {
      console.error(e);
    }
  };

  // Neural Suggestion Logic (Debounced)
  useEffect(() => {
    if (!editor || !notes || notes.length < 2) return;

    const timer = setTimeout(() => {
      const currentText = editor.getText();
      // Only analyze if text changed significantly (at least 20 chars)
      if (Math.abs(currentText.length - lastAnalyzedText.current.length) < 20) return;
      lastAnalyzedText.current = currentText;

      // Simple keyword-based similarity for instant client-side feedback
      const words = currentText.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      if (words.length < 5) return;

      let bestMatch: { id: string, title: string, score: number } | null = null;
      let maxScore = 0;

      const currentHtml = editor.getHTML();

      for (const note of notes) {
        if (note.id === activeNoteId || ignoredSuggestions.has(note.id)) continue;
        
        // Skip if already linked
        if (currentHtml.includes(note.id)) continue;

        const noteText = (note.title + ' ' + (note.content || '')).toLowerCase();
        let score = 0;
        
        // Match words
        words.forEach(word => {
          if (noteText.includes(word)) score += 1;
        });

        // Normalize score
        const finalScore = score / words.length;
        if (finalScore > 0.3 && finalScore > maxScore) {
          maxScore = finalScore;
          bestMatch = { id: note.id, title: note.title, score: Math.round(finalScore * 100) };
        }
      }

      if (bestMatch && bestMatch.score > 40) {
        setNeuralSuggestion(bestMatch);
        // Auto-hide suggestion after 10 seconds if not acted upon
        setTimeout(() => setNeuralSuggestion(null), 10000);
      } else {
        setNeuralSuggestion(null);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [content, notes, editor, activeNoteId, ignoredSuggestions]);

  if (!editor) {
    return null;
  }

  return (
    <div ref={editorContainerRef} className="@container/editor flex flex-col w-full relative">
      {/* Toolbar Container */}
      <div className={isFocusMode 
        ? "sticky top-4 z-50 flex justify-center w-full pointer-events-none mb-4" 
        : "w-full border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-sm sticky top-0 z-30 px-2 sm:px-4 md:px-6 py-2 flex items-center justify-between gap-1 sm:gap-2"
      }>
        <div className={isFocusMode 
          ? "pointer-events-auto bg-[var(--background)]/90 backdrop-blur-xl border border-[var(--border)] shadow-[6px_6px_0px_rgba(0,0,0,0.15)] rounded-none px-2 py-1 lg:px-3 lg:py-1.5 flex items-center justify-between max-w-[calc(100%-1.5rem)] sm:max-w-[720px] w-fit mx-auto transition-all hover:shadow-[8px_8px_0px_rgba(0,0,0,0.2)]"
          : "pointer-events-auto flex items-center justify-between w-full"
        }>
          {/* Trilha de botões rolável suavemente se a largura for ultra-estreita */}
          <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1">
            {/* GRUPO 1: HISTÓRICO (Sempre visível) */}
            <div className="flex items-center shrink-0">
              <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Desfazer (Ctrl+Z)">
                <Undo className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Refazer (Ctrl+Y)">
                <Redo className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </ToolbarButton>
            </div>

            {/* Divisor */}
            <div className="w-[1px] h-3.5 bg-[var(--border)]/30 mx-0.5 shrink-0" />

            {/* GRUPO 2: ESTILO BÁSICO (Bold/Italic sempre; Underline a partir de 480px) */}
            <div className="flex items-center shrink-0">
              <ToolbarButton 
                onClick={() => editor.chain().focus().toggleBold().run()} 
                isActive={editor.isActive('bold')} 
                title="Negrito (Ctrl+B)"
              >
                <Bold className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </ToolbarButton>
              <ToolbarButton 
                onClick={() => editor.chain().focus().toggleItalic().run()} 
                isActive={editor.isActive('italic')} 
                title="Itálico (Ctrl+I)"
              >
                <Italic className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </ToolbarButton>
              <AnimatePresence initial={false}>
                {isTier2Visible && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden flex items-center shrink-0"
                  >
                    <ToolbarButton 
                      onClick={() => editor.chain().focus().toggleUnderline().run()} 
                      isActive={editor.isActive('underline')} 
                      title="Sublinhado (Ctrl+U)"
                    >
                      <UnderlineIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </ToolbarButton>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* GRUPO 3: BLOCOS (Citação e Código a partir de 480px) */}
            <AnimatePresence initial={false}>
              {isTier2Visible && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center shrink-0 overflow-hidden"
                >
                  <div className="w-[1px] h-3.5 bg-[var(--border)]/30 mx-0.5 shrink-0" />
                  <ToolbarButton 
                    onClick={() => editor.chain().focus().toggleBlockquote().run()} 
                    isActive={editor.isActive('blockquote')} 
                    title="Citação"
                  >
                    <Quote className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                  </ToolbarButton>
                  <ToolbarButton 
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()} 
                    isActive={editor.isActive('codeBlock')} 
                    title="Bloco de Código"
                  >
                    <SquareCode className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                  </ToolbarButton>
                </motion.div>
              )}
            </AnimatePresence>

            {/* GRUPO 4: TIPOGRAFIA (Fonte, Tamanho, Cor, Alinhamento a partir de 720px) */}
            <AnimatePresence initial={false}>
              {isTier3Visible && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-1 shrink-0 overflow-hidden"
                >
                  <div className="w-[1px] h-3.5 bg-[var(--border)]/30 mx-0.5 shrink-0" />
                  <CustomSelect 
                    label="Fonte"
                    icon={Type}
                    value={editor.getAttributes('textStyle').fontFamily || 'Inter'}
                    onChange={(val) => editor.chain().focus().setFontFamily(val).run()}
                    options={FONT_OPTIONS}
                  />

                  <CustomSelect 
                    label="Tam"
                    icon={Type}
                    value={editor.getAttributes('textStyle').fontSize || '16px'}
                    onChange={(val) => editor.chain().focus().setFontSize(val).run()}
                    options={[
                      { label: '12', value: '12px' },
                      { label: '14', value: '14px' },
                      { label: '16', value: '16px' },
                      { label: '18', value: '18px' },
                      { label: '20', value: '20px' },
                      { label: '24', value: '24px' },
                      { label: '30', value: '30px' },
                      { label: '36', value: '36px' },
                    ]}
                  />

                  <CustomSelect 
                    label="Cor"
                    icon={Palette}
                    hideLabel={true}
                    colorIndicator={true}
                    value={editor.getAttributes('textStyle').color || 'default'}
                    onChange={(val) => {
                      if (val === 'default') editor.chain().focus().unsetColor().run();
                      else editor.chain().focus().setColor(val).run();
                    }}
                    options={[
                      { label: 'Padrão', value: 'default', color: 'currentColor' },
                      { label: 'Preto', value: '#000000', color: '#000000' },
                      { label: 'Cinza', value: '#666666', color: '#666666' },
                      { label: 'Vermelho', value: '#EF4444', color: '#EF4444' },
                      { label: 'Laranja', value: '#F97316', color: '#F97316' },
                      { label: 'Amarelo', value: '#EAB308', color: '#EAB308' },
                      { label: 'Verde', value: '#22C55E', color: '#22C55E' },
                      { label: 'Azul', value: '#3B82F6', color: '#3B82F6' },
                      { label: 'Roxo', value: '#A855F7', color: '#A855F7' },
                    ]}
                  />

                  <CustomSelect 
                    label="Alinhar"
                    icon={
                      editor.isActive({ textAlign: 'center' }) ? AlignCenter :
                      editor.isActive({ textAlign: 'right' }) ? AlignRight :
                      editor.isActive({ textAlign: 'justify' }) ? AlignJustify : AlignLeft
                    }
                    hideLabel={true}
                    value={
                      editor.isActive({ textAlign: 'left' }) ? 'left' :
                      editor.isActive({ textAlign: 'center' }) ? 'center' :
                      editor.isActive({ textAlign: 'right' }) ? 'right' :
                      editor.isActive({ textAlign: 'justify' }) ? 'justify' : 'left'
                    }
                    onChange={(val) => editor.chain().focus().setTextAlign(val).run()}
                    options={[
                      { label: 'Esquerda', value: 'left', icon: AlignLeft },
                      { label: 'Centro', value: 'center', icon: AlignCenter },
                      { label: 'Direita', value: 'right', icon: AlignRight },
                      { label: 'Justificado', value: 'justify', icon: AlignJustify },
                    ]}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Divisor */}
            <div className="w-[1px] h-3.5 bg-[var(--border)]/30 mx-0.5 shrink-0" />

            {/* GRUPO 5: LISTAS E LINKS */}
            <div className="flex items-center shrink-0">
              <CustomSelect 
                label="Listas"
                icon={
                  editor.isActive('taskList') ? CheckSquare :
                  editor.isActive('orderedList') ? ListOrdered : List
                }
                hideLabel={true}
                value={
                  editor.isActive('taskList') ? 'taskList' :
                  editor.isActive('orderedList') ? 'orderedList' :
                  editor.isActive('bulletList') ? 'bulletList' : ''
                }
                onChange={(val) => {
                  if (val === 'bulletList') editor.chain().focus().toggleBulletList().run();
                  else if (val === 'orderedList') editor.chain().focus().toggleOrderedList().run();
                  else if (val === 'taskList') editor.chain().focus().toggleTaskList().run();
                }}
                options={[
                  { label: 'Marcadores', value: 'bulletList', icon: List, isActive: editor.isActive('bulletList') },
                  { label: 'Numerada', value: 'orderedList', icon: ListOrdered, isActive: editor.isActive('orderedList') },
                  { label: 'Checklist', value: 'taskList', icon: CheckSquare, isActive: editor.isActive('taskList') },
                ]}
              />
              <AnimatePresence initial={false}>
                {isTier2Visible && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden flex items-center shrink-0 ml-0.5"
                  >
                    <ToolbarButton 
                      onClick={() => {
                        const url = window.prompt('URL externa:');
                        if (url) {
                          if (url === '') editor.chain().focus().unsetLink().run();
                          else editor.chain().focus().setLink({ href: url }).run();
                        }
                      }} 
                      isActive={editor.isActive('link')} 
                      title="Link Externo"
                    >
                      <LinkIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </ToolbarButton>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence initial={false}>
                {isTier3Visible && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden flex items-center shrink-0"
                  >
                    <ToolbarButton 
                      onClick={() => setNoteLinkModal(true)} 
                      isActive={false} 
                      title="Conectar Nota Interna"
                    >
                      <Layers className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[var(--accent)]" />
                    </ToolbarButton>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* GRUPO 6: INTELIGÊNCIA IA */}
            <AnimatePresence initial={false}>
              {isTier3Visible && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center shrink-0 overflow-hidden"
                >
                  <div className="w-[1px] h-3.5 bg-[var(--border)]/30 mx-0.5 shrink-0" />
                  <ToolbarButton 
                    onClick={() => setIsAiAutocompleteEnabled(!isAiAutocompleteEnabled)} 
                    isActive={isAiAutocompleteEnabled} 
                    title="Autocompletar com IA"
                  >
                    <Sparkles className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                  </ToolbarButton>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Indicador se gravação estiver ativa */}
            {(isRecording || isRecordingAudio) && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/10 border border-red-500/30 text-red-500 animate-pulse text-[9px] font-mono font-bold ml-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span>REC</span>
              </div>
            )}

            {/* Interim Text Indicator */}
            {isRecording && interimText && (
              <div className="flex items-center px-2 py-0.5 bg-black/5 dark:bg-white/5 border-l border-[var(--accent)] animate-in slide-in-from-left-2 shrink-0">
                <span className="text-[10px] italic opacity-40 truncate max-w-[140px]">{interimText}...</span>
              </div>
            )}
          </div>

          {/* Divisor antes do botão Mais Opções */}
          <div className="w-[1px] h-3.5 bg-[var(--border)]/30 mx-0.5 sm:mx-1 shrink-0" />

          {/* GRUPO 7: MAIS OPÇÕES (...) - FORA DA TRILHA DE OVERFLOW! */}
          <div className="relative flex items-center shrink-0">
            <button
              ref={moreButtonRef}
              onClick={(e) => {
                e.preventDefault();
                if (editorContainerRef.current) {
                  setContainerWidth(editorContainerRef.current.offsetWidth);
                }
                if (!isMobileMenuOpen && moreButtonRef.current) {
                  const rect = moreButtonRef.current.getBoundingClientRect();
                  setMoreCoords({
                    top: rect.bottom + 6,
                    left: Math.max(8, rect.right - 280),
                  });
                }
                setIsMobileMenuOpen(!isMobileMenuOpen);
              }}
              className={`w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-none transition-all relative shrink-0 ${
                isMobileMenuOpen 
                  ? 'bg-[var(--accent)] text-white shadow-sm' 
                  : 'hover:bg-[var(--muted)] text-[var(--foreground)] opacity-70 hover:opacity-100'
              }`}
              title="Mais Opções & Ferramentas"
            >
              <MoreHorizontal className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </button>

            {/* Menu Popover Desktop (apenas telas sm+) via Portal */}
            {typeof document !== 'undefined' && createPortal(
              <AnimatePresence>
                {isMobileMenuOpen && (
                  <div className="hidden sm:block">
                    <div 
                      className="fixed inset-0 z-[9990]" 
                      onClick={() => setIsMobileMenuOpen(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      style={{
                        position: 'fixed',
                        top: moreCoords.top,
                        left: moreCoords.left,
                      }}
                      className="z-[9999] bg-[var(--background)]/95 backdrop-blur-xl border border-[var(--border)] shadow-[8px_8px_0px_rgba(0,0,0,0.15)] rounded-none w-[280px] py-1.5 overflow-hidden flex flex-col"
                    >
                      {/* TIER 2: BLOCOS & FORMATAÇÃO TRANSBORDADOS (Visíveis quando a folha for < 480px) */}
                      <AnimatePresence initial={false}>
                        {!isTier2Visible && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden px-3 py-2 border-b border-[var(--border)]/10"
                          >
                            <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground block mb-1.5">Blocos & Formatação</span>
                            <div className="grid grid-cols-4 gap-1">
                              <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  editor.chain().focus().toggleUnderline().run();
                                }}
                                className={`py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 border transition-colors rounded-none ${
                                  editor.isActive('underline')
                                    ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                    : 'border-[var(--border)] text-[var(--foreground)] bg-[var(--muted)]/40 hover:bg-[var(--muted)]'
                                }`}
                                title="Sublinhado"
                              >
                                <UnderlineIcon className="w-3.5 h-3.5" />
                                <span>Subl.</span>
                              </button>

                              <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  editor.chain().focus().toggleBlockquote().run();
                                }}
                                className={`py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 border transition-colors rounded-none ${
                                  editor.isActive('blockquote')
                                    ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                    : 'border-[var(--border)] text-[var(--foreground)] bg-[var(--muted)]/40 hover:bg-[var(--muted)]'
                                }`}
                                title="Citação"
                              >
                                <Quote className="w-3.5 h-3.5" />
                                <span>Citar</span>
                              </button>

                              <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  editor.chain().focus().toggleCodeBlock().run();
                                }}
                                className={`py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 border transition-colors rounded-none ${
                                  editor.isActive('codeBlock')
                                    ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                    : 'border-[var(--border)] text-[var(--foreground)] bg-[var(--muted)]/40 hover:bg-[var(--muted)]'
                                }`}
                                title="Código"
                              >
                                <SquareCode className="w-3.5 h-3.5" />
                                <span>Código</span>
                              </button>

                              <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  const url = window.prompt('URL externa:');
                                  if (url) {
                                    if (url === '') editor.chain().focus().unsetLink().run();
                                    else editor.chain().focus().setLink({ href: url }).run();
                                  }
                                }}
                                className={`py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 border transition-colors rounded-none ${
                                  editor.isActive('link')
                                    ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                    : 'border-[var(--border)] text-[var(--foreground)] bg-[var(--muted)]/40 hover:bg-[var(--muted)]'
                                }`}
                                title="Link"
                              >
                                <LinkIcon className="w-3.5 h-3.5" />
                                <span>Link</span>
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* TIER 3: TIPOGRAFIA & CONEXÕES TRANSBORDADAS (Visíveis quando a folha for < 720px) */}
                      <AnimatePresence initial={false}>
                        {!isTier3Visible && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden"
                          >
                            {/* Fonte em Acordeão com Preview Real */}
                            <div className="px-3 py-2 border-b border-[var(--border)]/10 flex flex-col gap-1.5">
                              <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Fonte</span>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setIsPopoverFontExpanded(!isPopoverFontExpanded)}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 bg-[var(--muted)]/50 hover:bg-[var(--muted)] border border-[var(--border)]/30 transition-all rounded-none text-left"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <Type className="w-3.5 h-3.5 opacity-60 shrink-0" />
                                  <span 
                                    className="text-[11px] truncate"
                                    style={currentFont?.fontFamily ? { fontFamily: currentFont.fontFamily } : undefined}
                                  >
                                    {currentFont?.label || 'Inter'}
                                  </span>
                                  {currentFont?.category && (
                                    <span className="text-[7.5px] opacity-40 uppercase tracking-wider font-mono shrink-0">
                                      {currentFont.category}
                                    </span>
                                  )}
                                </div>
                                <ChevronDown className={`w-3 h-3 opacity-40 transition-transform shrink-0 ${isPopoverFontExpanded ? 'rotate-180' : ''}`} />
                              </button>

                              <AnimatePresence>
                                {isPopoverFontExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                    className="overflow-hidden border border-[var(--border)]/20 bg-[var(--background)] max-h-[170px] overflow-y-auto custom-scrollbar mt-0.5"
                                  >
                                    {FONT_OPTIONS.map((font) => {
                                      const isCurrent = currentFontFamily === font.value;
                                      return (
                                        <button
                                          key={font.value}
                                          type="button"
                                          onMouseDown={(e) => e.preventDefault()}
                                          onClick={() => {
                                            editor.chain().focus().setFontFamily(font.value).run();
                                            setIsPopoverFontExpanded(false);
                                          }}
                                          className={`w-full text-left px-3 py-1.5 text-[10px] flex items-center justify-between hover:bg-[var(--accent)] hover:text-white transition-colors group/font ${
                                            isCurrent ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-bold' : 'text-[var(--foreground)]'
                                          }`}
                                        >
                                          <div className="flex flex-col">
                                            <span className="text-[11px]" style={{ fontFamily: font.fontFamily }}>{font.label}</span>
                                            <span className="text-[7.5px] opacity-40 group-hover/font:text-white/80 uppercase tracking-wider font-mono">{font.category}</span>
                                          </div>
                                          {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] group-hover/font:bg-white" />}
                                        </button>
                                      );
                                    })}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Tamanho (Grade de Chips Numéricos) */}
                            <div className="px-3 py-2 border-b border-[var(--border)]/10 flex flex-col gap-1.5">
                              <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Tamanho</span>
                              <div className="grid grid-cols-4 gap-1">
                                {FONT_SIZES.map(size => {
                                  const isCurrent = (editor.getAttributes('textStyle').fontSize || '16px') === size;
                                  return (
                                    <button
                                      key={size}
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => editor.chain().focus().setFontSize(size).run()}
                                      className={`py-1 text-[10px] font-mono font-bold border transition-colors rounded-none ${
                                        isCurrent 
                                          ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs' 
                                          : 'border-[var(--border)]/30 bg-[var(--muted)]/40 hover:bg-[var(--muted)] text-[var(--foreground)]'
                                      }`}
                                    >
                                      {size.replace('px', '')}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Cor do Texto (Swatches Táteis) */}
                            <div className="px-3 py-2 border-b border-[var(--border)]/10 flex flex-col gap-1.5">
                              <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Cor do Texto</span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {COLOR_OPTIONS.map(c => {
                                  const activeColor = editor.getAttributes('textStyle').color || 'default';
                                  const isSelected = activeColor === c.value;
                                  return (
                                    <button
                                      key={c.value}
                                      type="button"
                                      title={c.label}
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => {
                                        if (c.value === 'default') editor.chain().focus().unsetColor().run();
                                        else editor.chain().focus().setColor(c.value).run();
                                      }}
                                      className={`w-5 h-5 rounded-full border transition-all flex items-center justify-center shrink-0 ${
                                        isSelected ? 'ring-2 ring-[var(--accent)] scale-110' : 'hover:scale-105 border-black/20'
                                      }`}
                                      style={{ backgroundColor: c.value === 'default' ? 'var(--foreground)' : c.color }}
                                    >
                                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Alinhamento (Segmented Control com Ícones) */}
                            <div className="px-3 py-2 border-b border-[var(--border)]/10 flex flex-col gap-1.5">
                              <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Alinhamento</span>
                              <div className="grid grid-cols-4 gap-1">
                                {ALIGNMENT_OPTIONS.map(item => {
                                  const isAlignActive = editor.isActive({ textAlign: item.value }) || (item.value === 'left' && !editor.isActive({ textAlign: 'center' }) && !editor.isActive({ textAlign: 'right' }) && !editor.isActive({ textAlign: 'justify' }));
                                  const ItemIcon = item.icon;
                                  return (
                                    <button
                                      key={item.value}
                                      type="button"
                                      title={item.label}
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => editor.chain().focus().setTextAlign(item.value).run()}
                                      className={`h-7 flex items-center justify-center border transition-colors rounded-none ${
                                        isAlignActive 
                                          ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs' 
                                          : 'border-[var(--border)]/30 bg-[var(--muted)]/40 hover:bg-[var(--muted)] text-[var(--foreground)]'
                                      }`}
                                    >
                                      <ItemIcon className="w-3.5 h-3.5" />
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Conectar Nota Interna */}
                            <div className="p-2 border-b border-[var(--border)]/10">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  setIsMobileMenuOpen(false);
                                  setNoteLinkModal(true);
                                }}
                                className="w-full px-3 py-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors rounded-none opacity-80"
                              >
                                <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
                                <span>Conectar Nota Interna</span>
                              </button>
                            </div>

                            {/* IA */}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                setIsAiAutocompleteEnabled(!isAiAutocompleteEnabled);
                                setIsMobileMenuOpen(false);
                              }}
                              className={`w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white transition-colors text-[var(--foreground)] flex items-center gap-2 border-b border-[var(--border)]/10 ${isAiAutocompleteEnabled ? 'bg-[var(--accent)]/5 text-[var(--accent)]' : ''}`}
                            >
                              <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                              <span>Autocompletar IA</span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Utilitários sempre presentes no desktop */}
                      <div className="flex flex-col">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setIsMobileMenuOpen(false);
                            toggleTranscription();
                          }}
                          className={`w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white transition-colors text-[var(--foreground)] flex items-center gap-2 ${isRecording ? 'bg-red-500/10 text-red-500 font-bold' : ''}`}
                        >
                          <Mic className="w-3.5 h-3.5 text-[var(--accent)]" />
                          <span>{isRecording ? "Parar Transcrição" : "Voz para Texto"}</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setIsMobileMenuOpen(false);
                            if (isRecordingAudio) stopAudioRecording();
                            else startAudioRecording();
                          }}
                          className={`w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white transition-colors text-[var(--foreground)] flex items-center gap-2 ${isRecordingAudio ? 'bg-red-500/10 text-red-500 font-bold' : ''}`}
                        >
                          <AudioLines className="w-3.5 h-3.5 text-[var(--accent)]" />
                          <span>{isRecordingAudio ? "Parar Gravação" : "Gravar Áudio"}</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setIsMobileMenuOpen(false);
                            editor.chain().focus().unsetAllMarks().clearNodes().run();
                          }}
                          className="w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white transition-colors text-[var(--foreground)] flex items-center gap-2 border-t border-[var(--border)]/10"
                        >
                          <Eraser className="w-3.5 h-3.5 opacity-60" />
                          <span>Limpar Formatação</span>
                        </button>

                        {/* Dica rápida de atalhos */}
                        <div className="px-4 py-2 bg-[var(--muted)]/20 border-t border-[var(--border)]/10 text-[8px] font-mono opacity-40 flex items-center justify-between">
                          <span>Ctrl+B, I, U, Z</span>
                          <span>Esc para fechar</span>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>,
              document.body
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Sheet Drawer via Portal (imune a qualquer overflow, z-index ou backdrop-blur) */}
      {isMounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isMobileMenuOpen && (
            <div className="sm:hidden fixed inset-0 z-[100] flex flex-col justify-end pointer-events-auto">
              {/* Backdrop Escuro com Blur */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              />

              {/* Drawer Inferior */}
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="relative z-10 bg-[var(--background)] border-t border-[var(--border)] shadow-2xl rounded-t-2xl max-h-[85vh] flex flex-col overflow-hidden pb-6"
              >
                {/* Cabeçalho da Gaveta */}
                <div className="w-full flex flex-col items-center pt-3 pb-2 border-b border-[var(--border)]/10 px-4">
                  <div className="w-10 h-1 rounded-full bg-[var(--foreground)]/20 mb-2" />
                  <div className="w-full flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--foreground)] opacity-70">
                      Ferramentas & Estilos
                    </span>
                    <button 
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="text-[11px] font-bold px-2.5 py-1 bg-[var(--muted)] text-[var(--foreground)] rounded-none hover:opacity-80 transition-opacity"
                    >
                      Fechar
                    </button>
                  </div>
                </div>

                {/* Conteúdo Rolável da Gaveta */}
                <div className="overflow-y-auto custom-scrollbar px-4 py-3 space-y-4">
                  {/* SEÇÃO 1: FORMATAÇÕES DE BLOCO & TEXTO */}
                  <div>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground block mb-1.5">Estilo Rápido</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        onClick={() => {
                          editor.chain().focus().toggleUnderline().run();
                        }}
                        className={`py-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 border transition-colors rounded-none ${
                          editor.isActive('underline')
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                            : 'border-[var(--border)] text-[var(--foreground)] bg-[var(--muted)]/40'
                        }`}
                      >
                        <UnderlineIcon className="w-3.5 h-3.5" />
                        <span>Subl.</span>
                      </button>

                      <button
                        onClick={() => {
                          editor.chain().focus().toggleBlockquote().run();
                        }}
                        className={`py-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 border transition-colors rounded-none ${
                          editor.isActive('blockquote')
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                            : 'border-[var(--border)] text-[var(--foreground)] bg-[var(--muted)]/40'
                        }`}
                      >
                        <Quote className="w-3.5 h-3.5" />
                        <span>Citar</span>
                      </button>

                      <button
                        onClick={() => {
                          editor.chain().focus().toggleCodeBlock().run();
                        }}
                        className={`py-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 border transition-colors rounded-none ${
                          editor.isActive('codeBlock')
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                            : 'border-[var(--border)] text-[var(--foreground)] bg-[var(--muted)]/40'
                        }`}
                      >
                        <SquareCode className="w-3.5 h-3.5" />
                        <span>Código</span>
                      </button>

                      <button
                        onClick={() => {
                          const url = window.prompt('URL externa:');
                          if (url) {
                            if (url === '') editor.chain().focus().unsetLink().run();
                            else editor.chain().focus().setLink({ href: url }).run();
                          }
                        }}
                        className={`py-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 border transition-colors rounded-none ${
                          editor.isActive('link')
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                            : 'border-[var(--border)] text-[var(--foreground)] bg-[var(--muted)]/40'
                        }`}
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>Link</span>
                      </button>
                    </div>
                  </div>

                  {/* SEÇÃO: LISTAS */}
                  <div>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground block mb-1.5">Listas</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => {
                          editor.chain().focus().toggleBulletList().run();
                        }}
                        className={`py-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 border transition-colors rounded-none ${
                          editor.isActive('bulletList')
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                            : 'border-[var(--border)] text-[var(--foreground)] bg-[var(--muted)]/40'
                        }`}
                      >
                        <List className="w-3.5 h-3.5" />
                        <span>Marcadores</span>
                      </button>

                      <button
                        onClick={() => {
                          editor.chain().focus().toggleOrderedList().run();
                        }}
                        className={`py-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 border transition-colors rounded-none ${
                          editor.isActive('orderedList')
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                            : 'border-[var(--border)] text-[var(--foreground)] bg-[var(--muted)]/40'
                        }`}
                      >
                        <ListOrdered className="w-3.5 h-3.5" />
                        <span>Numerada</span>
                      </button>

                      <button
                        onClick={() => {
                          editor.chain().focus().toggleTaskList().run();
                        }}
                        className={`py-2 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 border transition-colors rounded-none ${
                          editor.isActive('taskList')
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                            : 'border-[var(--border)] text-[var(--foreground)] bg-[var(--muted)]/40'
                        }`}
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>Checklist</span>
                      </button>
                    </div>
                  </div>

                  {/* SEÇÃO 2: TIPOGRAFIA (FONTE E TAMANHO) */}
                  <div className="flex flex-col gap-3">
                    {/* Fonte em Acordeão */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Fonte</span>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setIsMobileFontExpanded(!isMobileFontExpanded)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-[var(--muted)]/50 hover:bg-[var(--muted)] border border-[var(--border)]/30 transition-all rounded-none text-left"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Type className="w-3.5 h-3.5 opacity-60 shrink-0" />
                          <span 
                            className="text-xs truncate"
                            style={currentFont?.fontFamily ? { fontFamily: currentFont.fontFamily } : undefined}
                          >
                            {currentFont?.label || 'Inter'}
                          </span>
                          {currentFont?.category && (
                            <span className="text-[8px] opacity-40 uppercase tracking-wider font-mono shrink-0">
                              {currentFont.category}
                            </span>
                          )}
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 opacity-40 transition-transform shrink-0 ${isMobileFontExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {isMobileFontExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden border border-[var(--border)]/20 bg-[var(--background)] max-h-[190px] overflow-y-auto custom-scrollbar mt-0.5"
                          >
                            {FONT_OPTIONS.map((font) => {
                              const isCurrent = currentFontFamily === font.value;
                              return (
                                <button
                                  key={font.value}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    editor.chain().focus().setFontFamily(font.value).run();
                                    setIsMobileFontExpanded(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-[var(--accent)] hover:text-white transition-colors group/font ${
                                    isCurrent ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-bold' : 'text-[var(--foreground)]'
                                  }`}
                                >
                                  <div className="flex flex-col">
                                    <span className="text-xs" style={{ fontFamily: font.fontFamily }}>{font.label}</span>
                                    <span className="text-[7.5px] opacity-40 group-hover/font:text-white/80 uppercase tracking-wider font-mono">{font.category}</span>
                                  </div>
                                  {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] group-hover/font:bg-white" />}
                                </button>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Tamanho (Grade de Chips Numéricos) */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Tamanho</span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {FONT_SIZES.map(size => {
                          const isCurrent = (editor.getAttributes('textStyle').fontSize || '16px') === size;
                          return (
                            <button
                              key={size}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => editor.chain().focus().setFontSize(size).run()}
                              className={`py-1.5 text-xs font-mono font-bold border transition-colors rounded-none ${
                                isCurrent 
                                  ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs' 
                                  : 'border-[var(--border)]/30 bg-[var(--muted)]/40 hover:bg-[var(--muted)] text-[var(--foreground)]'
                              }`}
                            >
                              {size.replace('px', '')}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* SEÇÃO 3: COR E ALINHAMENTO */}
                  <div className="flex flex-col gap-3">
                    {/* Cor do Texto (Swatches Táteis) */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Cor do Texto</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {COLOR_OPTIONS.map(c => {
                          const activeColor = editor.getAttributes('textStyle').color || 'default';
                          const isSelected = activeColor === c.value;
                          return (
                            <button
                              key={c.value}
                              type="button"
                              title={c.label}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                if (c.value === 'default') editor.chain().focus().unsetColor().run();
                                else editor.chain().focus().setColor(c.value).run();
                              }}
                              className={`w-6 h-6 rounded-full border transition-all flex items-center justify-center shrink-0 ${
                                isSelected ? 'ring-2 ring-[var(--accent)] scale-110' : 'hover:scale-105 border-black/20'
                              }`}
                              style={{ backgroundColor: c.value === 'default' ? 'var(--foreground)' : c.color }}
                            >
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Alinhamento (Segmented Control com Ícones) */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Alinhamento</span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {ALIGNMENT_OPTIONS.map(item => {
                          const isAlignActive = editor.isActive({ textAlign: item.value }) || (item.value === 'left' && !editor.isActive({ textAlign: 'center' }) && !editor.isActive({ textAlign: 'right' }) && !editor.isActive({ textAlign: 'justify' }));
                          const ItemIcon = item.icon;
                          return (
                            <button
                              key={item.value}
                              type="button"
                              title={item.label}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => editor.chain().focus().setTextAlign(item.value).run()}
                              className={`h-8 flex items-center justify-center border transition-colors rounded-none ${
                                isAlignActive 
                                  ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs' 
                                  : 'border-[var(--border)]/30 bg-[var(--muted)]/40 hover:bg-[var(--muted)] text-[var(--foreground)]'
                              }`}
                            >
                              <ItemIcon className="w-4 h-4" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* SEÇÃO 4: CONEXÃO DE NOTA & IA */}
                  <div className="space-y-2 pt-1 border-t border-[var(--border)]/10">
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setNoteLinkModal(true);
                      }}
                      className="w-full py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-[var(--border)] text-[var(--foreground)] bg-[var(--muted)]/40 hover:bg-[var(--muted)] transition-colors rounded-none"
                    >
                      <Layers className="w-4 h-4 text-[var(--accent)]" />
                      <span>Conectar Nota Interna</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsAiAutocompleteEnabled(!isAiAutocompleteEnabled);
                      }}
                      className={`w-full py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 border transition-colors rounded-none ${
                        isAiAutocompleteEnabled 
                          ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]' 
                          : 'border-[var(--border)] text-[var(--foreground)] bg-[var(--muted)]/40'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                      <span>{isAiAutocompleteEnabled ? "IA Ativada (Autocompletar)" : "Ativar IA (Autocompletar)"}</span>
                    </button>
                  </div>

                  {/* SEÇÃO 5: FERRAMENTAS UTILITÁRIAS */}
                  <div className="space-y-2 pt-1 border-t border-[var(--border)]/10">
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        toggleTranscription();
                      }}
                      className={`w-full py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 border transition-colors rounded-none ${
                        isRecording 
                          ? 'bg-red-500/10 text-red-500 border-red-500/30 font-bold' 
                          : 'border-[var(--border)] text-[var(--foreground)] bg-[var(--muted)]/40'
                      }`}
                    >
                      <Mic className="w-4 h-4 text-[var(--accent)]" />
                      <span>{isRecording ? "Parar Transcrição" : "Voz para Texto"}</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        if (isRecordingAudio) stopAudioRecording();
                        else startAudioRecording();
                      }}
                      className={`w-full py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 border transition-colors rounded-none ${
                        isRecordingAudio 
                          ? 'bg-red-500/10 text-red-500 border-red-500/30 font-bold' 
                          : 'border-[var(--border)] text-[var(--foreground)] bg-[var(--muted)]/40'
                      }`}
                    >
                      <AudioLines className="w-4 h-4 text-[var(--accent)]" />
                      <span>{isRecordingAudio ? "Parar Gravação" : "Gravar Áudio"}</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        editor.chain().focus().unsetAllMarks().clearNodes().run();
                      }}
                      className="w-full py-2.5 px-3 text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 border border-[var(--border)] text-[var(--foreground)] bg-[var(--muted)]/40 hover:bg-[var(--muted)] transition-colors rounded-none"
                    >
                      <Eraser className="w-4 h-4 opacity-60" />
                      <span>Limpar Formatação</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

    <div className="flex-1 px-8 md:px-16 lg:px-24 py-8 relative">
      <EditorContent editor={editor} />
      
      {/* Neural Suggestion Toast */}
      <AnimatePresence>
        {neuralSuggestion && (
          <motion.div
            initial={{ opacity: 0, x: 20, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed bottom-24 right-8 z-40 max-w-xs"
          >
            <div className="bg-[var(--background)]/90 backdrop-blur-xl border-l-4 border-[var(--accent)] p-4 shadow-[15px_15px_30px_rgba(0,0,0,0.1)] border border-[var(--border)] group">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse" />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mb-1">Conexão Neural ({neuralSuggestion.score}%)</p>
                  <p className="text-sm font-sans font-medium mb-3 leading-tight">
                    Esta nota tem forte relação com <span className="font-bold">&quot;{neuralSuggestion.title}&quot;</span>.
                  </p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        editor.chain().focus().insertContent(`<br><a href="/?note=${neuralSuggestion.id}" class="internal-link" data-internal-note-id="${neuralSuggestion.id}">${neuralSuggestion.title}</a> `).run();
                        setIgnoredSuggestions(prev => new Set(prev).add(neuralSuggestion.id));
                        setNeuralSuggestion(null);
                      }}
                      className="text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 bg-[var(--accent)] text-white hover:opacity-90 transition-all"
                    >
                      Criar Link
                    </button>
                    <button 
                      onClick={() => {
                        setIgnoredSuggestions(prev => new Set(prev).add(neuralSuggestion.id));
                        setNeuralSuggestion(null);
                      }}
                      className="text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 hover:bg-[var(--muted)] transition-all opacity-40 hover:opacity-100"
                    >
                      Ignorar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

      {/* Transcription Status Modal */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-3"
          >
            <div className="bg-black/90 dark:bg-white/90 text-white dark:text-black px-6 py-4 rounded-none border border-[var(--accent)] shadow-[20px_20px_0px_rgba(0,0,0,0.2)] flex items-center gap-4 min-w-[300px]">
              <div className="relative">
                <div className="w-10 h-10 bg-[var(--accent)] flex items-center justify-center rounded-none animate-pulse">
                  <Mic className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50 mb-1">Neural Listening</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-sm font-sans font-medium truncate max-w-[200px]">{interimText || 'Ouvindo seus pensamentos...'}</p>
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            </div>
            <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 bg-black/5 dark:bg-white/5 px-2 py-1">Diga &quot;ponto final&quot; ou &quot;nova linha&quot; para formatar</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Paste Choice Modal */}
      {pasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--background)] rounded-none shadow-2xl p-8 max-w-md w-full border border-[var(--border)] animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-sans font-bold mb-4 tracking-tight text-[var(--foreground)]">Como deseja colar?</h3>
            <p className="text-sm text-[var(--foreground)]/60 mb-8 leading-relaxed">
              O conteúdo copiado possui formatação original. Escolha como deseja integrá-lo à sua nota.
            </p>
            <div className="grid gap-3">
              <button 
                onClick={() => handlePasteChoice(false)}
                className="w-full py-4 px-6 bg-[var(--accent)] text-[var(--accent-foreground)] rounded-none font-bold uppercase text-[11px] tracking-widest hover:opacity-90 transition-all flex items-center justify-between group"
              >
                Limpar Formatação
                <span className="opacity-40 group-hover:opacity-100 transition-opacity text-[var(--accent-foreground)]">Ajustar ao estilo atual</span>
              </button>
              <button 
                onClick={() => handlePasteChoice(true)}
                className="w-full py-4 px-6 bg-transparent text-[var(--foreground)] border border-[var(--border)] rounded-none font-bold uppercase text-[11px] tracking-widest hover:bg-[var(--muted)] transition-all flex items-center justify-between group"
              >
                Manter Original
                <span className="opacity-40 group-hover:opacity-100 transition-opacity">Preservar estilo externo</span>
              </button>
              <button 
                onClick={() => setPasteModal(null)}
                className="mt-2 text-[10px] uppercase font-bold tracking-widest text-[var(--foreground)]/20 hover:text-[var(--foreground)] transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Note Link Modal */}
      <AnimatePresence>
        {noteLinkModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNoteLinkModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-[var(--background)] border border-[var(--border)] p-8 shadow-[30px_30px_0px_rgba(0,0,0,0.1)]"
            >
              <h3 className="text-xl font-sans font-bold mb-2 tracking-tight">Conectar Nota Neural</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-6">Selecione uma nota para criar um backlink</p>
              
              <input 
                autoFocus
                type="text"
                placeholder="Buscar nota pelo título..."
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                className="w-full bg-[var(--muted)] border-none px-4 py-3 text-sm font-sans font-medium mb-6 focus:ring-1 focus:ring-[var(--accent)] outline-none"
              />

              <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-2 space-y-2">
                {notes
                  .filter(n => n.title.toLowerCase().includes(noteSearch.toLowerCase()))
                  .map(n => (
                    <button
                      key={n.id}
                      onClick={() => {
                        editor.chain().focus().insertContent(`<a href="/?note=${n.id}" class="internal-link" data-internal-note-id="${n.id}">${n.title || 'Sem título'}</a> `).run();
                        setNoteLinkModal(false);
                        setNoteSearch('');
                      }}
                      className="w-full p-4 text-left border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all group"
                    >
                      <p className="text-sm font-sans font-semibold group-hover:text-[var(--accent)]">{n.title || 'Sem título'}</p>
                      <p className="text-[9px] opacity-30 mt-1 uppercase font-bold">{n.tags?.join(' · ') || 'Sem tags'}</p>
                    </button>
                  ))
                }
              </div>

              <button
                onClick={() => setNoteLinkModal(false)}
                className="mt-6 w-full py-4 text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
              >
                Cancelar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Audio Recording Status Panel */}
      <AnimatePresence>
        {isRecordingAudio && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-3"
          >
            <div className="bg-black/90 dark:bg-white/90 text-white dark:text-black px-6 py-4 rounded-none border border-[#FF4F00] shadow-[20px_20px_0px_rgba(0,0,0,0.2)] flex items-center gap-4 min-w-[320px]">
              <div className="relative">
                <div className="w-10 h-10 bg-[#FF4F00] flex items-center justify-center rounded-none animate-pulse">
                  <AudioLines className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50 mb-1">Gravando Áudio IA</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-sm font-mono font-bold">{formatDuration(recordingAudioDuration)}</p>
                  <span className="flex gap-0.5 ml-2">
                    <span className="w-1 h-1 bg-[#FF4F00] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 bg-[#FF4F00] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 bg-[#FF4F00] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
              <button
                onClick={stopAudioRecording}
                className="px-4 py-2 bg-[#FF4F00] hover:bg-[#FF4F00]/90 text-white text-[10px] font-bold uppercase tracking-widest transition-colors"
              >
                Parar
              </button>
            </div>
            <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 bg-black/5 dark:bg-white/5 px-2 py-1">O áudio ficará temporariamente na memória</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio Review & Processing Modal */}
      <AnimatePresence>
        {showAudioProcessingModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => handleDeleteAudio(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-[var(--background)] border border-[var(--border)] p-8 shadow-[30px_30px_0px_rgba(0,0,0,0.1)] max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <h3 className="text-xl font-sans font-bold mb-2 tracking-tight">Processar Gravação de Áudio</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-6">Revise o áudio gravado e selecione o formato do relatório</p>

              {/* Styled Audio Player */}
              <div className="bg-[var(--muted)] p-4 border border-[var(--border)] flex items-center justify-between gap-4 mb-6 rounded-none">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (audioPlayerRef.current) {
                        if (isPlayingAudio) {
                          audioPlayerRef.current.pause();
                        } else {
                          audioPlayerRef.current.play();
                        }
                      }
                    }}
                    className="w-10 h-10 bg-[#FF4F00] text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform rounded-none shadow-[2px_2px_0px_rgba(0,0,0,0.15)]"
                  >
                    {isPlayingAudio ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                  </button>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Áudio Gravado</p>
                    <p className="text-xs font-semibold">{formatDuration(recordingAudioDuration || 0)}</p>
                  </div>
                </div>
                <audio ref={audioPlayerRef} src={audioUrl || ''} className="hidden" />
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-2 py-1 flex items-center gap-1.5">
                  <Volume2 size={12} /> Pronto para Revisão
                </div>
              </div>

              {/* Format Selection Grid */}
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-40 mb-3">Escolha o formato de processamento pela IA</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {(['transcribe', 'meeting_minutes', 'email', 'summary', 'tasks'] as const).map((fmt) => {
                  const labels = {
                    transcribe: 'Transcrição Simples',
                    meeting_minutes: 'Ata de Reunião',
                    email: 'E-mail para Cliente',
                    summary: 'Resumo Executivo',
                    tasks: 'Extrair Tarefas'
                  };
                  const descs = {
                    transcribe: 'Transcreve o áudio exatamente como falado.',
                    meeting_minutes: 'Gera uma ata estruturada com decisões.',
                    email: 'Redige um e-mail profissional baseado na fala.',
                    summary: 'Cria um resumo conciso com pontos principais.',
                    tasks: 'Extrai compromissos e tarefas como checklist.'
                  };
                  return (
                    <button
                      key={fmt}
                      onClick={() => setSelectedAudioFormat(fmt)}
                      className={`p-3 text-left border rounded-none transition-all flex flex-col ${selectedAudioFormat === fmt ? 'border-[#FF4F00] bg-[#FF4F00]/5 shadow-[3px_3px_0px_rgba(255,79,0,0.15)]' : 'border-[var(--border)] hover:bg-[var(--muted)]/50'}`}
                    >
                      <span className="text-xs font-bold uppercase tracking-wider">{labels[fmt]}</span>
                      <span className="text-[9px] opacity-60 mt-1 leading-snug">{descs[fmt]}</span>
                    </button>
                  );
                })}
              </div>

              {/* Error State */}
              {audioProcessingError && (
                <div className="p-4 mb-6 border-2 border-red-500 bg-red-50 text-red-600 text-xs font-bold uppercase tracking-wide">
                  {audioProcessingError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  disabled={isProcessingAudio}
                  onClick={handleProcessAudio}
                  className="flex-1 py-4 bg-black dark:bg-white text-white dark:text-black hover:bg-[#FF4F00] dark:hover:bg-[#FF4F00] hover:text-white dark:hover:text-white font-bold uppercase text-xs tracking-widest transition-all shadow-[4px_4px_0px_rgba(0,0,0,0.1)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isProcessingAudio ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Processando com Gemini...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Processar Áudio
                    </>
                  )}
                </button>
                <button
                  disabled={isProcessingAudio}
                  onClick={() => handleDeleteAudio(false)}
                  className="py-4 px-6 bg-transparent text-red-500 border border-red-500/20 hover:border-red-500 hover:bg-red-500/5 font-bold uppercase text-xs tracking-widest transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={16} />
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Audio Deletion Confirmation Modal */}
      <AnimatePresence>
        {showAudioDeleteConfirmModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-[var(--background)] border border-[var(--border)] p-6 shadow-[15px_15px_0px_rgba(0,0,0,0.15)] rounded-none z-[130]"
            >
              <h4 className="text-lg font-bold uppercase tracking-wide mb-2 text-red-500">Excluir Gravação?</h4>
              <p className="text-xs text-[var(--foreground)]/70 mb-6 leading-relaxed">
                Tem certeza de que deseja descartar este áudio? Esta ação é irreversível e o áudio gravado temporariamente será perdido.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleDeleteAudio(true)}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold uppercase text-[10px] tracking-widest transition-colors shadow-[2px_2px_0px_rgba(0,0,0,0.1)]"
                >
                  Sim, Excluir
                </button>
                <button
                  onClick={() => setShowAudioDeleteConfirmModal(false)}
                  className="flex-1 py-3 bg-[var(--muted)] hover:bg-[var(--border)] text-[var(--foreground)] font-bold uppercase text-[10px] tracking-widest transition-colors border border-[var(--border)] shadow-[2px_2px_0px_rgba(0,0,0,0.1)]"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
