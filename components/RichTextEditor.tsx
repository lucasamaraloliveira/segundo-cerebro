'use client';

import { useState, useEffect, useRef } from 'react';
import { Extension } from '@tiptap/core';
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
  Sparkles
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
}


// Sub-components moved outside to avoid re-definition and state loss on render
const ToolbarButton = ({ 
  onClick, 
  isActive = false, 
  children, 
  title 
}: { 
  onClick: () => void; 
  isActive?: boolean; 
  children: React.ReactNode;
  title: string;
}) => (
  <button
    onClick={(e) => {
      e.preventDefault();
      onClick();
    }}
    title={title}
    className={`p-1.5 md:p-1 rounded-full transition-all relative shrink-0 ${
      isActive 
        ? 'bg-[var(--accent)] text-white shadow-md' 
        : 'hover:bg-[var(--muted)] text-[var(--foreground)] opacity-70 hover:opacity-100 hover:scale-105 active:scale-95'
    }`}
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
  label 
}: { 
  icon: any, 
  value?: string, 
  onChange: (val: string) => void, 
  options: { label: string, value: string, isActive?: boolean }[],
  label: string
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selectedLabel = options.find(opt => opt.value === value)?.label || label;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--muted)]/50 text-[var(--foreground)] border border-[var(--border)]/10 hover:border-[var(--accent)]/50 transition-all group ${isOpen ? 'ring-1 ring-[var(--accent)] border-[var(--accent)]/50' : ''}`}
      >
        <Icon className="w-3.5 h-3.5 md:w-3 md:h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
        <span className="text-[9px] md:text-[8px] font-bold uppercase tracking-wider truncate max-w-[40px] md:max-w-[45px]">
          {selectedLabel}
        </span>
        <ChevronDown className={`w-2.5 h-2.5 ml-auto opacity-20 group-hover:opacity-100 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-[60]" 
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }} 
            />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.95 }}
              className="absolute top-full left-0 mt-2 z-[70] bg-[var(--background)]/95 backdrop-blur-xl border border-[var(--border)] shadow-[0_10px_40px_rgba(0,0,0,0.2)] rounded-2xl min-w-[180px] py-1.5 overflow-hidden"
            >
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                {options.map(opt => (
                  <button
                    key={opt.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(opt.value);
                      setIsOpen(false); 
                    }}
                    className={`w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white transition-colors text-[var(--foreground)] flex items-center justify-between ${opt.isActive || value === opt.value ? 'bg-[var(--accent)]/5 text-[var(--accent)]' : ''}`}
                  >
                    <span>{opt.label}</span>
                    {(opt.isActive || value === opt.value) && <div className="w-1 h-1 bg-[var(--accent)] rounded-full" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function RichTextEditor({ content, onChange, placeholder, isFocusMode = false, notes = [], activeNoteId }: RichTextEditorProps) {
  const [pasteModal, setPasteModal] = useState<{ show: boolean, text: string, html: string } | null>(null);
  const [noteLinkModal, setNoteLinkModal] = useState(false);
  const [noteSearch, setNoteSearch] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<any>(null);
  const [neuralSuggestion, setNeuralSuggestion] = useState<{ id: string, title: string, score: number } | null>(null);
  const [ignoredSuggestions, setIgnoredSuggestions] = useState<Set<string>>(new Set());
  const lastAnalyzedText = useRef('');

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
    <div className="flex flex-col w-full relative">
      {/* Modern Floating Command Dock - Evaluation: Minimalist & Pro */}
      <div className="sticky top-4 z-50 flex justify-center w-full pointer-events-none">
        <div className="pointer-events-auto bg-[var(--background)]/80 backdrop-blur-xl border border-[var(--border)] shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)] rounded-full px-3 py-1.5 flex items-center gap-0.5 max-w-[95vw] md:max-w-full overflow-x-auto md:overflow-visible no-scrollbar transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
        <div className="flex items-center mr-1">
          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Desfazer">
            <Undo className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Refazer">
            <Redo className="w-3.5 h-3.5" />
          </ToolbarButton>
        </div>

        <div className="flex items-center mr-1 bg-[var(--muted)]/10 rounded-full px-0.5 py-0.5">
          <ToolbarButton 
            onClick={() => editor.chain().focus().toggleBold().run()} 
            isActive={editor.isActive('bold')} 
            title="Negrito"
          >
            <Bold className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton 
            onClick={() => editor.chain().focus().toggleItalic().run()} 
            isActive={editor.isActive('italic')} 
            title="Itálico"
          >
            <Italic className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton 
            onClick={() => editor.chain().focus().toggleUnderline().run()} 
            isActive={editor.isActive('underline')} 
            title="Sublinhado"
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </ToolbarButton>
        </div>

        {isFocusMode && (
          <div className="hidden md:flex items-center gap-1 mr-1 animate-in fade-in slide-in-from-left-2 duration-300">
            <CustomSelect 
              label="Fonte"
              icon={Type}
              value={
                editor.isActive('textStyle', { fontFamily: 'Inter' }) ? 'Inter' :
                editor.isActive('textStyle', { fontFamily: 'Playfair Display' }) ? 'Playfair' :
                editor.isActive('textStyle', { fontFamily: 'Georgia' }) ? 'Georgia' :
                editor.isActive('textStyle', { fontFamily: 'monospace' }) ? 'Mono' : ''
              }
              onChange={(val) => editor.chain().focus().setFontFamily(val).run()}
              options={[
                { label: 'Inter', value: 'Inter' },
                { label: 'Playfair', value: 'Playfair Display' },
                { label: 'Georgia', value: 'Georgia' },
                { label: 'Monospace', value: 'monospace' },
              ]}
            />
            <CustomSelect 
              label="Tamanho"
              icon={Type}
              value={editor.getAttributes('textStyle').fontSize || '16px'}
              onChange={(val) => editor.chain().focus().setFontSize(val).run()}
              options={[
                { label: '12px', value: '12px' },
                { label: '14px', value: '14px' },
                { label: '16px', value: '16px' },
                { label: '18px', value: '18px' },
                { label: '20px', value: '20px' },
                { label: '24px', value: '24px' },
                { label: '30px', value: '30px' },
                { label: '36px', value: '36px' },
              ]}
            />
            <CustomSelect 
              label="Cor"
              icon={Palette}
              value={editor.getAttributes('textStyle').color || 'Padrão'}
              onChange={(val) => {
                if (val === 'default') editor.chain().focus().unsetColor().run();
                else editor.chain().focus().setColor(val).run();
              }}
              options={[
                { label: 'Padrão', value: 'default' },
                { label: 'Preto', value: '#000000' },
                { label: 'Cinza', value: '#666666' },
                { label: 'Vermelho', value: '#EF4444' },
                { label: 'Laranja', value: '#F97316' },
                { label: 'Amarelo', value: '#EAB308' },
                { label: 'Verde', value: '#22C55E' },
                { label: 'Azul', value: '#3B82F6' },
                { label: 'Roxo', value: '#A855F7' },
              ]}
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleBlockquote().run()} 
              isActive={editor.isActive('blockquote')} 
              title="Citação"
            >
              <Quote className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleCodeBlock().run()} 
              isActive={editor.isActive('codeBlock')} 
              title="Bloco de Código"
            >
              <SquareCode className="w-3.5 h-3.5" />
            </ToolbarButton>
          </div>
        )}

        <div className="flex items-center mr-1">
          <ToolbarButton 
            onClick={() => editor.chain().focus().toggleBulletList().run()} 
            isActive={editor.isActive('bulletList')} 
            title="Lista"
          >
            <List className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton 
            onClick={() => editor.chain().focus().toggleTaskList().run()} 
            isActive={editor.isActive('taskList')} 
            title="Tarefas"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </ToolbarButton>
          {isFocusMode && (
            <>
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
                <LinkIcon className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton 
                onClick={() => setNoteLinkModal(true)} 
                isActive={false} 
                title="Conectar Nota"
              >
                <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
              </ToolbarButton>
            </>
          )}
        </div>

        {isFocusMode && (
          <div className="hidden md:flex items-center mr-1 animate-in fade-in slide-in-from-left-2 duration-300">
            <CustomSelect 
              label="Alinhar"
              icon={AlignLeft}
              value={
                editor.isActive({ textAlign: 'left' }) ? 'left' :
                editor.isActive({ textAlign: 'center' }) ? 'center' :
                editor.isActive({ textAlign: 'right' }) ? 'right' :
                editor.isActive({ textAlign: 'justify' }) ? 'justify' : 'left'
              }
              onChange={(val) => editor.chain().focus().setTextAlign(val).run()}
              options={[
                { label: 'Esquerda', value: 'left' },
                { label: 'Centro', value: 'center' },
                { label: 'Direita', value: 'right' },
                { label: 'Justificado', value: 'justify' },
              ]}
            />
          </div>
        )}

        <div className="flex items-center gap-0.5">
          <ToolbarButton 
            onClick={() => setIsAiAutocompleteEnabled(!isAiAutocompleteEnabled)} 
            isActive={isAiAutocompleteEnabled} 
            title="Autocompletar com IA"
          >
            <Sparkles className="w-3.5 h-3.5" />
          </ToolbarButton>
          <button
            onClick={toggleTranscription}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-[var(--muted)] text-[var(--foreground)] opacity-60'}`}
            title="Voz para Texto"
          >
            <Mic className="w-3.5 h-3.5" />
          </button>
          <ToolbarButton onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Limpar">
            <Eraser className="w-3.5 h-3.5" />
          </ToolbarButton>
        </div>

        {/* Interim Text Indicator */}
        {isRecording && interimText && (
          <div className="flex items-center px-3 py-1 bg-black/5 dark:bg-white/5 border-l border-[var(--accent)] animate-in slide-in-from-left-2">
            <span className="text-[10px] italic opacity-40 truncate max-w-[200px]">{interimText}...</span>
          </div>
        )}

        {/* Scroll Buffer */}
        <div className="w-8 flex-shrink-0 h-1" />
      </div>
    </div>

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
                  <p className="text-sm font-serif italic mb-3 leading-tight">
                    Esta nota tem forte relação com <span className="font-bold">"{neuralSuggestion.title}"</span>.
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
                  <p className="text-sm font-serif italic truncate max-w-[200px]">{interimText || 'Ouvindo seus pensamentos...'}</p>
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            </div>
            <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 bg-black/5 dark:bg-white/5 px-2 py-1">Diga "ponto final" ou "nova linha" para formatar</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Paste Choice Modal */}
      {pasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--background)] rounded-none shadow-2xl p-8 max-w-md w-full border border-[var(--border)] animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-serif mb-4 tracking-tight text-[var(--foreground)]">Como deseja colar?</h3>
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
              <h3 className="text-2xl font-serif mb-2 tracking-tight">Conectar Nota Neural</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-6">Selecione uma nota para criar um backlink</p>
              
              <input 
                autoFocus
                type="text"
                placeholder="Buscar nota pelo título..."
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                className="w-full bg-[var(--muted)] border-none px-4 py-3 text-sm font-serif italic mb-6 focus:ring-1 focus:ring-[var(--accent)] outline-none"
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
                      <p className="text-sm font-serif italic group-hover:text-[var(--accent)]">{n.title || 'Sem título'}</p>
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
    </div>
  );
}
