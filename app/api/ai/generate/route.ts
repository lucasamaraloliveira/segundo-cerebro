import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Limpa a chave de eventuais aspas ou espaços extras
    const apiKey = process.env.GEMINI_API_KEY?.replace(/['"]/g, '').trim();

    console.log('Verificando Configuração:');
    console.log('- API Key presente:', !!apiKey);
    console.log('- API Key prefixo:', apiKey?.substring(0, 7) + '...');

    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.length < 10) {
      return NextResponse.json({
        error: 'Gemini API Key is not configured on the server.',
        hint: 'Adicione GEMINI_API_KEY no arquivo .env.local e reinicie o servidor.'
      }, { status: 500 });
    }

    console.log('--- Iniciando Geração de Conteúdo ---');
    console.log('Modelo: gemini-2.5-flash');
    console.log('Tamanho do Prompt:', prompt.length);

    // Inicializa o SDK oficial da Google
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;

      // Verifica se houve candidatos na resposta
      if (!response.candidates || response.candidates.length === 0) {
        console.error('Nenhum candidato retornado pela IA. Verifique os filtros de segurança.');
        console.error('Prompt Feedback:', response.promptFeedback);
        return NextResponse.json({
          error: 'A IA não gerou uma resposta. Isso pode ser devido aos filtros de segurança.',
          feedback: response.promptFeedback
        }, { status: 422 });
      }

      const text = response.text();
      console.log('Sucesso na geração. Tamanho da resposta:', text.length);
      return NextResponse.json({ text });
    } catch (apiError: any) {
      console.error('--- ERRO DETALHADO DA API GEMINI ---');
      console.error('Mensagem:', apiError.message);
      console.error('Status Code:', apiError.status);
      console.error('Detalhes:', JSON.stringify(apiError, null, 2));
      throw apiError;
    }
  } catch (error: any) {
    console.error('Erro Geral na Rota AI:', error);
    return NextResponse.json({
      error: error.message || 'Failed to generate content',
      details: error.stack,
      hint: 'Verifique se a GEMINI_API_KEY no .env.local está correta e se o servidor foi reiniciado.'
    }, { status: 500 });
  }
}
