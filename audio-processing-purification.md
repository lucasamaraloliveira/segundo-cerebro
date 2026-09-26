# Plano de Implementação: Saída Pura no Processamento de Áudio

**Objetivo:** Eliminar 100% dos preâmbulos conversacionais ("Aqui está", "Certamente", etc.) e entregar saídas limpas e diretas em todos os formatos de processamento de áudio (transcrição simples, ata, resumo, tarefas, e-mail).

---

## 🎯 Escopo de Aplicação
- Rota de API: `app/api/ai/transcribe/route.ts`
- Formatos cobertos: `transcribe`, `meeting_minutes`, `email`, `summary`, `tasks`
- Modelos suportados: `gemini-3.8-flash` (primário), `gemini-3.1-flash-lite` (fallback), `gemini-3.5-flash` (contingência)

---

## 📋 Tarefas de Implementação

### Fase 1: Isolamento de Instrução de Sistema (System Instruction)
- [x] **Tarefa 1.1:** Definir constante `SYSTEM_INSTRUCTION` em `app/api/ai/transcribe/route.ts` com regras rígidas de saída pura (anti-conversacional, proibição de preâmbulos e meta-texto).
- [x] **Tarefa 1.2:** Injetar `systemInstruction` na inicialização do modelo (`genAI.getGenerativeModel({ model, systemInstruction, generationConfig })`).
- [x] **Tarefa 1.3:** Calibrar `generationConfig` com `temperature: 0.1` e `thinkingBudget: 0` para máxima obediência e determinismo.

### Fase 2: Blindagem e Estruturação dos Prompts por Formato
- [x] **Tarefa 2.1:** Refatorar o prompt de `transcribe` para exigir início imediato com o texto falado puro.
- [x] **Tarefa 2.2:** Refatorar o prompt de `meeting_minutes` com ancoragem obrigatória de primeiro caractere (`# 📋 Ata de Reunião`).
- [x] **Tarefa 2.3:** Refatorar o prompt de `summary` com ancoragem obrigatória de primeiro caractere (`## 💡 Resumo Geral`).
- [x] **Tarefa 2.4:** Refatorar o prompt de `email` com ancoragem obrigatória de primeiro caractere (`**Assunto:**`).
- [x] **Tarefa 2.5:** Refatorar o prompt de `tasks` com ancoragem obrigatória de primeiro caractere (`- [ ]`).

### Fase 3: Sanitizador Determinístico de Resposta (Fallback Seguro)
- [x] **Tarefa 3.1:** Implementar a função utilitária `cleanConversationalOutput(rawText: string): string` para podar:
  - Markdown codeblocks acidentais envolvendo todo o documento (````markdown ... ````)
  - Preâmbulos de IA (ex: "Aqui está", "Com certeza", "Segue abaixo", "Certamente")
  - Saudações e despedidas finais (ex: "Espero que ajude", "Qualquer dúvida estou à disposição")
- [x] **Tarefa 3.2:** Aplicar a sanitização no retorno da API antes do envio da resposta JSON.

### Fase 4: Verificação e Testes
- [x] **Tarefa 4.1:** Validação estática de tipos e compilação do TypeScript (`npx tsc --noEmit` aprovado com 0 erros).
- [ ] **Tarefa 4.2:** Testes funcionais em runtime via interface ([RichTextEditor.tsx](file:///d:/AlrionTech/Portif%C3%B3lio/segundo-cerebro/components/RichTextEditor.tsx) e [SpecialistChat.tsx](file:///d:/AlrionTech/Portif%C3%B3lio/segundo-cerebro/components/SpecialistChat.tsx)).
