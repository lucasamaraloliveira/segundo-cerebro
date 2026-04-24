'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  X, 
  Wand2, 
  ListChecks, 
  FileText, 
  Tag as TagIcon, 
  MessageSquare,
  Loader2,
  Check,
  RotateCcw,
  Type
} from 'lucide-react';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onApply: (newContent: string) => void;
  onAddTags: (tags: string[]) => void;
  existingTags?: string[];
}

const ASSISTANT_OPTIONS = [
  {
    id: 'refine',
    title: 'Refinar Transcrição',
    description: 'Corrige erros de gramática, pontuação e melhora a fluidez do texto.',
    icon: Wand2,
    color: 'bg-blue-500',
    prompt: (text: string) => `Você é um editor profissional. Refine o seguinte texto, corrigindo gramática, pontuação e melhorando a fluidez, mas mantendo o sentido original. Se parecer uma transcrição de áudio, limpe vícios de linguagem. Retorne APENAS o texto refinado, sem comentários.\n\nTEXTO:\n${text}`
  },
  {
    id: 'summarize',
    title: 'Resumo Executivo',
    description: 'Cria um resumo conciso com os pontos mais importantes.',
    icon: FileText,
    color: 'bg-purple-500',
    prompt: (text: string) => `Crie um resumo executivo conciso do seguinte texto. Use tópicos se necessário. Retorne APENAS o resumo.\n\nTEXTO:\n${text}`
  },
  {
    id: 'tasks',
    title: 'Extrair Tarefas',
    description: 'Identifica compromissos e action items no texto.',
    icon: ListChecks,
    color: 'bg-green-500',
    prompt: (text: string) => `Analise o texto abaixo e extraia apenas os itens de ação, tarefas ou compromissos mencionados. Formate como uma lista de tarefas. Se não houver tarefas, diga "Nenhuma tarefa identificada".\n\nTEXTO:\n${text}`
  },
  {
    id: 'tags',
    title: 'Sugerir Tags',
    description: 'Sugere etiquetas inteligentes para organizar sua nota.',
    icon: TagIcon,
    color: 'bg-amber-500',
    prompt: (text: string) => `Analise o texto e sugira até 5 tags (etiquetas) curtas que descrevam o conteúdo. Retorne APENAS as tags separadas por vírgula, sem outros comentários.\n\nTEXTO:\n${text}`
  },
  {
    id: 'tone',
    title: 'Mudar Tom',
    description: 'Reescreve a nota em um tom mais profissional ou criativo.',
    icon: Type,
    color: 'bg-rose-500',
    prompt: (text: string) => `Reescreva o texto abaixo em um tom profissional, direto e elegante (estilo executivo). Retorne APENAS o novo texto.\n\nTEXTO:\n${text}`
  }
];

export default function AIAssistantModal({ isOpen, onClose, content, onApply, onAddTags, existingTags = [] }: AIAssistantModalProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showApplyOptions, setShowApplyOptions] = useState(false);

  const handleAction = async (optionId: string) => {
    const option = ASSISTANT_OPTIONS.find(o => o.id === optionId);
    if (!option) return;

    setSelectedOption(optionId);
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: option.prompt(content) })
      });
      const data = await res.json();

      if (data.text) {
        setResult(data.text);
      } else {
        throw new Error(data.error || 'Falha ao gerar conteúdo');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = (mode: 'replace' | 'append' | 'tags') => {
    if (!result) return;
    
    if (mode === 'tags') {
      const tags = result.split(',').map(t => t.trim().toLowerCase()).filter(t => t !== '');
      onAddTags(tags);
    } else if (mode === 'replace') {
      onApply(result);
    } else if (mode === 'append') {
      const separator = content.trim() ? '\n\n<hr>\n\n' : '';
      onApply(content + separator + result);
    }

    onClose();
    // Reset state
    setResult(null);
    setSelectedOption(null);
    setShowApplyOptions(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-[var(--background)] border-2 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-[#FF4F00] text-white border-b-2 border-black flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="animate-pulse" />
                <h2 className="font-bold uppercase tracking-widest text-sm">Assistente Neural</h2>
              </div>
              <button onClick={onClose} className="hover:rotate-90 transition-transform duration-200">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {!result && !isLoading ? (
                <>
                  <p className="text-xs font-bold uppercase opacity-40 tracking-widest">Selecione uma Habilidade Neural</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ASSISTANT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => handleAction(opt.id)}
                        className="group flex flex-col text-left p-4 border-2 border-black bg-[var(--muted)] hover:bg-[#FF4F00]/5 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
                      >
                        <div className={`w-10 h-10 ${opt.color} text-white flex items-center justify-center border-2 border-black mb-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`}>
                          <opt.icon size={20} />
                        </div>
                        <h3 className="font-bold text-sm uppercase mb-1">{opt.title}</h3>
                        <p className="text-xs opacity-60 leading-relaxed">{opt.description}</p>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-[#FF4F00] animate-pulse" />
                      <p className="text-xs font-bold uppercase tracking-widest">
                        {isLoading ? 'Processando Sinapses...' : 'Resultado da Análise'}
                      </p>
                    </div>
                    {!isLoading && (
                      <button 
                        onClick={() => { setResult(null); setSelectedOption(null); }}
                        className="text-[10px] font-bold uppercase underline hover:text-[#FF4F00]"
                      >
                        Voltar
                      </button>
                    )}
                  </div>

                  {isLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-4 text-[var(--foreground)] opacity-40">
                      <Loader2 size={40} className="animate-spin text-[#FF4F00]" />
                      <p className="text-xs italic font-serif">"Acessando camadas neurais..."</p>
                    </div>
                  ) : error ? (
                    <div className="p-4 border-2 border-red-500 bg-red-50 text-red-600 text-sm">
                      {error}
                    </div>
                  ) : (
                    <div className="p-6 border-2 border-black bg-[var(--muted)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-h-[400px] overflow-y-auto custom-scrollbar">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {selectedOption === 'tags' ? (
                          <div className="flex flex-wrap gap-2">
                            {result?.split(',').map((tag, i) => (
                              <span key={i} className="bg-black text-white px-3 py-1 text-[10px] font-bold uppercase tracking-tight border border-black">
                                {tag.trim()}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{result}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            {result && !isLoading && (
              <div className="p-4 border-t-2 border-black bg-[var(--background)]">
                <AnimatePresence mode="wait">
                  {!showApplyOptions ? (
                    <motion.div 
                      key="actions"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex gap-3"
                    >
                      <button
                        onClick={() => {
                          if (selectedOption === 'tags') handleApply('tags');
                          else setShowApplyOptions(true);
                        }}
                        className="flex-1 bg-black text-white py-3 font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#FF4F00] transition-colors border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
                      >
                        <Check size={16} />
                        {selectedOption === 'tags' ? 'Aplicar Tags' : 'Aplicar na Nota'}
                      </button>
                      <button
                        onClick={() => handleAction(selectedOption!)}
                        className="px-4 bg-[var(--muted)] border-2 border-black flex items-center justify-center hover:bg-black hover:text-white transition-colors"
                        title="Tentar Novamente"
                      >
                        <RotateCcw size={18} />
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="options"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex flex-col gap-3"
                    >
                      <p className="text-[10px] font-bold uppercase opacity-40 text-center mb-1">Como deseja aplicar este conteúdo?</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApply('replace')}
                          className="flex-1 bg-white text-black py-3 font-bold uppercase tracking-widest text-[10px] border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-black hover:text-white transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
                        >
                          Substituir Tudo
                        </button>
                        <button
                          onClick={() => handleApply('append')}
                          className="flex-1 bg-black text-white py-3 font-bold uppercase tracking-widest text-[10px] border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FF4F00] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
                        >
                          Adicionar ao Final
                        </button>
                      </div>
                      <button 
                        onClick={() => setShowApplyOptions(false)}
                        className="text-[9px] font-bold uppercase underline opacity-40 hover:opacity-100 transition-opacity"
                      >
                        Cancelar
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
