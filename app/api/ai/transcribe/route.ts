import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PRIMARY_MODEL, FALLBACK_MODEL, EMERGENCY_MODEL } from '@/lib/ai-runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes for larger files

const SYSTEM_INSTRUCTION = `Você é um motor especializado em extração e estruturação de dados de áudio de alta precisão.
DIRETRIZES FUNDAMENTAIS E INVIOLÁVEIS:
1. NUNCA utilize linguagem conversacional, saudações, preâmbulos, cumprimentos ou encerramentos (são estritamente proibidas expressões como: "Aqui está", "Com certeza", "Certamente", "Segue abaixo", "Espero ter ajudado", "Sure, here is").
2. NUNCA faça meta-análise ou considerações em terceira pessoa sobre o arquivo ou gravação (são terminantemente proibidas frases como: "O áudio apresenta...", "O áudio aborda...", "O áudio trata de...", "Neste áudio...", "A gravação discute...", "O interlocutor fala..."). Não fale SOBRE o áudio; entregue diretamente o CONTEÚDO SUBSTANTIVO extraído.
3. NUNCA crie seções de panorama/visão geral inicial ou conclusões genéricas ao final. Vá direto aos fatos e pontos essenciais.
4. O primeiro caractere da sua resposta DEVE ser o primeiro caractere útil do conteúdo solicitado.
5. Não envolva a resposta inteira em blocos de código markdown (\`\`\`markdown ... \`\`\` ou \`\`\` ... \`\`\`). Retorne texto estruturado em Markdown diretamente.
6. Entregue única e exclusivamente o conteúdo solicitado com total fidelidade e rigor técnico.`;

/**
 * Garante que a saída esteja 100% limpa de preâmbulos conversacionais,
 * meta-análises sobre o áudio, conclusões redundantes e rodapés de cortesia.
 */
function cleanConversationalOutput(rawText: string): string {
  if (!rawText) return '';

  let cleaned = rawText.trim();

  // 1. Remove blocos de código markdown que envolvam todo o documento acidentalmente
  cleaned = cleaned.replace(/^```(?:markdown)?\s*\n([\s\S]*?)\n```$/i, '$1');

  // 2. Remove preâmbulos conversacionais comuns de IA
  const preambleRegex = /^(?:(?:com certeza|certamente|claro|perfeito|olá|aqui está|aqui está o|aqui está a|segue|segue abaixo|abaixo segue|sure|certainly|here is)(?:[^\n:!.]*?)(?:[:!.]|\n+))\s*/i;
  cleaned = cleaned.replace(preambleRegex, '');

  // 3. Remove frases metalinguísticas de abertura sobre o arquivo de áudio ou gravação
  const metaOpeningRegex = /^(?:(?:o áudio|este áudio|a gravação|o registro|neste áudio|nesta gravação)\s+(?:apresenta|aborda|trata(?:-se)?|discute|traz|explora|descreve|consiste)[^\n]*\n*)/i;
  cleaned = cleaned.replace(metaOpeningRegex, '');

  // 4. Se houver uma seção introdutória residual como "## 💡 Resumo Geral" com meta-descrição antes de "## 🔑 Principais Destaques", remove
  cleaned = cleaned.replace(/^##\s+💡\s+Resumo Geral[\s\S]*?(?=##\s+🔑\s+Principais Destaques)/i, '');

  // 5. Remove qualquer seção final de "Conclusões" gerada artificialmente
  cleaned = cleaned.replace(/\n+##\s+(?:📌\s+)?Conclusões?[\s\S]*$/i, '');

  // 6. Remove comentários/despedidas no rodapé da resposta
  const footerRegex = /\n+(?:espero que ajude|espero ter ajudado|qualquer dúvida|se precisar de mais alguma coisa|let me know if you need anything else|hope this helps)[^\n]*$/i;
  cleaned = cleaned.replace(footerRegex, '');

  return cleaned.trim();
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const promptType = (formData.get('promptType') as string) || 'transcribe';

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY?.replace(/['"]/g, '').trim();

    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API Key is not configured.' }, { status: 500 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');

    let promptText = "Transcreva o áudio com fidelidade total em português, aplicando pontuação natural e quebra em parágrafos claros. Comece imediatamente com o primeiro caractere do texto falado, sem introduções, títulos, metadados sobre a gravação ou comentários.";

    if (promptType === 'meeting_minutes') {
      promptText = "Elabore uma Ata de Reunião executiva estruturada em Markdown baseada no áudio. A resposta DEVE OBRIGATORIAMENTE começar pelo título `# 📋 Ata de Reunião` e conter exclusivamente as seções: ## 📌 Tópicos Discutidos, ## ✅ Decisões Tomadas e ## 🚀 Itens de Ação & Compromissos (em formato de checklist com - [ ]). Vá direto aos pontos da reunião, sem introduções metalinguísticas sobre o áudio gravado e sem seções de conclusões genéricas.";
    } else if (promptType === 'email') {
      promptText = "Redija um e-mail profissional, cortês e objetivo em português com base no áudio. A resposta DEVE OBRIGATORIAMENTE começar com `**Assunto:**` seguido pelo assunto conciso, e em seguida Saudação formal, Contextualização, Proposta/Pontos Principais e Fechamento com despedida executiva. Não inclua nenhum comentário antes de `**Assunto:**` nem referências metalinguísticas ao áudio gravado.";
    } else if (promptType === 'summary') {
      promptText = "Extraia e sintetize diretamente os principais tópicos e destaques substantivos do áudio em português em Markdown. A resposta DEVE OBRIGATORIAMENTE começar imediatamente pelo título `## 🔑 Principais Destaques`. Apresente os tópicos organizados com termos-chave em negrito e descrições diretas do conteúdo. É ESTRITAMENTE PROIBIDO incluir introduções, resumos panorâmicos (como 'O áudio apresenta...'), ou seções de conclusão/fechamento. Entregue única e exclusivamente os destaques extraídos.";
    } else if (promptType === 'tasks') {
      promptText = "Extraia todos os compromissos, tarefas, prazos e pendências mencionadas no áudio. A resposta DEVE OBRIGATORIAMENTE começar imediatamente com a primeira tarefa `- [ ]`. Formate estritamente como checklist `- [ ] Tarefa (Responsável / Prazo se mencionados)`. Não inclua títulos, introduções, conclusões ou comentários adicionais.";
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Para áudio multimodal: 3.8 Flash -> 3.1 Flash Lite -> 3.5 Flash (testados com suporte nativo de áudio)
    const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL, 'gemini-3.5-flash'];
    let lastError: any = null;
    let text = '';
    let usedModel = PRIMARY_MODEL;

    for (let i = 0; i < modelsToTry.length; i++) {
      const modelName = modelsToTry[i];
      try {
        const model = genAI.getGenerativeModel(
          { 
            model: modelName,
            systemInstruction: SYSTEM_INSTRUCTION,
            generationConfig: {
              temperature: 0.1,
              topP: 0.8,
              maxOutputTokens: 2048,
              thinkingConfig: { thinkingBudget: 0 }
            } as any
          },
          { apiVersion: 'v1beta' }
        );

        const result = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    data: base64Data,
                    mimeType: file.type,
                  },
                },
                { text: promptText },
              ],
            },
          ],
        });

        const response = await result.response;
        text = response.text();
        usedModel = modelName;
        break; // Sucesso
      } catch (err: any) {
        console.warn(`[Transcribe] Falha no modelo ${modelName}:`, err?.message || err);
        lastError = err;
        if (i < modelsToTry.length - 1) {
          continue;
        }
      }
    }

    if (!text && lastError) {
      throw lastError;
    }

    const cleanedText = cleanConversationalOutput(text);

    return NextResponse.json({
      text: cleanedText,
      meta: {
        modelUsed: usedModel,
        isFallback: usedModel !== PRIMARY_MODEL,
        originalModel: PRIMARY_MODEL,
        reason: usedModel !== PRIMARY_MODEL
          ? `Modelo principal (${PRIMARY_MODEL}) em alta demanda. Processado via contingência com ${usedModel}.`
          : undefined
      }
    });
  } catch (error: any) {
    console.error('Transcription Error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to transcribe media',
    }, { status: 500 });
  }
}
