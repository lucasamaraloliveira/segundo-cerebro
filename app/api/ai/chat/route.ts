import { NextResponse } from 'next/server';
import { runAIWithFallback } from '@/lib/ai-runner';

// Helper para limpar tags HTML para preview de texto denso
function cleanText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(req: Request) {
  try {
    const { query, notes, file, urlsContent } = await req.json();

    if (!query || !notes) {
      return NextResponse.json({ error: 'Query and notes are required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY?.replace(/['"]/g, '').trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not configured' }, { status: 500 });
    }

    // 1. Filtrar todas as notas válidas do usuário (novas e antigas)
    const allUserNotes = (notes || []).filter((n: any) => n.title !== '__neural_chat_history__');

    if (allUserNotes.length === 0) {
      return NextResponse.json({
        text: 'Nenhuma nota encontrada no seu Segundo Cérebro para consulta.',
        sources: []
      });
    }

    // 2. Extrair termos e tags da query (ex: "#asl", "asl")
    const normalizedQuery = query.toLowerCase();
    const tagMatches = (normalizedQuery.match(/#([\w-]+)/g) || []).map((t: string) => t.replace('#', '').toLowerCase());
    const queryTokens = normalizedQuery
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter((t: string) => t.length > 2);

    // 3. Montar o Índice Mestre Compacto de TODAS as notas (ultraleve, sem IDs técnicos)
    const masterIndex = allUserNotes.map((n: any) => {
      const tagsStr = (n.tags || []).map((t: string) => `#${t.replace(/^#+/, '')}`).join(' ');
      return `- "${n.title || 'Sem título'}" | Tags: ${tagsStr || 'Nenhuma'}`;
    }).join('\n');

    // 4. Seleção Focada de Conteúdo: calcular relevância para injetar texto apenas das notas pertinentes
    const scoredNotes = allUserNotes.map((n: any) => {
      let score = 0;
      const titleLower = (n.title || '').toLowerCase();
      const tagsLower = (n.tags || []).map((t: string) => t.toLowerCase());
      const contentClean = cleanText(n.content || '');
      const contentLower = contentClean.toLowerCase();

      // Score por tag explícita (#asl)
      tagMatches.forEach((tag: string) => {
        if (tagsLower.includes(tag)) score += 10;
        if (titleLower.includes(tag)) score += 6;
        if (contentLower.includes(tag)) score += 3;
      });

      // Score por tokens da pergunta
      queryTokens.forEach((token: string) => {
        if (tagsLower.some((t: string) => t.includes(token))) score += 4;
        if (titleLower.includes(token)) score += 3;
        if (contentLower.includes(token)) score += 1;
      });

      return { note: n, score, contentClean };
    });

    // Ordena por relevância e seleciona as mais aderentes para incluir o conteúdo detalhado (máximo 8-10 notas)
    const matchingNotes = scoredNotes
      .filter((item: { score: number }) => item.score > 0)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

    const notesToInjectContent = matchingNotes.length > 0 
      ? matchingNotes.slice(0, 10) 
      : scoredNotes.slice(0, 4);

    // Formata o conteúdo detalhado apenas para as notas selecionadas (resumo conciso de até 700 chars, sem IDs)
    const detailedContent = notesToInjectContent.map(({ note: n, contentClean }: { note: any; contentClean: string }) => {
      const tagsList = (n.tags || []).map((t: string) => `#${t.replace(/^#+/, '')}`).join(' ');
      const truncated = contentClean.length > 700 ? `${contentClean.slice(0, 700)}...` : contentClean;
      return `[NOTA: "${n.title || 'Sem título'}"]
Tags: ${tagsList || 'Nenhuma'}
Conteúdo: ${truncated || '(Sem conteúdo textual)'}`;
    }).join('\n\n---\n\n');

    // 5. Prompt otimizado e balanceado
    const prompt = `
Você é o "Especialista Neural" do sistema Segundo Cérebro. 
Responda de forma analítica, profissional, direta e fluida com base no acervo de notas do usuário.

INVENTÁRIO DO SEGUNDO CÉREBRO:
Total de notas catalogadas: ${allUserNotes.length} notas.

ÍNDICE MESTRE DE TODAS AS NOTAS:
${masterIndex}

CONTEÚDO DETALHADO DAS NOTAS MAIS RELEVANTES:
${detailedContent || '(Nenhum conteúdo específico necessário)'}

${urlsContent ? `\nCONTEXTO EXTERNO FORNECIDO (LINKS):\n${urlsContent}` : ''}

DIRETRIZES FUNDAMENTAIS:
1. FOCO NA ANÁLISE: Forneça uma análise inteligente, clara e contextualizada da pergunta.
2. NUNCA EXIBA IDs: Sob nenhuma hipótese exiba identificadores de banco, códigos técnicos ou IDs nas respostas.
3. NÃO DESPEJE LISTAS CRUAS NO MEIO DA RESPOSTA: Não interrompa o fluxo do texto listando notas ou títulos soltos no meio da explicação. Desenvolva o raciocínio de forma analítica.
4. QUANTIDADE NO FINAL: Se a pergunta for sobre quantidade, catálogo ou contagem de notas, apresente a sua resposta analítica e, ao final, informe naturalmente o total encontrado (exemplo: "Totalizando X notas identificadas sobre este tema.").
5. AS FONTES FICAM NO RODAPÉ: A interface gráfica do sistema já exibe automaticamente os botões das notas referenciadas no rodapé da mensagem. Portanto, não é necessário fazer uma listagem manual repetitiva no corpo da resposta.

PERGUNTA DO USUÁRIO:
${query}
    `;

    let contentParts: any[] = [prompt];

    if (file && file.data && file.mimeType) {
      contentParts.push({
        inlineData: {
          data: file.data,
          mimeType: file.mimeType
        }
      });
    }

    // 6. Executar geração com fallback automático (3.1 Flash Lite -> 3.8 Flash)
    const aiResult = await runAIWithFallback(apiKey, { contents: contentParts });
    const responseText = aiResult.text || '';

    // 7. Mapear fontes relevantes que coincidem com a busca ou foram citadas na resposta
    const citedOrMatchingNotes = allUserNotes.filter((n: any) => {
      const title = (n.title || '').toLowerCase();
      const tags = (n.tags || []).map((t: string) => t.toLowerCase());
      
      const matchesSearchedTag = tagMatches.some((searched: string) => 
        tags.some((t: string) => t.includes(searched)) || title.includes(searched)
      );

      const isCitedInResponse = title.length > 2 && responseText.toLowerCase().includes(title);

      const matchesTokens = tagMatches.length === 0 && queryTokens.some((token: string) => 
        tags.includes(token) || title.includes(token)
      );

      return matchesSearchedTag || isCitedInResponse || matchesTokens;
    });

    const finalSources = citedOrMatchingNotes.length > 0 
      ? citedOrMatchingNotes.slice(0, 35) 
      : allUserNotes.slice(0, 10);

    return NextResponse.json({
      text: responseText,
      meta: aiResult.meta,
      sources: finalSources.map((n: any) => ({ id: n.id, title: n.title }))
    });

  } catch (error: any) {
    console.error('Chat Error:', error);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
