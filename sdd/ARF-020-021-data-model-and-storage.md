# SDD — ARF-020/021: Modelo de dados (Group + SavedTab) + storage local

## Contexto
Núcleo do produto (Tema B do `feature_ideas.md`): grupos de abas e abas salvas (dentro ou fora de grupo). Esta spec cobre os dois cards juntos porque são indissociáveis — não existe `SavedTab` sem um dono (`groupId | null`), e não existe `Group` sem a lista de abas que ele agrega.

## Escopo
**Entra**: tipos `Group` e `SavedTab`, camada de storage local em IndexedDB (via `idb`) com CRUD básico, exposta através do service worker (processo central, ADR-003) via mensagens — nenhuma outra parte do código acessa IndexedDB diretamente, só o background.

**Não entra**: sync com Supabase (ARF-010/012 — essa camada de storage é a *mesma* que vai servir de cache local quando o sync existir, mas a ligação com a nuvem é card separado e está **Blocked** por depender de um projeto Supabase real do usuário, ver nota em `kanban.md`/`REGISTRO.md`). Drag-and-drop entre grupos (ARF-024/025) e ordenação (ARF-026) são cards separados — aqui só entra o campo `order` no tipo, não a lógica de UI de arrastar.

## Critérios de aceite
- [ ] Tipos `Group` e `SavedTab` definidos em `src/shared/types.ts`, com todos os campos necessários para os temas B3 (favicon+nome), B4 (ordem), H3 (cor/ícone de grupo), H4 (pin).
- [ ] `src/shared/storage.ts`: funções `createGroup`, `listGroups`, `renameGroup`, `deleteGroup`, `addTabToGroup`, `removeTab`, `listTabsByGroup`, `listUngroupedTabs` — todas via IndexedDB.
- [ ] Service worker expõe essas operações via mensagens (`GET_GROUPS`, `CREATE_GROUP`, etc.) — é o único processo que toca o IndexedDB real em produção (a lib em si é "burra"/testável isoladamente, mas o contrato de acesso em runtime passa pelo background, conforme ADR-003).
- [ ] Testes unitários cobrindo todas as funções de `storage.ts` usando `fake-indexeddb` (sem precisar de um browser real).
- [ ] New-tab consegue, ao abrir, pedir a lista de grupos ao background e renderizar (mesmo que a UI ainda seja simples — isso prova a fatia vertical completa).

## Design técnico

```ts
interface SavedTab {
  id: string;           // crypto.randomUUID()
  groupId: string | null; // null = aba solta, fora de qualquer grupo
  url: string;
  title: string;
  faviconUrl: string | null;
  order: number;        // posição dentro do grupo (ou entre soltas)
  pinned: boolean;       // Tema H4 — fixada no topo do grupo
  createdAt: number;
  updatedAt: number;
}

interface Group {
  id: string;
  name: string;
  color: string | null;  // Tema H3
  icon: string | null;   // Tema H3
  order: number;
  collapsed: boolean;    // Tema B2
  createdAt: number;
  updatedAt: number;
}
```

- Banco IndexedDB `arfyin` com object stores `groups` (keyPath `id`) e `tabs` (keyPath `id`, índice secundário em `groupId` para listar por grupo sem table scan).
- `src/shared/storage.ts` recebe a instância do banco via injeção (função `openArfyinDb()`) — isso é o que permite testar com `fake-indexeddb` sem mockar `chrome.*`.
- Mensagens do background seguem o mesmo padrão de `src/shared/messaging.ts` já criado no ARF-001 (tipos discriminados por `type`).

## Casos de borda
- Grupo deletado com abas dentro → as abas são deletadas em cascata (não ficam órfãs apontando pra um `groupId` inexistente). Comportamento decidido aqui porque não há requisito do usuário pedindo preservar abas de grupo deletado, e deixá-las órfãs violaria a garantia de "nunca perder dado de forma confusa" — se o usuário realmente não queria perder as abas, a UI deve pedir confirmação antes de deletar o grupo (isso é responsabilidade da UI, card futuro, não desta camada).
- `listGroups` com banco vazio retorna `[]`, nunca erro.

## Testes previstos
- Unit: cada função de `storage.ts` (criar, listar, renomear, deletar grupo com cascata, adicionar/remover aba, reordenar).
- Unit: handler de mensagens do background (mapeamento mensagem → chamada de storage correta) — isolado de `chrome.*` real via mock mínimo do `chrome.runtime.onMessage`.
