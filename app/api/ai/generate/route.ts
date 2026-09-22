import { NextResponse } from 'next/server';
import { runAIWithFallback } from '@/lib/ai-runner';
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

    const result = await runAIWithFallback(apiKey, { prompt });
    return NextResponse.json({
      text: result.text,
      meta: result.meta
    });
  } catch (error: any) {
    console.error('Erro Geral na Rota AI:', error);
    return NextResponse.json({
      error: error.message || 'Failed to generate content',
    }, { status: 500 });
  }
}
