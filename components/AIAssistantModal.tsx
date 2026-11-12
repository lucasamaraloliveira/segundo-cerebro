'use client';

import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { 
  Sparkles, 
  X, 
  Wand2, 
  ListChecks, 
  FileText, 
  Tag as TagIcon, 
  Type, 
  Loader2, 
  Check, 
  RotateCcw, 
  Wrench,
  FileCheck2,
  Cpu,
  ArrowLeft,
  Send,
  Sparkle
} from 'lucide-react';

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

// Simple helper to convert markdown-style response from AI to HTML for the editor
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

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  selectionText?: string;
  selectionHtml?: string;
  onApply: (newContent: string, isSelectionOnly: boolean) => void;
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
    prompt: (text: string) => `Você é um editor profissional. Refine o seguinte texto, corrigindo gramática, pontuação e melhorando a fluidez, mas mantendo o sentido original. Se parecer uma transcrição de áudio, limpe vícios de linguagem. Use apenas formatação Markdown padrão (como **, *, #, -) para qualquer ênfase ou estrutura. NÃO use tags HTML (como <bold>, <h3>, <em>, etc.) sob nenhuma circunstância. Retorne APENAS o texto refinado, sem comentários.\n\nTEXTO:\n${text}`
  },
  {
    id: 'meeting_minutes',
    title: 'Ata de Reunião',
    description: 'Identifica participantes, objetivo, tópicos discutidos, decisões e plano de ação.',
    icon: FileCheck2,
    color: 'bg-indigo-600',
    prompt: (text: string) => `Você é um secretário executivo corporativo de alto nível. Analise detalhadamente o conteúdo fornecido a seguir e elabore uma Ata de Reunião estruturada em Markdown de acordo com o padrão corporativo.

A resposta DEVE OBRIGATORIAMENTE começar com o título "# 📋 Ata de Reunião" e conter exclusivamente as seguintes seções estruturadas:

## 👥 Participantes
(Identifique todos os participantes, interlocutores ou partes citadas no texto. Caso não haja nomes explícitos, deduza os papéis/cargos mencionados ou registre os envolvidos identificáveis)

## 🎯 Objetivo da Reunião
(Síntese concisa e objetiva do propósito central, contexto e finalidade do encontro)

## 📌 Tópicos & Pautas Discutidas
(Detalhamento dos tópicos abordados, debates, argumentos e pontos-chave discutidos durante a reunião)

## ✅ Decisões & Deliberações
(Decisões consolidadas, acordos firmados, definições e diretrizes estabelecidas)

## 🚀 Plano de Ação & Próximos Passos
(Lista de tarefas estruturada em formato de checklist com - [ ] Tarefa | Responsável | Prazo quando identificáveis)

Diretrizes:
- Vá direto ao conteúdo em Markdown.
- NÃO utilize tags HTML (<bold>, <h3>, etc.).
- NÃO inclua introduções conversacionais (como "Com certeza", "Aqui está a ata") nem mensagens de encerramento.
- Retorne APENAS a ata formatada.

TEXTO DA REUNIÃO:
${text}`
  },
  {
    id: 'summarize',
    title: 'Resumo Executivo',
    description: 'Cria um resumo conciso com os pontos mais importantes.',
    icon: FileText,
    color: 'bg-purple-500',
    prompt: (text: string) => `Crie um resumo executivo conciso do seguinte texto. Use tópicos se necessário. Use apenas formatação Markdown padrão para ênfase (como **, *). Não use tags HTML em nenhuma circunstância. Retorne APENAS o resumo.\n\nTEXTO:\n${text}`
  },
  {
    id: 'tasks',
    title: 'Extrair Tarefas',
    description: 'Identifica compromissos e action items no texto.',
    icon: ListChecks,
    color: 'bg-green-500',
    prompt: (text: string) => `Analise o texto abaixo e extraia apenas os itens de ação, tarefas ou compromissos mencionados. Formate como uma lista de tarefas em Markdown. Não use tags HTML em nenhuma circunstância. Se não houver tarefas, diga "Nenhuma tarefa identificada".\n\nTEXTO:\n${text}`
  },
  {
    id: 'tech_report',
    title: 'Reg. Assistência Técnica',
    description: 'Formata o relato em uma ata estruturada por sistemas com ênfase estilizada.',
    icon: Wrench,
    color: 'bg-emerald-600',
    prompt: (text: string) => `Você é um assistente técnico especializado. Analise o relato a seguir e formate-o como uma ata de assistência técnica estruturada.
Organize as informações identificando os sistemas mencionados (por exemplo, "Sistema A", "Sistema B") e agrupe as atividades/tarefas relatadas sob cada sistema correspondente.

Regras de Formatação:
1. Identifique os sistemas e crie um cabeçalho para cada um usando negrito ou negrito-itálico: use **Nome do Sistema** (ex: **Sistema A**) ou ***Nome do Sistema*** (ex: ***Sistema B***).
2. Sob cada sistema, liste as atividades como tópicos/itens de lista com marcadores (ex: - Realizado...).
3. Aplique formatações estilizadas alternadas ou com ênfase para os itens (por exemplo, alguns itens em itálico usando asteriscos, como: *- Realizado treinamento X...* ou *- Ao chegar no setor B...*, e outros em formato normal: - Realizado ajuste...). Garanta que o resultado final reflita o estilo do exemplo fornecido abaixo.
4. Retorne APENAS o texto formatado final (em markdown), sem introduções, explicações ou comentários adicionais.

EXEMPLO DE ESTRUTURA REQUERIDA:
**Sistema A**
*- Realizado treinamento X do sistema A;*
- Ao chegar no setor B, realizado ajuste no sistema A em contato com o cliente;
*- Em contato com Fulano, verificado que o sistema A está funcionando corretamente.*

***Sistema B***
- Realizado treinamento X do sistema B;
*- Ao chegar no setor B, realizado ajuste no sistema B em contato com o cliente;*
- Em contato com Fulano, verificado que o sistema B está funcionando corretamente.

TEXTO DO RELATO A SER FORMATADO:
${text}`
  },
  {
    id: 'tags',
    title: 'Sugerir Tags',
    description: 'Sugere etiquetas inteligentes para organizar sua nota.',
    icon: TagIcon,
    color: 'bg-amber-500',
    prompt: (text: string) => `Analise o texto e sugira até 5 tags (etiquetas) curtas que descrevam o conteúdo. Retorne APENAS as tags separadas por vírgula, sem outros comentários. Não use tags HTML.\n\nTEXTO:\n${text}`
  },
  {
    id: 'tone',
    title: 'Mudar Tom',
    description: 'Reescreve a nota em um tom mais profissional ou criativo.',
    icon: Type,
    color: 'bg-rose-500',
    prompt: (text: string) => `Reescreva o texto abaixo em um tom profissional, direto e elegante (estilo executivo). Use apenas formatação Markdown padrão para ênfase (como **, *). Não use tags HTML. Retorne APENAS o novo texto.\n\nTEXTO:\n${text}`
  },
  {
    id: 'custom',
    title: 'Habilidade Personalizada',
    description: 'Defina seu comando ou escolha formatos estratégicos sob demanda.',
    icon: Cpu,
    color: 'bg-[#FF4F00]',
    prompt: () => ''
  }
];

const CUSTOM_SKILL_SUGGESTIONS = [
  {
    id: '5w2h',
    title: 'Matriz 5W2H (Plano de Ação Tático)',
    description: 'O Quê, Por Quê, Onde, Quando, Quem, Como e Quanto Custa em formato tabular claro.',
    instruction: 'Transforme o texto em uma Matriz 5W2H completa. Comece com "# 📊 Plano Tático 5W2H". Estruture em tópicos ou tabela Markdown detalhando: 1. O quê (What), 2. Por quê (Why), 3. Onde (Where), 4. Quando (When), 5. Quem (Who), 6. Como (How) e 7. Quanto Custa (How Much).'
  },
  {
    id: 'sop',
    title: 'Procedimento Operacional Padrão (POP / SOP)',
    description: 'Guia sequencial passo a passo com pré-requisitos, etapas e critérios de sucesso.',
    instruction: 'Transforme as anotações em um Procedimento Operacional Padrão (POP / SOP) rigoroso. Comece com "# 📘 Procedimento Operacional Padrão (POP)". Inclua seções: ## 1. Objetivo & Escopo, ## 2. Pré-requisitos & Ferramentas, ## 3. Passo a Passo Sequencial (numerado detalhado), ## 4. Critérios de Aceite/Sucesso e ## 5. Solução de Problemas Comuns.'
  },
  {
    id: 'pitch',
    title: 'Roteiro de Pitch & Apresentação',
    description: 'Estruturado com Gancho Inicial, Problema, Solução, Valor Agregado e Call-to-Action.',
    instruction: 'Converta as ideias desta nota em um roteiro dinâmico e persuasivo de Pitch/Apresentação. Comece com "# 🎤 Roteiro de Pitch Estratégico". Divida em: ## 🎣 Gancho de Abertura (Hook), ## 💥 O Problema Central, ## 💡 A Solução Proposta, ## 💎 Proposta de Valor Única e ## 📣 Chamada para Ação (CTA).'
  },
  {
    id: 'rfc',
    title: 'RFC Técnico / Arquitetura',
    description: 'Documento técnico de especificação com proposta, trade-offs, riscos e alternativas.',
    instruction: 'Estruture o conteúdo como um Request for Comments (RFC) técnico de engenharia de software e arquitetura. Comece com "# 🏗️ RFC Técnico: Especificação & Arquitetura". Inclua: ## 1. Resumo & Contexto, ## 2. Objetivos & Não-Objetivos, ## 3. Arquitetura & Design Proposto, ## 4. Trade-offs & Alternativas Consideradas, ## 5. Riscos & Mitigações.'
  },
  {
    id: 'eisenhower',
    title: 'Matriz de Eisenhower (Priorização)',
    description: 'Categoriza em Urgente/Importante, Planejar, Delegar e Eliminar.',
    instruction: 'Organize todas as atividades, ideias e demandas do texto dentro da Matriz de Decisão de Eisenhower. Comece com "# 🧭 Matriz de Priorização Eisenhower". Distribua em: ## 🔴 1. Urgente & Importante (Fazer Imediatamente), ## 🟡 2. Importante & Não Urgente (Agendar / Planejar), ## 🔵 3. Urgente & Não Importante (Delegar / Automatizar), ## ⚪ 4. Não Urgente & Não Importante (Eliminar).'
  },
  {
    id: 'critical_analysis',
    title: 'Advogado do Diabo (Análise Crítica)',
    description: 'Questiona premissas, aponta vulnerabilidades ocultas e riscos não previstos.',
    instruction: 'Atue como um analista crítico e rigoroso ("Advogado do Diabo"). Comece com "# ⚖️ Análise Crítica & Pontos Cegos". Analise o texto avaliando: ## ⚠️ Suposições Não Validadas, ## 🔍 Fragilidades e Riscos Ocultos, ## ⚡ Piores Cenários Possíveis e ## 🛡️ Recomendações de Contingência.'
  },
  {
    id: 'active_recall',
    title: 'Flashcards & Memorização Ativa',
    description: 'Gera pares de Pergunta e Resposta para aprendizado profundo e retenção de longo prazo.',
    instruction: 'Converta os principais conceitos, dados e fatos desta nota em um conjunto de Flashcards de memorização ativa (Active Recall). Comece com "# 🧠 Flashcards de Estudo & Fixação". Para cada conceito relevante, crie um bloco formatado com "**Pergunta:** ..." seguido por "**Resposta:** ...".'
  },
  {
    id: 'bluf',
    title: 'Comunicação Executiva BLUF',
    description: 'Bottom Line Up Front: conclusão e decisão no primeiro parágrafo, dados após.',
    instruction: 'Reestruture o texto no padrão militar e corporativo BLUF (Bottom Line Up Front). Comece com "# 🎯 Síntese Estratégica (BLUF)". Coloque no primeiro parágrafo a conclusão definitiva, decisão recomendada ou pedido de ação. Em seguida, divida em seções sucintas: ## Contexto Essencial, ## Impacto & Justificativa e ## Próximos Passos Imediatos.'
  }
];

export default function AIAssistantModal({ 
  isOpen, 
  onClose, 
  content, 
  selectionText = "", 
  selectionHtml = "", 
  onApply, 
  onAddTags, 
  existingTags = [] 
}: AIAssistantModalProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showApplyOptions, setShowApplyOptions] = useState(false);
  const [scope, setScope] = useState<'selection' | 'full'>('full');
  
  // Custom skill mode states
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customPromptInput, setCustomPromptInput] = useState('');
  const [lastCustomInstruction, setLastCustomInstruction] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setScope(selectionText ? 'selection' : 'full');
      setResult(null);
      setSelectedOption(null);
      setShowApplyOptions(false);
      setIsCustomMode(false);
      setCustomPromptInput('');
      setLastCustomInstruction(null);
    }
  }, [isOpen, selectionText]);

  const handleAction = async (optionId: string) => {
    if (optionId === 'custom') {
      setIsCustomMode(true);
      return;
    }

    const option = ASSISTANT_OPTIONS.find(o => o.id === optionId);
    if (!option) return;

    setSelectedOption(optionId);
    setIsLoading(true);
    setError(null);
    setResult(null);

    const textToProcess = scope === 'selection' ? selectionText : content;

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: option.prompt(textToProcess) })
      });
      const data = await res.json();

      if (data.text) {
        if (data.meta?.isFallback && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ai-fallback-triggered', { detail: data.meta }));
        }
        setResult(cleanHtmlTags(data.text));
      } else {
        throw new Error(data.error || 'Falha ao gerar conteúdo');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomSkillRun = async (instruction: string) => {
    if (!instruction.trim()) return;

    setSelectedOption('custom');
    setLastCustomInstruction(instruction);
    setIsLoading(true);
    setError(null);
    setResult(null);

    const textToProcess = scope === 'selection' ? selectionText : content;
    const fullPrompt = `Você é uma inteligência artificial especialista em síntese, organização do conhecimento e redação de alta precisão.
Sua tarefa é processar e formatar o texto fornecido estritamente de acordo com a INSTRUÇÃO DO USUÁRIO.

INSTRUÇÃO DO USUÁRIO:
${instruction}

DIRETRIZES DE SAÍDA:
1. Retorne APENAS o conteúdo formatado em Markdown padrão (#, ##, **, *, - [ ], tabelas).
2. NUNCA use tags HTML (como <bold>, <div>, etc.).
3. Vá direto ao ponto, sem preâmbulos conversacionais (como "Com certeza", "Aqui está") e sem despedidas.
4. Mantenha fidelidade e rigor técnico em relação aos dados da nota original.

TEXTO DA NOTA:
${textToProcess}`;

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt })
      });
      const data = await res.json();

      if (data.text) {
        if (data.meta?.isFallback && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ai-fallback-triggered', { detail: data.meta }));
        }
        setResult(cleanHtmlTags(data.text));
      } else {
        throw new Error(data.error || 'Falha ao processar habilidade personalizada');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (selectedOption === 'custom' && lastCustomInstruction) {
      handleCustomSkillRun(lastCustomInstruction);
    } else if (selectedOption) {
      handleAction(selectedOption);
    }
  };

  const handleApply = (mode: 'replace' | 'append' | 'tags' | 'selection') => {
    if (!result) return;
    
    if (mode === 'tags') {
      const tags = result.split(',').map(t => t.trim().toLowerCase()).filter(t => t !== '');
      onAddTags(tags);
    } else if (mode === 'selection') {
      onApply(markdownToHtml(result), true);
      const tags = result.split(',').map(t => t.trim().toLowerCase()).filter(t => t !== '');
      onAddTags(tags);
    } else if (mode === 'replace') {
      onApply(markdownToHtml(result), false);
    } else if (mode === 'append') {
      const separator = content.trim() ? '<br><hr><br>' : '';
      onApply(content + separator + markdownToHtml(result), false);
    }

    onClose();
    // Reset state
    setResult(null);
    setSelectedOption(null);
    setShowApplyOptions(false);
    setIsCustomMode(false);
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
            className="relative w-full max-w-2xl bg-[var(--background)] border border-black/10 shadow-[8px_8px_0px_rgba(0,0,0,0.1)] flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-[#FF4F00] text-white border-b-2 border-black flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="animate-pulse" />
                <h2 className="font-bold uppercase tracking-widest text-sm">
                  {isCustomMode ? 'Habilidade Neural Personalizada' : 'Assistente Neural'}
                </h2>
              </div>
              <button onClick={onClose} className="hover:rotate-90 transition-transform duration-200">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {selectionText && !result && !isLoading && (
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between p-3 border border-black/5 bg-[#FF4F00]/5 shadow-[2px_2px_0px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-[#FF4F00]" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--foreground)]">Foco do Assistente Neural</span>
                    </div>
                    <div className="flex border border-black/20 rounded overflow-hidden">
                      <button
                        onClick={() => setScope('selection')}
                        className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${scope === 'selection' ? 'bg-[#FF4F00] text-white' : 'bg-[var(--background)] hover:bg-black/5 text-[var(--foreground)]'}`}
                      >
                        Apenas Seleção
                      </button>
                      <button
                        onClick={() => setScope('full')}
                        className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${scope === 'full' ? 'bg-[#FF4F00] text-white' : 'bg-[var(--background)] hover:bg-black/5 text-[var(--foreground)]'}`}
                      >
                        Nota Inteira
                      </button>
                    </div>
                  </div>
                  {scope === 'selection' && (
                    <div className="p-3 bg-[var(--muted)] border border-black/5 text-xs opacity-75 max-h-24 overflow-y-auto font-sans italic rounded">
                      &ldquo;{selectionText}&rdquo;
                    </div>
                  )}
                </div>
              )}

              {/* View 1: Standard Skills Grid */}
              {!result && !isLoading && !isCustomMode && (
                <>
                  <p className="text-xs font-bold uppercase opacity-40 tracking-widest">Selecione uma Habilidade Neural</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ASSISTANT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => handleAction(opt.id)}
                        className={`group flex flex-col text-left p-4 border transition-all shadow-[4px_4px_0px_rgba(0,0,0,0.1)] hover:translate-y-[-2px] hover:shadow-[4px_6px_0px_rgba(0,0,0,0.15)] active:translate-y-[0px] active:shadow-none ${
                          opt.id === 'custom' 
                            ? 'border-[#FF4F00]/50 bg-[#FF4F00]/5 hover:bg-[#FF4F00]/10' 
                            : 'border-black/5 bg-[var(--muted)] hover:bg-[#FF4F00]/5'
                        }`}
                      >
                        <div className={`w-10 h-10 ${opt.color} text-white flex items-center justify-center border border-black/10 mb-3 shadow-[2px_2px_0px_rgba(0,0,0,0.1)]`}>
                          <opt.icon size={20} />
                        </div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <h3 className="font-bold text-sm uppercase">{opt.title}</h3>
                          {opt.id === 'custom' && (
                            <span className="text-[9px] font-bold uppercase bg-[#FF4F00] text-white px-1.5 py-0.5 tracking-wider">
                              Novo
                            </span>
                          )}
                        </div>
                        <p className="text-xs opacity-60 leading-relaxed">{opt.description}</p>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* View 2: Custom Skill Interactive Subview */}
              {!result && !isLoading && isCustomMode && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setIsCustomMode(false)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--foreground)]/60 hover:text-[#FF4F00] transition-colors"
                    >
                      <ArrowLeft size={16} />
                      Voltar às Habilidades Padrão
                    </button>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF4F00] bg-[#FF4F00]/10 px-2 py-1 border border-[#FF4F00]/20">
                      Modo Avançado
                    </span>
                  </div>

                  {/* Free-form Custom Instruction Box */}
                  <div className="p-4 border-2 border-black dark:border-white/20 bg-[var(--background)] shadow-[4px_4px_0px_rgba(0,0,0,0.1)] space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                      <Cpu size={16} className="text-[#FF4F00]" />
                      Como você deseja formatar esta nota?
                    </label>
                    <textarea
                      value={customPromptInput}
                      onChange={(e) => setCustomPromptInput(e.target.value)}
                      placeholder="Ex: Crie um plano de lançamento em 3 fases com prazos estimados, transforme em uma tabela de comparação prós e contras, elabore um FAQ..."
                      rows={3}
                      className="w-full p-3 text-xs bg-[var(--muted)] border border-black/10 focus:outline-none focus:border-[#FF4F00] font-sans resize-none leading-relaxed"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          handleCustomSkillRun(customPromptInput);
                        }
                      }}
                    />
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] opacity-40 font-bold uppercase">
                        Ctrl + Enter para enviar
                      </span>
                      <button
                        onClick={() => handleCustomSkillRun(customPromptInput)}
                        disabled={!customPromptInput.trim()}
                        className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black font-bold uppercase text-xs tracking-wider flex items-center gap-2 hover:bg-[#FF4F00] dark:hover:bg-[#FF4F00] dark:hover:text-white transition-colors disabled:opacity-40 disabled:pointer-events-none shadow-[2px_2px_0px_rgba(0,0,0,0.1)] active:translate-y-[1px]"
                      >
                        <Send size={14} />
                        Executar Comando
                      </button>
                    </div>
                  </div>

                  {/* Curated Strategic Format Suggestions */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkle size={14} className="text-[#FF4F00]" />
                      <p className="text-xs font-bold uppercase opacity-60 tracking-widest">
                        Ou escolha um formato neural avançado:
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {CUSTOM_SKILL_SUGGESTIONS.map((sug) => (
                        <button
                          key={sug.id}
                          onClick={() => handleCustomSkillRun(sug.instruction)}
                          className="group p-3 text-left border border-black/10 bg-[var(--muted)] hover:bg-[#FF4F00]/5 hover:border-[#FF4F00]/40 transition-all shadow-[2px_2px_0px_rgba(0,0,0,0.06)] hover:translate-y-[-1px] active:translate-y-[0px]"
                        >
                          <h4 className="font-bold text-xs uppercase text-[var(--foreground)] group-hover:text-[#FF4F00] transition-colors mb-1">
                            {sug.title}
                          </h4>
                          <p className="text-[11px] opacity-60 leading-relaxed font-sans">
                            {sug.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* View 3: Processing and Result Preview */}
              {(isLoading || result || error) && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-[#FF4F00] animate-pulse" />
                      <p className="text-xs font-bold uppercase tracking-widest">
                        {isLoading ? 'Processando Sinapses Neurais...' : 'Resultado da Análise'}
                      </p>
                    </div>
                    {!isLoading && (
                      <button 
                        onClick={() => { 
                          setResult(null); 
                          setSelectedOption(null); 
                          setError(null);
                        }}
                        className="text-[10px] font-bold uppercase underline hover:text-[#FF4F00]"
                      >
                        Voltar
                      </button>
                    )}
                  </div>

                  {isLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-4 text-[var(--foreground)] opacity-60">
                      <Loader2 size={40} className="animate-spin text-[#FF4F00]" />
                      <p className="text-xs font-mono font-medium tracking-wide">
                        Sintetizando e estruturando conteúdo com IA...
                      </p>
                    </div>
                  ) : error ? (
                    <div className="p-4 border-2 border-red-500 bg-red-50 text-red-600 text-sm font-sans">
                      {error}
                    </div>
                  ) : (
                    <div className="p-6 border border-black/5 bg-[var(--muted)] shadow-[4px_4px_0px_rgba(0,0,0,0.1)] max-h-[400px] overflow-y-auto custom-scrollbar">
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
                          <div className="markdown-preview text-sm leading-relaxed">
                            <ReactMarkdown>{result}</ReactMarkdown>
                          </div>
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
                  {scope === 'selection' && selectedOption !== 'tags' ? (
                    <motion.div 
                      key="selection-actions"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex gap-3"
                    >
                      <button
                        onClick={() => handleApply('selection')}
                        className="flex-1 bg-black text-white py-3 font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#FF4F00] transition-colors border border-black/5 shadow-[4px_4px_0px_rgba(0,0,0,0.1)] hover:translate-y-[-1px] active:translate-y-[0px] active:shadow-none"
                      >
                        <Check size={16} />
                        Substituir Trecho Selecionado
                      </button>
                      <button
                        onClick={handleRetry}
                        className="px-4 bg-[var(--muted)] border border-black/5 shadow-[4px_4px_0px_rgba(0,0,0,0.1)] flex items-center justify-center hover:bg-black hover:text-white transition-colors"
                        title="Tentar Novamente"
                      >
                        <RotateCcw size={18} />
                      </button>
                    </motion.div>
                  ) : !showApplyOptions ? (
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
                        className="flex-1 bg-black text-white py-3 font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#FF4F00] transition-colors border border-black/5 shadow-[4px_4px_0px_rgba(0,0,0,0.1)] hover:translate-y-[-1px] active:translate-y-[0px] active:shadow-none"
                      >
                        <Check size={16} />
                        {selectedOption === 'tags' ? 'Aplicar Tags' : 'Aplicar na Nota'}
                      </button>
                      <button
                        onClick={handleRetry}
                        className="px-4 bg-[var(--muted)] border border-black/5 shadow-[4px_4px_0px_rgba(0,0,0,0.1)] flex items-center justify-center hover:bg-black hover:text-white transition-colors"
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
                          className="flex-1 bg-white text-black py-3 font-bold uppercase tracking-widest text-[10px] border border-black/5 shadow-[4px_4px_0px_rgba(0,0,0,0.1)] hover:translate-y-[-1px] transition-all active:shadow-none active:translate-y-[0px]"
                        >
                          Substituir Tudo
                        </button>
                        <button
                          onClick={() => handleApply('append')}
                          className="flex-1 bg-black text-white py-3 font-bold uppercase tracking-widest text-[10px] border border-black/5 shadow-[4px_4px_0px_rgba(0,0,0,0.1)] hover:translate-y-[-1px] transition-all active:shadow-none active:translate-y-[0px]"
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
