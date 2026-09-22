import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AIMetadata {
  modelUsed: string;
  isFallback: boolean;
  originalModel: string;
  reason?: string;
}

export interface AIGenerationResult {
  text: string;
  meta: AIMetadata;
}

export const PRIMARY_MODEL = 'gemini-3.1-flash-lite';
export const FALLBACK_MODEL = 'gemini-3.8-flash';
export const EMERGENCY_MODEL = 'gemini-1.5-flash';

/**
 * Detecta se o erro retornado pela API indica alta demanda, sobrecarga ou quota esgotada.
 */
export function isHighDemandError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const status = error.status || error.statusCode || (error.response ? error.response.status : null);

  // Códigos de status HTTP comuns para sobrecarga/taxa limite
  if (status === 429 || status === 503 || status === 504) return true;

  // Mensagens comuns de erro da API do Gemini e proxies
  if (
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('resource_exhausted') ||
    msg.includes('resource exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('overloaded') ||
    msg.includes('high demand') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('service unavailable') ||
    msg.includes('deadline exceeded')
  ) {
    return true;
  }

  return false;
}

export interface GenerateOptions {
  prompt?: string;
  contents?: any[];
  generationConfig?: any;
  apiVersion?: string;
}

/**
 * Executa uma geração de IA priorizando o modelo principal (gemini-3.1-flash-lite).
 * Em caso de alta demanda ou indisponibilidade, aciona automaticamente o modelo
 * alternativo de menor consumo de tokens (gemini-3.8-flash) e, se necessário, o de emergência.
 */
export async function runAIWithFallback(
  apiKey: string,
  options: GenerateOptions
): Promise<AIGenerationResult> {
  const modelsToTry = [
    { id: PRIMARY_MODEL, label: '3.1 Flash Lite' },
    { id: FALLBACK_MODEL, label: '3.8 Flash' },
    { id: EMERGENCY_MODEL, label: '1.5 Flash' }
  ];

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: any = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const current = modelsToTry[i];
    const isFallback = i > 0;

    try {
      const model = genAI.getGenerativeModel(
        { model: current.id, generationConfig: options.generationConfig },
        { apiVersion: options.apiVersion || 'v1beta' }
      );

      let result;
      if (options.contents) {
        result = await model.generateContent(options.contents);
      } else if (options.prompt) {
        result = await model.generateContent(options.prompt);
      } else {
        throw new Error('Nenhum prompt ou contents fornecido para runAIWithFallback');
      }

      const response = await result.response;
      const text = response.text();

      return {
        text,
        meta: {
          modelUsed: current.id,
          isFallback,
          originalModel: PRIMARY_MODEL,
          reason: isFallback
            ? `Modelo principal (${PRIMARY_MODEL}) em alta demanda. Alternado automaticamente para ${current.id} (${current.label}) para garantir resposta rápida e menor consumo de tokens.`
            : undefined
        }
      };
    } catch (err: any) {
      console.warn(`[AI Runner] Falha no modelo ${current.id}:`, err?.message || err);
      lastError = err;

      // Se for erro de alta demanda ou se o modelo específico não for encontrado, tenta o próximo
      const isDemandOrNotFound = isHighDemandError(err) || (err?.message && err.message.toLowerCase().includes('not found'));

      if (i < modelsToTry.length - 1 && isDemandOrNotFound) {
        console.info(`[AI Runner] Acionando modelo de contingência... Próximo: ${modelsToTry[i + 1].id}`);
        continue;
      }

      // Se não for problema de infraestrutura/demanda (ex: chave de API inválida), interrompe de imediato
      if (!isDemandOrNotFound) {
        throw err;
      }
    }
  }

  throw lastError;
}
