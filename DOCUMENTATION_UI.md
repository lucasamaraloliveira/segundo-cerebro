# 🎨 Guia de Ajustes de Interface (UI/UX) - Mente+

Este guia detalha onde encontrar e como ajustar os elementos visuais e de interação que foram personalizados para a versão mobile e desktop.

---

## 1. Barra de Navegação Mobile (Bottom Navbar)

**Localização**: `app/page.tsx` (Procure por `{/* MOBILE NAVBAR */}`)

### Ajustes Comuns:
*   **Distribuição dos Menus**: Os botões são divididos em dois grupos `flex-1` para manter o equilíbrio visual em relação ao botão central (+).
*   **Botão de Nova Nota (FAB)**: 
    *   Posição: `fixed bottom-8 left-1/2 -translate-x-1/2`.
    *   Tamanho: `w-14 h-14`.
    *   Para mudar a altura de flutuação, altere o `bottom-8`.
*   **Espaçador Central**: O `div className="w-16"` serve para garantir que os ícones laterais não fiquem embaixo do botão (+).

---

## 2. Especialista Neural (Chatbot IA)

**Localização**: `components/SpecialistChat.tsx`

### Comportamento Mobile (Bottom Sheet):
*   **Arrastar para Fechar**: Implementado via `framer-motion` no `motion.div` principal.
    *   Lógica: `drag="y"` e `onDragEnd={(_, info) => { if (info.offset.y > 150) setIsOpen(false); }}`.
    *   Para tornar mais sensível ou difícil de fechar, altere o valor `150`.
*   **Altura**: Definida como `max-md:h-[85vh]`.

### Comportamento Desktop:
*   **Redimensionamento**: Controlado pelos estados `size` e os handlers `onMouseDown` nos cantos superiores e laterais.
*   **Posição**: `md:bottom-24 md:right-8`.

---

## 3. Modal de Configurações & Tags

**Localização**: `app/page.tsx`

### Configurações:
*   **Responsividade**: O modal utiliza `flex flex-col max-h-[90vh]` e a área interna tem `overflow-y-auto`.
*   **Padding**: Ajustado via `p-6 md:p-10` para ser mais compacto no celular.

### Filtro de Tags (Mobile):
*   **Destaque de Seleção**: Dentro do `allTags.map`, a classe condicional verifica `activeTag === tag`.
*   **Indicador Pulsante**: O pequeno círculo colorido que aparece ao lado da tag selecionada é animado com `animate-pulse`.

---

## 4. Gestão de Tags (Exclusão e Undo)

**Localização**: `app/page.tsx` (Lógica)

*   **Exclusão Global**: Função `executeGlobalTagDelete`. Ela percorre todas as notas do usuário e remove a tag específica de cada uma.
*   **Sistema de Desfazer (Undo)**: 
    *   Utiliza um estado `tagDeleteTimeout` para aguardar 5 segundos antes de consolidar a exclusão no banco de dados.
    *   Se o usuário clicar em "Desfazer" no Toast, a função `undoTagDelete` ou `undoGlobalTagDelete` é chamada, limpando o timer e restaurando o estado visual.

---

## 5. Cores e Temas

**Localização**: `app/globals.css`

*   **Cor de Destaque (Laranja)**: `--accent: #FF4F00;`.
*   **Sombras Brutalistas**: Padronizadas como `shadow-[4px_4px_0px_rgba(0,0,0,0.1)]`.
*   **Fundo do Sistema**: `--background` (atualmente um tom de papel off-white no modo light).

---
*Documentação atualizada em 27 de Abril de 2026.*
