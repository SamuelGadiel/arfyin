# SDD — ARF-010: Schema Supabase + cliente remoto

## Contexto
Primeira peça do epic SYNC (Tema A), agora desbloqueada — projeto Supabase criado pelo usuário (`arfyin`, região São Paulo, free tier). Ver `docs/architecture/decisions.md` ADR-005 (por que Supabase), ADR-006 (auth Google), ADR-007 (estratégia de conflito), ADR-010 (resiliência local-first).

## Escopo
**Entra**: tabelas Postgres `groups` e `tabs` espelhando exatamente o modelo local já implementado (`src/shared/types.ts`, ARF-020/021), RLS por usuário, GRANTs explícitos, e um cliente `supabase-js` + funções de leitura/escrita remotas testáveis (mock do client, sem bater na rede real nos testes).

**Não entra** (cards separados, para não espalhar escopo):
- Login/sessão (ARF-011) — as policies de RLS já são escritas assumindo `auth.uid()`, mas **não há como testar de ponta a ponta com usuário real autenticado até ARF-011 existir**. Esse é um limite conhecido e aceito deste card.
- Fila de sync automática, debounce, retry, detecção online/offline (ARF-012).
- Tabela de config e de sessões salvas — não têm modelo local ainda (não foram implementadas no app), então não faz sentido criar schema remoto pra elas agora (YAGNI).
- Tabela de heartbeat do ADR-010/ARF-017 — fica no card dela.

## Decisão de nomenclatura de chave (atualização de 2026)
A Supabase migrou a terminologia: a antiga **anon key** agora é a **Publishable key** (`sb_publishable_...`), e a **service_role** virou **Secret key** (`sb_secret_...`) — a nomenclatura legada será desativada em 2027. Variáveis de ambiente usam o nome novo: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (ver `.env.example`).

## Critérios de aceite
- [ ] Migração SQL em `supabase/migrations/0001_groups_and_tabs.sql` com tabelas, índices, RLS habilitado, policies por `auth.uid()`, e GRANTs explícitos só para o papel `authenticated` (nenhum acesso para `anon` — defesa em profundidade, mesmo com RLS correto).
- [ ] Usuário roda essa SQL manualmente no SQL Editor do painel (decisão já tomada: eu não peço a senha do banco, ele mantém controle de aplicar schema em produção).
- [ ] `src/shared/supabaseClient.ts`: factory que lê `import.meta.env.VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` e cria o client, lançando erro claro se as variáveis não estiverem configuradas.
- [ ] `src/shared/remote.ts`: funções `pushGroup`, `pullGroups`, `pushTab`, `pullTabsByGroup` — mesma forma de dados que `src/shared/storage.ts`, convertendo entre o formato local (camelCase, `createdAt` number) e o formato da tabela (snake_case, timestamps ISO).
- [ ] Testes unitários de `remote.ts` usando um client **fake** (interface mínima, não a lib real) — sem rede real nos testes.
- [ ] `npm run typecheck`, `npm run test`, `npm run build` continuam passando.

## Design técnico

```sql
-- supabase/migrations/0001_groups_and_tabs.sql
create table public.groups (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  icon text,
  "order" integer not null default 0,
  collapsed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tabs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade, -- null = aba solta
  url text not null,
  title text not null,
  favicon_url text,
  "order" integer not null default 0,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index groups_user_idx on public.groups(user_id);
create index tabs_user_group_idx on public.tabs(user_id, group_id);

alter table public.groups enable row level security;
alter table public.tabs enable row level security;

create policy "groups_owner_select" on public.groups for select using (auth.uid() = user_id);
create policy "groups_owner_insert" on public.groups for insert with check (auth.uid() = user_id);
create policy "groups_owner_update" on public.groups for update using (auth.uid() = user_id);
create policy "groups_owner_delete" on public.groups for delete using (auth.uid() = user_id);

create policy "tabs_owner_select" on public.tabs for select using (auth.uid() = user_id);
create policy "tabs_owner_insert" on public.tabs for insert with check (auth.uid() = user_id);
create policy "tabs_owner_update" on public.tabs for update using (auth.uid() = user_id);
create policy "tabs_owner_delete" on public.tabs for delete using (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.groups to authenticated;
grant select, insert, update, delete on public.tabs to authenticated;
```

**Por que `id uuid primary key` sem `default gen_random_uuid()`**: o id já é gerado no cliente (`crypto.randomUUID()`, ver `storage.ts`) — o mesmo id precisa existir localmente (IndexedDB) e remotamente (Supabase) pra o upsert por id funcionar (ADR-007). Gerar no servidor quebraria essa simetria.

**Por que GRANT só pra `authenticated`, nunca `anon`**: RLS já bloqueia `anon` de ver qualquer linha (nenhuma linha tem `user_id = auth.uid()` quando não há usuário logado), mas não ter GRANT nenhum pro papel anônimo é uma segunda camada de proteção — mesmo que uma policy seja escrita errada no futuro, `anon` continua sem permissão alguma na tabela.

## Casos de borda
- Sem variáveis de ambiente configuradas: `getSupabaseClient()` lança erro explícito e claro, não falha silenciosamente.
- `pullGroups`/`pullTabsByGroup` com usuário sem nenhum dado ainda: retornam lista vazia, não erro.

## Testes previstos
- Unit: `remote.ts` com um fake client (interface mínima `{ from(table): { upsert, select, eq, ... } }`) cobrindo push e pull de grupo e de aba, incluindo mapeamento de campo `order`/`"order"` e `createdAt` (number) ↔ `created_at` (ISO string).
