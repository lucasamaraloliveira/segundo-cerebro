import { NextResponse } from 'next/server';
import { runAIWithFallback } from '@/lib/ai-runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { notes } = await req.json();

    if (!notes || !Array.isArray(notes) || notes.length === 0) {
      return NextResponse.json({ groups: [] });
    }

    const apiKey = process.env.GEMINI_API_KEY?.replace(/['"]/g, '').trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not configured' }, { status: 500 });
    }

    // Montar inventário ultraleve para a IA
    const inventory = notes
      .slice(0, 100) // Limite seguro para análise
      .map(n => `- ID: ${n.id} | "${n.title || 'Sem título'}" | Tags: ${(n.tags || []).join(', ') || 'Nenhuma'}`)
      .join('\n');

    const prompt = `Você é um arquiteto de informação e taxonomia cognitiva.
Analise a lista de notas do Segundo Cérebro abaixo e agrupe-as em 3 a 7 macro-categorias temáticas lógicas para compor um Mapa Mental.

INVENTÁRIO DE NOTAS:
${inventory}

DIRETRIZES FUNDAMENTAIS:
1. Agrupe notas com temas afins, assuntos em comum ou tags complementares (ex: agrupar notas sobre ASL juntas, notas técnicas juntas, anotações de reuniões juntas).
2. O nome do grupo deve ser claro, conciso e elegante (ex: "Tecnologia & Desenvolvimento", "ASL Academy & Operações", "Gestão & Produtividade", "Ideias & Criatividade").
3. Cada nota deve pertencer preferencialmente a 1 grupo mais adequado. Use exatamente os IDs listados.
4. Escolha uma cor hexadecimal harmoniosa para cada grupo entre: ["#FF4F00", "#3B82F6", "#10B981", "#F59E0B", "#0D9488", "#6366F1", "#EC4899", "#8B5CF6"].

Retorne ESTRITAMENTE um JSON válido (sem markdown, sem texto antes ou depois) no formato:
{
  "rootTitle": "Segundo Cérebro",
  "groups": [
    {
      "name": "Nome da Categoria",
      "color": "#FF4F00",
      "noteIds": ["id1", "id2"]
    }
  ]
}`;

    const aiResult = await runAIWithFallback(apiKey, { prompt });
    let parsed: any = null;

    try {
      const cleaned = (aiResult.text || '')
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.warn('Erro ao fazer parse do JSON do Mindmap, usando fallback heurístico:', e);
    }

    if (!parsed || !Array.isArray(parsed.groups)) {
      return NextResponse.json({
        rootTitle: "Segundo Cérebro",
        groups: [],
        meta: aiResult.meta
      });
    }

    return NextResponse.json({
      rootTitle: parsed.rootTitle || "Segundo Cérebro",
      groups: parsed.groups,
      meta: aiResult.meta
    });

  } catch (error: any) {
    console.error('Erro na rota de Mindmap AI:', error);
    return NextResponse.json({ error: error.message || 'Falha ao agrupar com IA' }, { status: 500 });
  }
}
