# SDD — ARF-012: Fila de sync local↔Supabase com resiliência

## Contexto
Toda escrita local (IndexedDB) precisa eventualmente chegar ao Supabase, sem bloquear a UI e sem quebrar quando a nuvem estiver fora (ADR-010). Ver ADR-007 (upsert por id, duplicar em conflito de import) e ADR-010 (local-first, status visível).

## Escopo
**Entra**: object stores `sync_queue` (fila de operações pendentes) e `meta` (status de sync) no IndexedDB (bump de versão 1→2); funções `enqueue`/`drainQueue`/`getSyncStatus`; toda mutação de `storage.ts` passa a enfileirar a operação correspondente; `remote.ts` ganha `deleteRemoteGroup`/`deleteRemoteTab`; o service worker drena a fila a cada mutação (debounced) e periodicamente via `chrome.alarms`.

**Não entra**: autenticação real (ARF-011 — a fila funciona com um `userId` passado por fora; sem sessão, `drainQueue` simplesmente não roda/marca unreachable). UI do indicador (ARF-017, próximo card).

## Critérios de aceite
- [ ] Mutações locais (criar/renomear/deletar grupo, adicionar/remover aba) enfileiram a operação remota correspondente.
- [ ] `drainQueue` processa a fila em ordem, remove da fila em caso de sucesso, **para e marca `unreachable`** no primeiro erro (não perde o restante da fila).
- [ ] Deletar um grupo remotamente enfileira só a deleção do grupo (cascade do Postgres cuida das abas — não duplicar trabalho).
- [ ] Status de sync (`idle`/`syncing`/`unreachable`) persistido e consultável.
- [ ] Testes unitários cobrindo enqueue, drain com sucesso, drain com falha parcial (para no meio, preserva o resto), e status.

## Design técnico
- Upgrade de versão do IDB com `if (oldVersion < 1)`/`if (oldVersion < 2)` para não quebrar o banco já existente no Chrome real do usuário.
- `SyncOp`: `{ id, table: "groups"|"tabs", op: "upsert"|"delete", entityId, payload?, createdAt }`.
- `drainQueue({ localDb, remoteDb, userId })`: sequencial, não paralelo (preserva ordem causal das mutações).
- Sem backoff exponencial — YAGNI por ora: falha marca `unreachable`, a próxima tentativa (próxima mutação ou próximo alarm) já tenta de novo.

## Testes previstos
Fakes de `RemoteDb` (reaproveitando o padrão de `tests/shared/remote.test.ts`) simulando sucesso e falha.
