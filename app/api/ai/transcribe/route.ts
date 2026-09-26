import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PRIMARY_MODEL, FALLBACK_MODEL, EMERGENCY_MODEL } from '@/lib/ai-runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes for larger files

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

    let promptText = "Você é um transcritor neural de alta precisão. Transcreva o conteúdo deste áudio com fidelidade total em português, aplicando pontuação natural, quebra em parágrafos claros e corrigindo apenas hesitações evidentes. Retorne APENAS o texto transcrito em Markdown, sem introduções ou explicações.";

    if (promptType === 'meeting_minutes') {
      promptText = "Você é um redator executivo sênior. Analise o áudio e elabore uma Ata de Reunião profissional estruturada em Markdown em português contendo: # 📋 Ata de Reunião, ## 🎯 Objetivo & Pauta, ## 📌 Tópicos Discutidos, ## ✅ Decisões Tomadas e ## 🚀 Itens de Ação & Compromissos (em formato de checklist com - [ ]). Retorne APENAS a ata formatada, sem introduções ou comentários adicionais.";
    } else if (promptType === 'email') {
      promptText = "Você é um assistente executivo corporativo. Analise o áudio e redija um e-mail profissional, cortês e objetivo em português com base nas instruções e assuntos falados. Formate com **Assunto:** no início, Saudação formal, Contextualização, Proposta/Pontos Principais e Fechamento com despedida executiva. Retorne APENAS o texto do e-mail formatado em Markdown, sem comentários ou introduções adicionais.";
    } else if (promptType === 'summary') {
      promptText = "Você é um especialista em síntese cognitiva. Analise o áudio e crie um Resumo Executivo conciso e de alto impacto em português em Markdown, estruturado em: ## 💡 Resumo Geral, ## 🔑 Principais Destaques (em tópicos com termos-chave em negrito) e ## 📌 Conclusões. Retorne APENAS o resumo formatado, sem comentários ou introduções adicionais.";
    } else if (promptType === 'tasks') {
      promptText = "Você é um assistente de produtividade e gestão de tarefas. Analise o áudio e extraia todos os compromissos, tarefas, prazos e pendências mencionadas. Formate estritamente como uma lista acionável em Markdown em português com caixas de seleção `- [ ] Tarefa (Responsável / Prazo se mencionados)`. Retorne APENAS a lista de tarefas, sem comentários adicionais.";
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
            generationConfig: {
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

    return NextResponse.json({
      text,
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
