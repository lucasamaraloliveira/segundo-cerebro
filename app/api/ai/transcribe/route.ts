import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes for larger files

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY?.replace(/['"]/g, '').trim();

    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API Key is not configured.' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-1.5-flash for faster and efficient transcription
    const model = genAI.getGenerativeModel(
      { model: 'gemini-3.1-flash-lite-preview' },
      { apiVersion: 'v1beta' }
    );

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');

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
            { text: "Transcreva o conteúdo deste arquivo de mídia exatamente como está em português. Retorne apenas o texto transcrito, sem introduções ou comentários." },
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
