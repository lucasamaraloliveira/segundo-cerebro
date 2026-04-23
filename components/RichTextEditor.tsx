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
import { motion, AnimatePresence } from 'motion/react';
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
  Mic
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

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  isFocusMode?: boolean;
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
    className={`p-2 md:p-1.5 rounded-none transition-all relative shrink-0 ${
      isActive 
        ? 'bg-[var(--accent)] text-white' 
        : 'hover:bg-[var(--muted)] text-[var(--foreground)] opacity-60 hover:opacity-100'
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
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selectedLabel = options.find(opt => opt.value === value)?.label || label;

  const toggleDropdown = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className="flex items-center gap-1 px-2 py-1.5 rounded-none bg-[var(--muted)]/30 text-[var(--foreground)] border border-[var(--border)]/10 hover:border-[var(--accent)] transition-all min-w-[75px] md:min-w-[80px]"
      >
        <Icon className="w-3.5 h-3.5 md:w-3 md:h-3 opacity-60" />
        <span className="text-[9px] md:text-[8px] font-bold uppercase tracking-widest truncate max-w-[45px] md:max-w-[55px]">
          {selectedLabel}
        </span>
        <ChevronDown className="w-3 h-3 ml-auto opacity-30" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
          <div 
            style={{ 
              position: 'fixed',
              top: `${coords.top - window.scrollY + 4}px`, 
              left: `${coords.left - window.scrollX}px`,
            }}
            className="z-[70] bg-[var(--sidebar-bg)] border border-[var(--border)] shadow-[4px_4px_0px_rgba(0,0,0,0.2)] min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
          >
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  if (!opt.isActive) setIsOpen(false); // Only close if it's not a toggle-style option or we want standard behavior
                  setIsOpen(false); 
                }}
                className={`w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white transition-colors text-[var(--foreground)] ${opt.isActive || value === opt.value ? 'bg-[var(--muted)] border-l-4 border-[var(--accent)]' : ''}`}
              >
                <div className="flex items-center justify-between">
                  {opt.label}
                  {(opt.isActive || value === opt.value) && <div className="w-1 h-1 bg-[var(--accent)] rounded-full" />}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default function RichTextEditor({ content, onChange, placeholder, isFocusMode = false }: RichTextEditorProps) {
  const [pasteModal, setPasteModal] = useState<{ show: boolean, text: string, html: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<any>(null);

  const editor = useEditor({
    extensions: [
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
    ],
    content: content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm md:prose-base xl:prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[500px] font-sans',
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

  // Update editor attributes when font changes
  useEffect(() => {
    if (editor) {
        editor.setOptions({
          editorProps: {
            attributes: {
              class: 'prose prose-sm md:prose-base xl:prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[500px] font-sans',
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

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;

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

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-col w-full">
      {/* Toolbar Console */}
      <div className="bg-[var(--sidebar-bg)] border-b border-[var(--border)] sticky top-0 z-30 touch-pan-y overflow-hidden">
        <div className="flex flex-nowrap items-center justify-start gap-x-1 p-1.5 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x">
        <ToolbarGroup label="EDIT">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            title="Desfazer"
          >
            <Undo className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            title="Refazer"
          >
            <Redo className="w-3.5 h-3.5" />
          </ToolbarButton>
        </ToolbarGroup>

        <ToolbarGroup label="TEXT">
          <CustomSelect 
            label="Formato"
            icon={Type}
            onChange={(val) => {
              if (val === 'bold') editor.chain().focus().toggleBold().run();
              if (val === 'italic') editor.chain().focus().toggleItalic().run();
              if (val === 'underline') editor.chain().focus().toggleUnderline().run();
            }}
            options={[
              { label: 'Negrito', value: 'bold', isActive: editor.isActive('bold') },
              { label: 'Itálico', value: 'italic', isActive: editor.isActive('italic') },
              { label: 'Sublinhado', value: 'underline', isActive: editor.isActive('underline') },
            ]}
          />
        </ToolbarGroup>
        
        <ToolbarGroup label="STRUCT">
          <CustomSelect 
            label="Estilo"
            icon={Heading1}
            value={
              editor.isActive('heading', { level: 1 }) ? 'h1' :
              editor.isActive('heading', { level: 2 }) ? 'h2' :
              editor.isActive('heading', { level: 3 }) ? 'h3' :
              editor.isActive('heading', { level: 4 }) ? 'h4' : 'p'
            }
            onChange={(val) => {
              if (val === 'p') editor.chain().focus().setParagraph().run();
              else editor.chain().focus().toggleHeading({ level: parseInt(val.replace('h', '')) as any }).run();
            }}
            options={[
              { label: 'Parágrafo', value: 'p' },
              { label: 'Título 1', value: 'h1' },
              { label: 'Título 2', value: 'h2' },
              { label: 'Título 3', value: 'h3' },
              { label: 'Título 4', value: 'h4' },
            ]}
          />
        </ToolbarGroup>

        <ToolbarGroup label="LIST">
          <CustomSelect 
            label="Lista"
            icon={List}
            value={
              editor.isActive('bulletList') ? 'bullet' :
              editor.isActive('orderedList') ? 'ordered' :
              editor.isActive('taskList') ? 'task' : undefined
            }
            onChange={(val) => {
              if (val === 'bullet') editor.chain().focus().toggleBulletList().run();
              if (val === 'ordered') editor.chain().focus().toggleOrderedList().run();
              if (val === 'task') editor.chain().focus().toggleTaskList().run();
            }}
            options={[
              { label: 'Marcadores', value: 'bullet', isActive: editor.isActive('bulletList') },
              { label: 'Numerada', value: 'ordered', isActive: editor.isActive('orderedList') },
              { label: 'Tarefas', value: 'task', isActive: editor.isActive('taskList') },
            ]}
          />
        </ToolbarGroup>

        <div className="hidden md:block">
          <ToolbarGroup>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCode().run()}
              isActive={editor.isActive('code')}
              title="Código Inline"
            >
              <Code className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              isActive={editor.isActive('codeBlock')}
              title="Bloco de Código"
            >
              <SquareCode className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive('blockquote')}
              title="Citação"
            >
              <Quote className="w-4 h-4" />
            </ToolbarButton>
          </ToolbarGroup>
        </div>

        <div className="hidden md:block">
          <ToolbarGroup label="LAYOUT">
            <CustomSelect 
              label="Alinhamento"
              icon={AlignLeft}
              value={
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
          </ToolbarGroup>
        </div>

        <div className="hidden md:block">
          <ToolbarGroup label="TYPO">
            <CustomSelect 
              label="Fonte"
              icon={Type}
              value={editor.getAttributes('textStyle').fontFamily || editor.getAttributes('paragraph').fontFamily || 'Inter'}
              onChange={(val) => {
                editor.chain().focus()
                  .setFontFamily(val)
                  .command(({ tr, state }) => {
                    const { from, to } = state.selection;
                    state.doc.nodesBetween(from, to, (node, pos) => {
                      if (['paragraph', 'heading', 'listItem', 'bulletList', 'orderedList'].includes(node.type.name)) {
                        tr.setNodeMarkup(pos, undefined, { ...node.attrs, fontFamily: val });
                      }
                    });
                    return true;
                  })
                  .run();
              }}
              options={[
                { label: 'Sans', value: 'Inter' },
                { label: 'Serif', value: 'Georgia' },
                { label: 'Mono', value: 'monospace' },
              ]}
            />
            <CustomSelect 
              label="Tamanho"
              icon={Type}
              value={editor.getAttributes('textStyle').fontSize || editor.getAttributes('paragraph').fontSize || '18px'}
              onChange={(val) => {
                editor.chain().focus()
                  .setFontSize(val)
                  .command(({ tr, state }) => {
                    const { from, to } = state.selection;
                    state.doc.nodesBetween(from, to, (node, pos) => {
                      if (['paragraph', 'heading', 'listItem', 'bulletList', 'orderedList'].includes(node.type.name)) {
                        tr.setNodeMarkup(pos, undefined, { ...node.attrs, fontSize: val });
                      }
                    });
                    return true;
                  })
                  .run();
              }}
              options={[
                { label: '12px', value: '12px' },
                { label: '14px', value: '14px' },
                { label: '16px', value: '16px' },
                { label: '18px', value: '18px' },
                { label: '20px', value: '20px' },
                { label: '24px', value: '24px' },
                { label: '32px', value: '32px' },
                { label: '48px', value: '48px' },
              ]}
            />
          </ToolbarGroup>
        </div>

        <div className="hidden md:block">
          <ToolbarGroup label="COLOR">
            <div className="flex items-center gap-1 px-1 py-0.5">
              <Palette className="w-3 h-3 opacity-30 text-[var(--foreground)]" />
              <select 
                onChange={(e) => {
                  if (e.target.value === 'auto') editor.chain().focus().unsetColor().run();
                  else editor.chain().focus().setColor(e.target.value).run();
                }}
                className="bg-transparent text-[8px] font-mono font-bold uppercase tracking-wider outline-none cursor-pointer text-[var(--foreground)]"
                title="Cor"
              >
                <option value="auto">Auto</option>
                <option value="#ef4444">Red</option>
                <option value="#3b82f6">Blue</option>
                <option value="#10b981">Green</option>
                <option value="#FF4F00">Accent</option>
              </select>
            </div>
          </ToolbarGroup>
        </div>

        <ToolbarGroup label="VOICE">
          <button
            onClick={(e) => {
              e.preventDefault();
              toggleTranscription();
            }}
            className={`flex items-center justify-center w-9 h-9 md:w-auto md:px-2 md:h-7 transition-all ${isRecording ? 'bg-red-500 text-white' : 'hover:bg-[var(--muted)] text-[var(--foreground)] opacity-60 hover:opacity-100 border border-[var(--border)]/10'}`}
          >
            <Mic className={`w-4 h-4 md:w-3 md:h-3 ${isRecording ? 'animate-pulse' : ''}`} />
            <span className="text-[9px] font-bold uppercase tracking-widest hidden md:block ml-1">
              {isRecording ? 'Ouvindo' : 'Voz'}
            </span>
          </button>
        </ToolbarGroup>

        <ToolbarGroup>
          <ToolbarButton
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            title="Limpar Formatação"
          >
            <Eraser className="w-4 h-4 md:w-3 md:h-3" />
          </ToolbarButton>
        </ToolbarGroup>

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

      <div>
        <EditorContent editor={editor} />
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
    </div>
  );
}
