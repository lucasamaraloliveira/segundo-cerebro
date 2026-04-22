'use client';

import { useState, useEffect } from 'react';
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
  AlignJustify
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const [noteFont, setNoteFont] = useState('font-sans');
  const [pasteModal, setPasteModal] = useState<{ show: boolean, text: string, html: string } | null>(null);

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
    ],
    content: content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm md:prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[500px]',
      },
    },
  });

  // Update editor attributes when font changes
  useEffect(() => {
    if (editor && noteFont) {
      editor.setOptions({
        editorProps: {
          attributes: {
            class: `prose prose-sm md:prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[500px] ${noteFont}`,
          },
          handlePaste(view, event) {
            const text = event.clipboardData?.getData('text/plain') || '';
            const html = event.clipboardData?.getData('text/html') || '';

            // If it's only text, no need to ask
            if (!html || html === text) return false;

            setPasteModal({ show: true, text, html });
            return true; // handled by modal
          },
        },
      });
    }
  }, [noteFont, editor]);

  const handlePasteChoice = (keep: boolean) => {
    if (!editor || !pasteModal) return;

    if (keep) {
      editor.chain().focus().insertContent(pasteModal.html).run();
    } else {
      editor.chain().focus().insertContent(pasteModal.text).run();
    }
    setPasteModal(null);
  };

  if (!editor) {
    return null;
  }

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
      className={`p-1.5 md:p-2 rounded-md transition-all ${
        isActive 
          ? 'bg-[var(--accent)] text-[var(--accent-foreground)]' 
          : 'hover:bg-[var(--muted)] text-[var(--foreground)] opacity-60 hover:opacity-100'
      }`}
    >
      {children}
    </button>
  );

  const ToolbarGroup = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-0.5 bg-[var(--muted)]/30 p-0.5 rounded-md border border-[var(--border)]/20 mx-0.5">
      {children}
    </div>
  );

  const StyledSelect = ({ 
    options, 
    value, 
    onChange, 
    icon: Icon,
    label 
  }: { 
    options: { label: string, value: string }[], 
    value: string, 
    onChange: (value: string) => void,
    icon: any,
    label: string
  }) => (
    <div className="relative flex items-center">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[var(--muted)]/50 text-[var(--foreground)] border border-[var(--border)] transition-all min-w-[80px]">
        <Icon className="w-3.5 h-3.5 opacity-60" />
        <span className="text-[9px] font-bold uppercase tracking-widest whitespace-nowrap overflow-hidden text-ellipsis max-w-[50px]">
          {options.find(opt => opt.value === value)?.label || label}
        </span>
      </div>
      <select 
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          // Reset value to avoid sticking if needed, but for headings it's fine
        }}
      >
        <option value="" disabled>{label}</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="flex flex-col w-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-y-2 gap-x-1 p-2 bg-[var(--background)] border-b border-[var(--border)] sticky top-0 z-10">
        <ToolbarGroup>
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

        <ToolbarGroup>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="Negrito"
          >
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="Itálico"
          >
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            title="Sublinhado"
          >
            <UnderlineIcon className="w-4 h-4" />
          </ToolbarButton>
        </ToolbarGroup>
        
        <ToolbarGroup>
          {/* Heading Dropdown (Mobile Only) */}
          <div className="flex md:hidden">
            <StyledSelect 
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
          </div>

          {/* Heading Individual (Desktop Only) */}
          <div className="hidden md:flex items-center gap-0.5">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              isActive={editor.isActive('heading', { level: 1 })}
              title="Título Grande"
            >
              <Heading1 className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              isActive={editor.isActive('heading', { level: 2 })}
              title="Título Médio"
            >
              <Heading2 className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              isActive={editor.isActive('heading', { level: 3 })}
              title="Título Pequeno"
            >
              <Heading3 className="w-4 h-4" />
            </ToolbarButton>
          </div>
        </ToolbarGroup>

        <ToolbarGroup>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="Lista de Marcadores"
          >
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="Lista Numerada"
          >
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            isActive={editor.isActive('taskList')}
            title="Lista de Tarefas"
          >
            <CheckSquare className="w-4 h-4" />
          </ToolbarButton>
        </ToolbarGroup>

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

        <ToolbarGroup>
          {/* Alignment Dropdown (Mobile Only) */}
          <div className="flex md:hidden">
            <StyledSelect 
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
          </div>

          {/* Alignment Individual (Desktop Only) */}
          <div className="hidden md:flex items-center gap-0.5">
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              isActive={editor.isActive({ textAlign: 'left' })}
              title="Alinhar à Esquerda"
            >
              <AlignLeft className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              isActive={editor.isActive({ textAlign: 'center' })}
              title="Centralizar"
            >
              <AlignCenter className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              isActive={editor.isActive({ textAlign: 'right' })}
              title="Alinhar à Direita"
            >
              <AlignRight className="w-4 h-4" />
            </ToolbarButton>
          </div>
        </ToolbarGroup>

        <ToolbarGroup>
          <div className="flex items-center gap-1 px-1">
            <Type className="w-3 h-3 opacity-30 text-[var(--foreground)]" />
            <select 
              onChange={(e) => setNoteFont(e.target.value)}
              className="bg-transparent text-[9px] font-bold uppercase tracking-wider outline-none cursor-pointer max-w-[70px] text-[var(--foreground)]"
              value={noteFont}
              title="Fonte"
            >
              <option value="font-sans">Sans</option>
              <option value="font-serif">Serif</option>
              <option value="font-mono">Mono</option>
            </select>
          </div>
          <div className="w-[1px] h-3 bg-[var(--border)] mx-1" />
          <div className="flex items-center gap-1 px-1">
            <Palette className="w-3 h-3 opacity-30 text-[var(--foreground)]" />
            <select 
              onChange={(e) => {
                if (e.target.value === 'auto') editor.chain().focus().unsetColor().run();
                else editor.chain().focus().setColor(e.target.value).run();
              }}
              className="bg-transparent text-[9px] font-bold uppercase tracking-wider outline-none cursor-pointer text-[var(--foreground)]"
              title="Cor"
            >
              <option value="auto">Auto</option>
              <option value="#ef4444">Red</option>
              <option value="#3b82f6">Blue</option>
              <option value="#10b981">Green</option>
            </select>
          </div>
        </ToolbarGroup>

        <div className="flex-1" />

        <ToolbarGroup>
          <ToolbarButton
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            title="Limpar Formatação"
          >
            <Eraser className="w-3.5 h-3.5" />
          </ToolbarButton>
        </ToolbarGroup>
      </div>

      <div className={noteFont}>
        <EditorContent editor={editor} />
      </div>

      {/* Paste Choice Modal */}
      {pasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--background)] rounded-2xl shadow-2xl p-8 max-w-md w-full border border-[var(--border)] animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-serif mb-4 tracking-tight text-[var(--foreground)]">Como deseja colar?</h3>
            <p className="text-sm text-[var(--foreground)]/60 mb-8 leading-relaxed">
              O conteúdo copiado possui formatação original. Escolha como deseja integrá-lo à sua nota.
            </p>
            <div className="grid gap-3">
              <button 
                onClick={() => handlePasteChoice(false)}
                className="w-full py-4 px-6 bg-[var(--accent)] text-[var(--accent-foreground)] rounded-xl font-bold uppercase text-[11px] tracking-widest hover:opacity-90 transition-all flex items-center justify-between group"
              >
                Limpar Formatação
                <span className="opacity-40 group-hover:opacity-100 transition-opacity text-[var(--accent-foreground)]">Ajustar ao estilo atual</span>
              </button>
              <button 
                onClick={() => handlePasteChoice(true)}
                className="w-full py-4 px-6 bg-transparent text-[var(--foreground)] border border-[var(--border)] rounded-xl font-bold uppercase text-[11px] tracking-widest hover:bg-[var(--muted)] transition-all flex items-center justify-between group"
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
