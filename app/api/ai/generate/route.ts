import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY?.replace(/['"]/g, '').trim();

    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return NextResponse.json({
        error: 'Gemini API Key is not configured.',
      }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel(
      { model: 'gemini-3.1-flash-lite-preview' },
      { apiVersion: 'v1beta' }
    );

    try {
      // Usando o formato de objeto explícito para maior compatibilidade
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      
      const response = await result.response;
      const text = response.text();
      
      return NextResponse.json({ text });
    } catch (apiError: any) {
      console.error('--- ERRO DETALHADO DA API GEMINI ---');
      console.error('Mensagem:', apiError.message);
      throw apiError;
    }
  } catch (error: any) {
    console.error('Erro Geral na Rota AI:', error);
    return NextResponse.json({
      error: error.message || 'Failed to generate content',
    }, { status: 500 });
  }
}
