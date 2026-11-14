import { NextResponse } from 'next/server';
import { runAIWithFallback } from '@/lib/ai-runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds for Vercel execution

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
    const { query, notes, file, urlsContent, noteImages, activeNoteId, mentionedNoteIds } = await req.json();

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

    // 4. Notas Ancoradas Explicitamente pelo Usuário (@)
    const mentionedIdsSet = new Set(Array.isArray(mentionedNoteIds) ? mentionedNoteIds : []);
    const anchoredNotes = allUserNotes.filter((n: any) => mentionedIdsSet.has(n.id));
    const anchoredContent = anchoredNotes.map((n: any) => {
      const tagsList = (n.tags || []).map((t: string) => `#${t.replace(/^#+/, '')}`).join(' ');
      const contentClean = cleanText(n.content || '');
      const truncated = contentClean.length > 3500 ? `${contentClean.slice(0, 3500)}...` : contentClean;
      return `[NOTA ANCORADA (@): "${n.title || 'Sem título'}"]
Tags: ${tagsList || 'Nenhuma'}
Conteúdo Completo: ${truncated || '(Sem conteúdo textual)'}`;
    }).join('\n\n---\n\n');

    // 5. Seleção Focada de Conteúdo: calcular relevância para injetar texto apenas das notas pertinentes (excluindo as já ancoradas)
    const remainingNotes = allUserNotes.filter((n: any) => !mentionedIdsSet.has(n.id));
    const scoredNotes = remainingNotes.map((n: any) => {
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
      : (anchoredNotes.length > 0 ? [] : scoredNotes.slice(0, 4));

    // Formata o conteúdo detalhado apenas para as notas selecionadas (resumo conciso de até 700 chars, sem IDs)
    const detailedContent = notesToInjectContent.map(({ note: n, contentClean }: { note: any; contentClean: string }) => {
      const tagsList = (n.tags || []).map((t: string) => `#${t.replace(/^#+/, '')}`).join(' ');
      const truncated = contentClean.length > 700 ? `${contentClean.slice(0, 700)}...` : contentClean;
      return `[NOTA: "${n.title || 'Sem título'}"]
Tags: ${tagsList || 'Nenhuma'}
Conteúdo: ${truncated || '(Sem conteúdo textual)'}`;
    }).join('\n\n---\n\n');

    // 6. Prompt otimizado e balanceado com suporte à Visão Multimodal e Ancoragem (@)
    const hasVisuals = Array.isArray(noteImages) && noteImages.length > 0;

    const prompt = `
Você é o "Especialista Neural" do sistema Mente+ (Segundo Cérebro). 
Responda de forma analítica, profissional, direta e fluida com base no acervo de notas do usuário.

INVENTÁRIO DO SEGUNDO CÉREBRO:
Total de notas catalogadas: ${allUserNotes.length} notas.

ÍNDICE MESTRE DE TODAS AS NOTAS:
${masterIndex}
${anchoredContent ? `
📌 NOTAS ANCORADAS EXPLICITAMENTE PELO USUÁRIO (@):
(PRIORIDADE MÁXIMA: O usuário selecionou e ancorou diretamente a(s) nota(s) abaixo usando "@". Utilize o conteúdo destas notas como referência central da sua resposta.)
${anchoredContent}
` : ''}
CONTEÚDO DETALHADO DAS NOTAS COMPLEMENTARES MAIS RELEVANTES:
${detailedContent || '(Nenhuma nota complementar adicional necessária)'}
${hasVisuals ? `
CAPACIDADE DE VISÃO MULTIMODAL ATIVA:
Foram detectadas e anexadas ${noteImages.length} imagem(ns) das notas relevantes para sua visão direta.
Você é capaz de "ver" diagramas, gráficos, prints, fotos e esquemas visuais contidos nas notas.
Ao responder, descreva e interprete com naturalidade o que você está vendo nas imagens, integrando os dados visuais (textos nos prints, fluxos, números, ilustrações) ao raciocínio analítico da resposta.
` : ''}
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

    // Inserir imagens das notas selecionadas para a visão da IA (até 3 imagens)
    if (hasVisuals) {
      noteImages.slice(0, 3).forEach((img: any, idx: number) => {
        if (img.data && img.mimeType) {
          contentParts.push(`\n[IMAGEM ${idx + 1} DA NOTA "${img.noteTitle || 'Sem título'}"${img.alt ? ` - Legenda: ${img.alt}` : ''}]:`);
          contentParts.push({
            inlineData: {
              data: img.data,
              mimeType: img.mimeType,
            }
          });
        }
      });
    }

    if (file && file.data && file.mimeType) {
      contentParts.push({
        inlineData: {
          data: file.data,
          mimeType: file.mimeType
        }
      });
    }

    // 6. Executar geração com fallback automático (3.5 Flash Lite -> 3.1 Flash Lite -> 2.5 Flash)
    const aiResult = await runAIWithFallback(apiKey, { contents: contentParts });
    const responseText = aiResult.text || '';

    // 7. Mapear fontes relevantes que coincidem com a busca, foram ancoradas (@) ou citadas na resposta
    const citedOrMatchingNotes = allUserNotes.filter((n: any) => {
      if (mentionedIdsSet.has(n.id)) return true;

      const title = (n.title || '').toLowerCase();
      const tags = (n.tags || []).map((t: string) => t.toLowerCase());
      
      const matchesSearchedTag = tagMatches.some((searched: string) => 
        tags.some((t: string) => t.includes(searched)) || title.includes(searched)
      );

      const isCitedInResponse = title.length > 2 && responseText.toLowerCase().includes(title);

      const matchesTokens = anchoredNotes.length === 0 && tagMatches.length === 0 && queryTokens.some((token: string) => 
        tags.includes(token) || title.includes(token)
      );

      return matchesSearchedTag || isCitedInResponse || matchesTokens;
    });

    // Garantir que notas ancoradas (@) fiquem sempre no topo da lista de fontes
    const orderedMatches = [
      ...anchoredNotes,
      ...citedOrMatchingNotes.filter((n: any) => !mentionedIdsSet.has(n.id))
    ];

    const finalSources = orderedMatches.length > 0 
      ? orderedMatches.slice(0, 35) 
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
