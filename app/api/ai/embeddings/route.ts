import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const { text, texts } = await req.json();

    if (!text && (!texts || !Array.isArray(texts))) {
      return NextResponse.json({ error: 'Text or texts array is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY?.replace(/['"]/g, '').trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

    // Handle Batch Request
    if (texts && Array.isArray(texts)) {
      const result = await model.batchEmbedContents({
        requests: texts.map(t => ({
          content: { role: 'user', parts: [{ text: t }] },
          taskType: TaskType.RETRIEVAL_DOCUMENT,
        }))
      });
      const embeddings = result.embeddings.map(e => e.values);
      return NextResponse.json({ embeddings });
    }

    // Handle Single Request
    const result = await model.embedContent({
      content: { role: 'user', parts: [{ text }] },
      taskType: TaskType.RETRIEVAL_DOCUMENT,
    });
    const embedding = result.embedding.values;

    return NextResponse.json({ embedding });
  } catch (error: any) {
    console.error('Embedding Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
