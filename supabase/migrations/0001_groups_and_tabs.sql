-- arfyin: schema inicial (grupos e abas salvas)
-- Rode isso manualmente no SQL Editor do painel do Supabase (Project -> SQL Editor -> New query).

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

-- Nenhuma permissao para o papel "anon": so usuarios autenticados acessam, e so suas
-- proprias linhas (reforcado pelas policies de RLS acima, mas sem GRANT nem chega la).
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.groups to authenticated;
grant select, insert, update, delete on public.tabs to authenticated;
