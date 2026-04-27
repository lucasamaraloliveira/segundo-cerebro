import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';

// Simple Cosine Similarity function
function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    mA += vecA[i] * vecA[i];
    mB += vecB[i] * vecB[i];
  }
  mA = Math.sqrt(mA);
  mB = Math.sqrt(mB);
  return dotProduct / (mA * mB);
}

export async function POST(req: Request) {
  try {
    const { query, notes } = await req.json();

    if (!query || !notes) {
      return NextResponse.json({ error: 'Query and notes are required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY?.replace(/['"]/g, '').trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // 1. Generate Embedding for the query
    const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const embedResult = await embedModel.embedContent({
      content: { role: 'user', parts: [{ text: query }] },
      taskType: TaskType.RETRIEVAL_QUERY,
    });
    const queryEmbedding = embedResult.embedding.values;

    // 2. Search for relevant notes
    // Filter notes that have embeddings and calculate similarity
    const relevantNotes = notes
      .filter((n: any) => n.embedding && Array.isArray(n.embedding))
      .map((n: any) => ({
        ...n,
        similarity: cosineSimilarity(queryEmbedding, n.embedding)
      }))
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, 5); // Take top 5

    // 3. Construct Context
    const context = relevantNotes.length > 0
      ? relevantNotes.map((n: any) => `[NOTA: ${n.title}]\n${n.content}`).join('\n\n---\n\n')
      : "Nenhuma nota relevante encontrada.";

    // 4. Generate Answer using Gemini 3.1 Flash Lite Preview
    const chatModel = genAI.getGenerativeModel(
      { model: "gemini-3.1-flash-lite-preview" },
      { apiVersion: 'v1beta' }
    );
    const prompt = `
Você é o "Especialista Neural" do sistema Segundo Cérebro. 
Seu objetivo é ajudar o usuário com base exclusivamente no conhecimento contido nas notas dele.

REGRAS:
1. Use as notas fornecidas no CONTEXTO abaixo para responder.
2. Se a informação não estiver nas notas, admita que você ainda não tem esse conhecimento registrado, mas tente sugerir algo relacionado se possível.
3. Mantenha um tom profissional, analítico e brutalista (direto ao ponto).
4. Sempre mencione o título da nota de onde tirou a informação (ex: "Conforme sua nota [Título]...").

CONTEXTO DAS NOTAS DO USUÁRIO:
${context}

PERGUNTA DO USUÁRIO:
${query}
    `;

    const result = await chatModel.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({
      text,
      sources: relevantNotes.map((n: any) => ({ id: n.id, title: n.title }))
    });

  } catch (error: any) {
    console.error('Chat Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
