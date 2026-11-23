-- ARF-019 / ADR-014: sincronizar AppConfig (tema/layout/acesso rapido) com o Supabase.
-- Uma linha por usuario; o AppConfig inteiro serializado como jsonb (evita
-- migracao de schema toda vez que um campo novo e adicionado ao AppConfig).

create table public.config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.config enable row level security;

create policy "users select own config"
  on public.config for select
  using ((select auth.uid()) = user_id);

create policy "users insert own config"
  on public.config for insert
  with check ((select auth.uid()) = user_id);

create policy "users update own config"
  on public.config for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users delete own config"
  on public.config for delete
  using ((select auth.uid()) = user_id);

-- RLS restringe QUAIS linhas uma role ve, mas nao concede a operacao em si —
-- isso e um GRANT de nivel de tabela separado. groups/tabs ja tinham esse
-- grant (de alguma configuracao anterior do projeto); tabelas novas criadas
-- via migration pela API/MCP NAO ganham isso automaticamente — confirmado
-- com "permission denied for table config" na primeira tentativa de sync.
grant select, insert, update, delete on public.config to authenticated;
