# 🧠 Segundo Cérebro - Documentação do Sistema & Manutenção

Esta documentação detalha a arquitetura, estrutura de arquivos e procedimentos de manutenção para o ecossistema **Segundo Cérebro (Neural Interface)**.

---

## 1. Arquitetura Geral

O sistema é construído sobre uma stack moderna e de alta performance:

*   **Framework**: [Next.js 15 (App Router)](https://nextjs.org/) - Utiliza React Server Components (RSC) e Client Components de forma híbrida.
*   **Backend & Data**: [Firebase](https://firebase.google.com/)
    *   **Firestore**: Banco de dados NoSQL orientado a documentos para notas, etiquetas e metadados.
    *   **Authentication**: Gestão de identidade (Google Login e Email/Senha).
    *   **Storage**: Armazenamento de mídia e arquivos anexos.
*   **Editor de Texto**: [Tiptap](https://tiptap.dev/) - Editor headless baseado em ProseMirror, altamente extensível.
*   **Visualização de Dados**: [react-force-graph-2d](https://github.com/vasturiano/react-force-graph) - Motor de grafos baseado em D3.js para o mapeamento neural.
*   **Estilização**: Tailwind CSS (v4) com um sistema de design brutalista/minimalista customizado.
*   **Exportação**: jsPDF + html2canvas para geração de PDFs com fidelidade visual de 2x.
*   **Guia de UI**: [Ajustes Visuais & Mobile](./DOCUMENTATION_UI.md) - Guia detalhado para manutenção da interface.

---

## 2. Estrutura de Arquivos

### `/app` (Rotas e Páginas)
*   `page.tsx`: Interface principal. Gerencia a lista de notas, o editor ativo e o estado do **Modo Foco (Zen Mode)**.
*   `dashboard/page.tsx`: Dashboard Neural. Calcula estatísticas e renderiza o grafo de conexões.
*   `layout.tsx`: Configurações globais, fontes (Inter, Georgia, Playfair) e provedores de contexto.
*   `globals.css`: Definição de tokens de design, variáveis de tema (Light/Dark) e estilos utilitários.

### `/components` (Componentes Reutilizáveis)
*   `RichTextEditor.tsx`: O coração do sistema. Integra o Tiptap, a toolbar adaptativa, transcrição de áudio e lógica de colagem inteligente.
*   `KnowledgeGraph.tsx`: Componente de visualização do grafo. Configura as forças físicas (D3 ManyBody, Collide, Link) e renderização em Canvas.
*   `Sidebar.tsx`: Gestão de navegação lateral e filtros de etiquetas.
*   `NoteCard.tsx`: Preview de notas com suporte a estados ativos/inativos.

### `/lib` (Configurações e Utilidades)
*   `firebase.ts`: Inicialização do SDK do Firebase e exportação dos serviços (db, auth, storage).
*   `types.ts`: Definições de interfaces TypeScript para garantir type-safety em todo o projeto.

---

## 3. Funcionalidades Chave & Lógica Interna

### 3.1 Barra de Ferramentas Adaptativa
A toolbar no `RichTextEditor.tsx` alterna entre dois modos:
*   **Simplificado (Normal)**: Exibe apenas o essencial para evitar poluição visual.
*   **Completo (Modo Foco)**: Ativado via `isFocusMode={true}`, revela ferramentas avançadas de tipografia e alinhamento.

### 3.2 Exportação de PDF
Localizada no `app/page.tsx` (`exportAsPDF`), utiliza um processo de:
1.  Renderização oculta de uma versão "limpa" della nota.
2.  Captura via `html2canvas` com escala de 2.0.
3.  Fatiamento manual de imagens para garantir que parágrafos longos não sejam cortados entre as páginas.

### 3.3 Motor Físico do Grafo (Constelações & Inteligência Visual)
Configurado no `KnowledgeGraph.tsx` e `app/dashboard/page.tsx`, utiliza um modelo de **Grafo Bipartido de Constelações com Expansão Harmônica**:
*   **Tags como Hubs Centrais**: Em vez de conectar todas as notas com a mesma tag entre si (o que causaria emaranhado caótico $O(N^2)$), cada tag é renderizada como um núcleo orbital (#tag).
*   **Raios de Constelação**: As notas orbitam seu respectivo hub de tag de forma equilibrada, mantendo o grafo limpo e visualmente navegável.
*   **Ilhas Temáticas de Fundo (Auras)**: Cada núcleo projeta uma aura translúcida com a cor do tema, criando "bairros" cósmicos visíveis à primeira vista.
*   **Tipografia com Efeito Halo (Sem Tarjas Pretas)**: Todos os rótulos de tópicos e notas utilizam contorno suave (`strokeText`) na cor exata do tema ativo (Light/Dark), eliminando caixas e retângulos opacos. O fundo permanece 100% limpo e transparente.
*   **Nível de Detalhe por Zoom (LOD)**: Na visão panorâmica, exibem-se apenas os tópicos centrais (`#tag`) e notas favoritadas (`⭐`). Conforme o usuário aproxima o zoom (`>= 1.15`) ou passa o mouse, os títulos das notas se revelam suavemente sem nunca se sobreporem.
*   **Spotlight Neural (Busca `Ctrl+K`)**: Campo de pesquisa flutuante que ilumina em tempo real as notas coincidentes, escurece o ruído e guia a câmera suavemente até o resultado.
*   **Painel Lateral de Inspeção Rápida**: Clicar em qualquer nó abre uma gaveta deslizante à direita na própria Dashboard, permitindo pré-visualizar o pensamento, data e tags sem trocar de tela.
*   **Expansão Harmônica (Cosmic Bloom)**: Os nós nascem em casulo e desabrocham suavemente com atrito viscoso (`velocityDecay: 0.24`) e gravidade central contínua (`centerStrength: 0.08`), eliminando velocidades de escape.
*   **Auto-Enquadramento & Recentralizar**: Executa `zoomToFit` inteligente no carregamento e oferece o botão HUD `Recentralizar` para reenquadrar o mapa a qualquer momento.

---

## 4. Guia de Manutenção

### 4.1 Atualização de Regras de Segurança
O arquivo `firestore.rules` define quem pode ler/escrever. Sempre valide que as operações estão protegidas por `request.auth.uid`.

```bash
# Para fazer deploy apenas das regras:
firebase deploy --only firestore:rules
```

### 4.2 Adicionando Novas Extensões ao Editor
Para adicionar novas funcionalidades (ex: tabelas, imagens) ao editor:
1.  Instale a extensão do Tiptap: `npm install @tiptap/extension-table`.
2.  Importe e adicione ao array `extensions` no `useEditor` dentro do `RichTextEditor.tsx`.
3.  Adicione o botão correspondente na `ToolbarButton` dentro do JSX, respeitando a lógica adaptativa.

### 4.3 Ajuste de Estética (Temas)
Todas as cores são baseadas em variáveis CSS em `globals.css`.
*   Para mudar a cor principal do sistema, altere `--accent: #FF4F00;`.
*   O sistema suporta Dark Mode nativo através da classe `.dark`.

### 4.4 Deployment (Vercel)
O projeto está configurado para deploy contínuo na Vercel.
*   As variáveis de ambiente (`NEXT_PUBLIC_FIREBASE_...`) devem estar espelhadas no painel da Vercel conforme o seu `.env.local`.

### 4.5 Controle de Versões da Aplicação
A versão da aplicação é gerenciada dinamicamente e sincronizada:
1.  **Fonte da Verdade**: Campo `"version"` em `package.json`.
2.  **Módulo Central**: `lib/version.ts` consome a versão e exporta `APP_VERSION` (ex: `v0.1.0`).
3.  **Exibição Visual (Híbrida)**:
    *   **Barra Lateral (Desktop) & Topo (Mobile)**: Exibida logo abaixo do título `Cérebro²` de forma minimalista (`vX.X.X`), com indicador de status e atalho direto para o modal.
    *   **Modal de Configurações**: Seção *"Sobre o Sistema"* com versão atual, nome da aplicação e ambiente ativo.
4.  **Como gerar nova versão**:
    *   Execute `npm version patch` (ou `minor` / `major`) ou edite o campo `"version"` no `package.json`.
    *   A nova versão será automaticamente refletida em toda a interface sem necessidade de alterações manuais no código.

---

## 5. Histórico de Versões & Melhorias

### v1.2.1 (Setembro 2026) - Correção de Título & Experiência Mobile
*   **Correção de Visibilidade do Título no Mobile**: Resolução do colapso de altura (`0px`) no textarea de título ao ser montado em containers com `display: none` ou durante animações. Adicionada cota mínima de altura (`min-h-[44px]`) e observação de `activeNote.id`.
*   **Navegação Direta no Mobile**: Ao tocar no botão flutuante (`+`) ou clonar uma nota, a visualização mobile agora transiciona instantaneamente para a tela do editor (`setMobileView('editor')`), eliminando a permanência na lista.
*   **Recálculo no Toque/Foco**: Garantia de redimensionamento instantâneo do título ao receber foco (`onFocus`) no teclado mobile.

### v1.2.0 (Setembro 2026) - Toolbar Inteligente, Transições Fluidas, Nova Suíte Tipográfica & Controles Táteis
*   **Sistema de Transbordo Inteligente (*Smart Overflow*)**: Organização da toolbar em níveis prioritários (Tier 1 a 4) com sincronização em tempo real via `useLayoutEffect` e medição contínua a 60fps sem necessidade de cliques.
*   **Micro-Animações Orgânicas**: Entrada e saída elástica de botões com `framer-motion` (`AnimatePresence` + `motion.div`), eliminando cortes secos e engasgos de layout ao redimensionar a tela.
*   **Suíte Tipográfica Expandida (11 Famílias)**: Inclusão de fontes de alto padrão (Inter, Roboto, Ubuntu, Plus Jakarta Sans, Arial, Times New Roman, Cormorant Garamond, Lora, JetBrains Mono, Space Mono e Caveat) com carregamento otimizado via `next/font/google` (zero layout shift / CLS).
*   **Controles Táteis no Menu "..."**: Substituição de controles nativos por componentes interativos refinados — acordeão de fontes com prévia autêntica, chips numéricos de tamanho em 1 toque, paleta de cores em swatches circulares táteis e segmented control com ícones vetoriais de alinhamento.
*   **Harmonização Total**: Consistência visual entre modo desktop, telas compactas e drawer móvel.

### v1.0.0 (Setembro 2026) - Lançamento da Primeira Versão de Produção
*   Editor de texto rico baseado em Tiptap com suporte a Markdown, exportação para PDF e transcrição de áudio por inteligência artificial.
*   Grafo de conhecimento neural 2D interativo com conexões bidirecionais entre notas e busca vetorial.
*   Sistema de busca rápida e comandos via Command Palette (`Ctrl+K`).
*   Suporte completo a modo claro/escuro com tema ergonômico e design neo-brutalist refinado.

### v0.2.0 (Setembro 2026) - Ergonomia Visual & Paleta Papel Editorial (Light Mode)
*   **Fim do "Clarão Branco"**: Transição de `#ffffff` puro para paleta de papel editorial aquecido (`#f9f8f6`), reduzindo a fadiga pupilar por contraste excessivo.
*   **Sidebar e Superfícies Suaves**: Sidebar e painéis em tom marfim/pergaminho suave (`#f2efe9`), com bordas sutis de tinta preta diluída (`rgba(24, 24, 27, 0.08)`).
*   **Acento Ergonômico**: Cor de acento no modo claro ajustada para Terracotta Quente / Burnt Sienna (`#e64a00`), mantendo alto impacto visual sem agressividade luminosa.
*   **Cores Neurais Adaptativas**: Nós do grafo neural no modo claro utilizam tintas de arquivo ricas (Terracotta, Navy Profundo, Sálvia Floresta, Âmbar Quente, Carmim, etc.), preservando o modo escuro com cores cibernéticas de alto contraste.
*   **Sinapses & Halo Calibrados**: As linhas do grafo no modo claro emulam traços de grafite sutis (`rgba(24, 24, 27, 0.12)`), e o efeito halo de texto utiliza o exato tom de papel `#f9f8f6` para perfeita integração.
*   **Malha de Fundo Suave**: Grid pontilhado (`bg-dot-matrix`) atenuado para `opacity-[0.035]` no modo claro, eliminando ruído estroboscópico na visão periférica.

---

## 6. Troubleshooting Comum

*   **O Grafo aparece amontoado**: Verifique se o `useEffect` de redimensionamento em `dashboard/page.tsx` está disparando corretamente. O grafo precisa de largura/altura > 0 para inicializar.
*   **PDF cortando texto**: Certifique-se de que a largura do container de exportação no CSS (`.pdf-export-container`) é fixa (ex: `800px`) para coincidir com a escala do Canvas.
*   **Botão Sair Foco sumiu**: O botão é renderizado de forma flutuante no `app/page.tsx` apenas quando `isFullscreen` é true. Verifique o Z-index se ele estiver sendo coberto por outros elementos.

---
*Documentação atualizada para a versão v1.2.1.*
