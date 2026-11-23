# SDD — ARF-140: Auditoria completa (código + UX como usuário real)

## Contexto
Pedido explícito do usuário: analisar **todo** o código já escrito em busca de incoerências, lacunas de wiring (coisas que deveriam estar conectadas e não estão), bugs reais, e problemas de experiência de usuário (tamanhos de fonte/ícone, usabilidade) — testando como usuário de verdade no Chrome real, não só rodando a suíte de testes automatizados.

## Metodologia
1. Três agentes de auditoria estática em paralelo, cada um cobrindo uma fatia do código (SYNC; CORE/LIVE/protocolo de mensagens; THEME/LAYOUT/QUICK-ACCESS/ZEN + coerência da documentação), com instrução explícita de não corrigir nada, só reportar achados com evidência (arquivo:linha) e severidade.
2. Eu mesmo testando ao vivo no Chrome real conectado via `chrome-devtools` MCP: criei grupo, arrastei abas/janelas vivas (drag-and-drop nativo via gesto real, não simulado), reordenei abas, medi tamanho real de fonte/ícone via `getComputedStyle`, testei o drawer de configurações, testei o bug do Space.
3. Apliquei as correções críticas e as de UX confirmadas ao vivo; documentei como débito técnico consciente o que foi adiado por escopo/risco.

## Achados corrigidos nesta rodada

### Críticos (risco real de perda/divergência de dado ou de UX quebrada)

1. **Pull do Supabase nunca era chamado — login não restaurava dados de outra máquina.** Era o requisito nº1 original do projeto ("logar numa máquina nova restaura tudo") e nunca tinha sido fechado de ponta a ponta: `pullGroups`/`pullTabsByGroup` existiam em `remote.ts` mas nunca eram importados em produção. **Corrigido**: nova função `pullAllTabs` (abas soltas inclusas, a função por-grupo existente não cobria isso), `pullAndMerge`/`fullSync` em `sync.ts` (last-write-wins por `updatedAt`), `mergeGroupFromRemote`/`mergeTabFromRemote` em `storage.ts`, nova mensagem `BOOTSTRAP_SYNC` disparada automaticamente ao final de `signInWithGoogle()` e no alarme periódico de 15min (que antes só fazia push, nunca pull). **Validado ao vivo**: criei um grupo direto no Postgres via SQL (simulando "outro dispositivo"), rodei `BOOTSTRAP_SYNC` na extensão real, o grupo apareceu no IndexedDB local — depois limpo.
   - **Limitação conhecida e aceita**: o merge não recompacta `order` entre abas de origens diferentes dentro do mesmo grupo — se dois dispositivos criarem abas offline no mesmo grupo ao mesmo tempo, pode haver `order` duplicado até a próxima reordenação manual. Aceito por ora (ADR-007 presume uso single-user na prática); resolver isso de verdade exigiria um merge de order bem mais complexo para um cenário que não é o uso real do usuário hoje.

2. **`importDataExport` não enfileirava sync — dados importados (backup/restore) ficavam só locais.** Violava a garantia central de "nunca perder dado" justamente no fluxo de backup. **Corrigido**: `IMPORT_DATA` agora enfileira todos os grupos/abas resultantes e dispara `kickSync`.

3. **`drainQueue` travava a fila inteira para sempre diante de um erro não-transiente.** Um erro de rede (correto parar e re-tentar depois) e um erro de dado (constraint, RLS, payload inválido — nunca vai se resolver sozinho) eram tratados igual: parava tudo, bloqueando indefinidamente qualquer item enfileirado depois. **Corrigido**: heurística `looksLikeNetworkError` distingue os dois casos — erro de rede continua parando e marcando `unreachable`; erro de dado é logado (`console.error`, não mais engolido em silêncio) e a operação problemática é **pulada** (mantida na fila para debug futuro, não descartada), os itens seguintes continuam.

4. **Estado `"syncing"` existia no tipo mas nunca era usado** — o banner de sincronização nunca mostrava "sincronizando", só erro ou nada. **Corrigido**: `drainQueue` seta `syncing` antes de começar a drenar.

5. **Bug de assimetria no reorder de abas, confirmado ao vivo**: arrastar uma aba de uma posição anterior para cima de um alvo posterior a colocava **depois** do alvo em vez de **antes** (inconsistente com o sentido inverso, que já funcionava corretamente). Causa: o índice calculado pelo chamador vem da lista completa (com a origem ainda presente); `reorderTab` removia a origem antes de inserir, sem ajustar o índice, desalinhando por 1 posição quando a origem vinha antes do alvo. **Corrigido** em `storage.ts`, com teste cobrindo exatamente o cenário reproduzido manualmente.

6. **`removeTab` não recompactava `order`** — removendo uma aba do meio de um grupo, a próxima aba adicionada podia colidir com o `order` de uma aba já existente (a invariante "order é 0..n-1 sem buracos", que `reorderTab`/`moveTab` já respeitavam, não era mantida por `removeTab`). **Corrigido**, com teste reproduzindo a colisão.

7. **`UngroupedSection` (seção "Abas soltas") ignorava silenciosamente drops de aba/janela ao vivo** — funcionava em grupos normais, mas soltar uma aba viva em "Abas soltas" não fazia nada, sem nenhum feedback. **Corrigido**, replicando a mesma lógica já usada em `GroupItem.svelte`.

8. **Bug de UX confirmado ao vivo**: apertar Space (atalho global de zen mode) com o foco num botão/slider **dentro do drawer de configurações** ativava zen mode e desmontava o drawer inteiro no meio de uma interação. **Corrigido**: novo estado compartilhado `uiState.settingsOpen` (`src/newtab/lib/uiState.svelte.ts`) faz `App.svelte` suspender todos os atalhos globais de teclado enquanto o drawer estiver aberto.

9. **`isArfyinMessage` mantinha uma segunda lista de strings sem trava de sincronia** com a união de tipos `ArfyinMessage` — um tipo novo esquecido nessa lista faria a mensagem ser rejeitada em silêncio em produção. **Corrigido**: a lista virou um objeto `satisfies Record<ArfyinMessage["type"], true>`, que agora é **erro de compilação** (não mais bug silencioso) se alguém adicionar uma mensagem na união e esquecer de registrá-la aqui (ou vice-versa).

10. **Upload de imagem de background local sem validação de tipo/tamanho, e sem forma de remover depois.** Um arquivo não-imagem ou enorme entrava sem aviso e ficava para sempre (vazamento de armazenamento). **Corrigido**: valida `file.type`/tamanho (10MB), e novo botão de remover por imagem usando a mensagem `DELETE_ASSET` que já existia mas nunca era chamada por nenhuma UI.

11. **Bug confirmado por medição ao vivo**: fonte de 12px e ícones de 14px na lista de abas ao vivo, linha de só 14px de altura — densidade excessiva, exatamente o que o usuário sinalizou. **Corrigido**: padronizado para 13px/16px em toda a lista de abas (salvas e ao vivo), mais respiro vertical (padding de 2-4px para 4-6px), ícones de ação maiores (12-13px → 14-15px) com mais área de toque.

### Menores (corrigidos por serem baratos)

12. `kickSync` engolia qualquer erro silenciosamente (não só a falta de `.env`) — agora loga via `console.error`.
13. Tecla numérica de acesso rápido sem `preventDefault()` quando a ação era reconhecida — adicionado (não resolve o caso-raiz, ver "adiado" abaixo, mas reduz a chance de vazamento quando o evento chega na página).
14. New-tab não disputava o foco inicial com a omnibox do Chrome — `document.body.focus()` adicionado no `onMount`, tentativa de mitigação (sem garantia, é política do Chrome).
15. `fontSize` do relógio até 180px sem proteção contra overflow em janela estreita — `clamp(24px, Npx, 22vw)` aplicado.
16. Ícones de ação (📌 ✕ 🎨 🗑 ⇱ ▼▶ ‹›) só tinham `title` (pouco confiável para leitor de tela) — `aria-label` adicionado em todos.
17. Documentação desatualizada: ADR-010 citava estados de sync (`synced`/`pending`) que nunca existiram de fato; SDD de THEME dizia "formato de data fora de escopo" quando o ARF-130 já tinha implementado. Ambos corrigidos.

## Achados identificados e **deliberadamente não corrigidos** nesta rodada (débito técnico documentado, não esquecido)

- **Padrão "recarrega tudo após toda mutação"** em `store.svelte.ts` (toda ação do usuário, até colapsar 1 grupo, dispara 1 + N mensagens IPC recarregando grupos/abas/config inteiros) — ineficiência real mas sem lentidão perceptível relatada no uso atual (poucas dezenas de grupos/abas). Documentado para otimizar (update otimista local) se o volume de dados crescer ou se ficar perceptível. Pedido explicado ao usuário quando perguntou especificamente sobre este item.
- **Bug de quick-access (tecla numérica indo pra omnibox)** — já registrado em `feature_ideas.md` J4 como adiado a pedido explícito do usuário ("vamos pensar nisso depois"). Apliquei só o `preventDefault()` barato: não mexi na decisão maior (exigir sempre modificador) que fica para quando o tema for retomado.
- **Transição abrupta ao trocar `layoutMode` em runtime** (não no carregamento inicial, que já foi corrigido no ARF-130) — cosmético, sem `transition:`. Não implementado agora.

## Atualização (2026-11-21, mesmo dia) — decisões do usuário sobre os itens em aberto

- **"IndexedDB não particionado por user_id"**: usuário decidiu considerar só uma conta Google mesmo — item fechado, não vira trabalho (risco aceito conscientemente, não esquecido).
- **"Config não sincroniza"**: usuário pediu para implementar. Feito — ver **ADR-014** (`docs/architecture/decisions.md`) e `supabase/migrations/0003_config_table.sql`. Nova tabela `config` (jsonb, 1 linha por usuário), mesmo padrão push/pull/merge last-write-wins já usado para grupos/abas. **Achado de processo durante a validação**: a tabela nova precisou de um `GRANT` explícito além do RLS (`permission denied for table config` na primeira tentativa) — RLS restringe linhas, não concede a operação em si; `groups`/`tabs` já tinham esse grant de uma configuração anterior, tabelas criadas via migration pela API/MCP não ganham isso de graça. Lição registrada no ADR-014 para qualquer tabela futura.
- **Bug de scroll reportado em uso real, não coberto pela auditoria original**: no layout `scroll-reveal`, com uma lista longa de abas exigindo múltiplos scrolls para ver tudo, rolar para cima **em qualquer ponto no meio da lista** (não só na borda) disparava `scrollIntoView` de volta pro relógio — o usuário não conseguia navegar a própria lista rolando pra cima, só pra baixo. Causa: `handleWheelUp` (anexado a toda a `.tabs-screen`) não verificava a posição de scroll atual, disparando incondicionalmente para qualquer `deltaY < 0`. **Corrigido**: novo guard `isAtTabsScreenTop()` (`App.svelte`) só permite o salto de volta quando o topo da seção de abas já está a ≤4px do topo da viewport (ou seja, exatamente na borda entre as duas seções) — no meio da lista, o scroll segue normal. Validado ao vivo simulando os dois cenários (scroll no meio da lista permanece parado; scroll exatamente na borda volta pro relógio).

## Testes
66 → 81 testes (novos: `reorderTab` assimétrico, `removeTab` recompactando order, `pullAllTabs`, `pullAndMerge`/`fullSync` com fake remoto incluindo `select`, erro de dado não travando `drainQueue`, `BOOTSTRAP_SYNC` e enfileiramento de `IMPORT_DATA`/`UPDATE_CONFIG` no router, `pushConfig`/`pullConfig`, `mergeConfigFromRemote`). Todos passando, typecheck limpo.
