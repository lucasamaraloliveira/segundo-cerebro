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

### 3.3 Motor Físico do Grafo
Configurado no `KnowledgeGraph.tsx`, utiliza forças de repulsão (`-2000`) e colisão (`60`) para garantir que as notas se espalhem organicamente pela tela, evitando sobreposições indesejadas.

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

---

## 5. Troubleshooting Comum

*   **O Grafo aparece amontoado**: Verifique se o `useEffect` de redimensionamento em `dashboard/page.tsx` está disparando corretamente. O grafo precisa de largura/altura > 0 para inicializar.
*   **PDF cortando texto**: Certifique-se de que a largura do container de exportação no CSS (`.pdf-export-container`) é fixa (ex: `800px`) para coincidir com a escala do Canvas.
*   **Botão Sair Foco sumiu**: O botão é renderizado de forma flutuante no `app/page.tsx` apenas quando `isFullscreen` é true. Verifique o Z-index se ele estiver sendo coberto por outros elementos.

---
*Documentação gerada em 23 de Abril de 2026.*
