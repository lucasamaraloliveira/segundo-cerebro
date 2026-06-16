import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-3.1-flash-lite for faster and efficient transcription & processing
    const model = genAI.getGenerativeModel(
      { model: 'gemini-3.1-flash-lite' },
      { apiVersion: 'v1beta' }
    );

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');

    let promptText = "Transcreva o conteúdo deste arquivo de mídia exatamente como está em português. Retorne apenas o texto transcrito, sem introduções ou comentários.";

    if (promptType === 'meeting_minutes') {
      promptText = "Você é um redator profissional. Analise o áudio e gere uma ata de reunião estruturada e formatada em Markdown em português. Identifique os tópicos discutidos, decisões tomadas, participantes mencionados se houver, e itens de ação/compromissos. Retorne APENAS o texto da ata formatada em Markdown, sem comentários, introduções ou explicações adicionais.";
    } else if (promptType === 'email') {
      promptText = "Você é um assistente executivo. Analise o áudio e redija um e-mail profissional e formal em português para o cliente com base nas instruções faladas. Formate com Assunto e Corpo do e-mail em Markdown. Retorne APENAS o texto do e-mail formatado, sem comentários, introduções ou explicações adicionais.";
    } else if (promptType === 'summary') {
      promptText = "Analise o áudio e crie um resumo executivo conciso e estruturado em Markdown em português, destacando os pontos principais discutidos. Retorne APENAS o resumo formatado em Markdown, sem comentários, introduções ou explicações adicionais.";
    } else if (promptType === 'tasks') {
      promptText = "Analise o áudio e extraia apenas os compromissos, tarefas ou action items mencionados. Formate como uma lista de tarefas detalhada em Markdown em português. Retorne APENAS a lista de tarefas, sem comentários, introduções ou explicações adicionais.";
    }

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
    const text = response.text();

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error('Transcription Error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to transcribe media',
    }, { status: 500 });
  }
}
