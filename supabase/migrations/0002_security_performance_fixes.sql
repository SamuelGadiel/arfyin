-- arfyin: correções encontradas pelos advisors do Supabase logo após a migração 0001.
-- Aplicado via MCP (apply_migration) em produção; este arquivo é o espelho/histórico local.

-- SEGURANÇA: a função `rls_auto_enable()` é gerada pelo próprio Supabase (feature
-- "Enable RLS on new tables automatically" habilitada na criação do projeto) e roda
-- como event trigger interno. Por padrão do Postgres toda função nova recebe EXECUTE
-- para o pseudo-role PUBLIC, o que a expunha sem necessidade via /rest/v1/rpc/rls_auto_enable
-- pros papeis anon/authenticated. Revogado (nao afeta o funcionamento do event trigger,
-- que roda como o dono da função, independente de GRANTs de client).
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon, authenticated;

-- PERFORMANCE: FK tabs.group_id -> groups.id nao tinha indice dedicado cobrindo-a
-- (o indice composto tabs_user_group_idx(user_id, group_id) nao cobre buscas so por
-- group_id, que e como o cascade de delete de grupo e o join de volta pra groups usam).
create index tabs_group_id_idx on public.tabs(group_id);

-- PERFORMANCE: policies usando auth.uid() diretamente sao reavaliadas pelo planner
-- uma vez POR LINHA. Envolver em (select auth.uid()) faz o Postgres tratar como
-- InitPlan estavel, avaliado uma vez por execucao da query (recomendacao oficial
-- da Supabase, ver docs/database/postgres/row-level-security#call-functions-with-select).
drop policy "groups_owner_select" on public.groups;
drop policy "groups_owner_insert" on public.groups;
drop policy "groups_owner_update" on public.groups;
drop policy "groups_owner_delete" on public.groups;

create policy "groups_owner_select" on public.groups for select using ((select auth.uid()) = user_id);
create policy "groups_owner_insert" on public.groups for insert with check ((select auth.uid()) = user_id);
create policy "groups_owner_update" on public.groups for update using ((select auth.uid()) = user_id);
create policy "groups_owner_delete" on public.groups for delete using ((select auth.uid()) = user_id);

drop policy "tabs_owner_select" on public.tabs;
drop policy "tabs_owner_insert" on public.tabs;
drop policy "tabs_owner_update" on public.tabs;
drop policy "tabs_owner_delete" on public.tabs;

create policy "tabs_owner_select" on public.tabs for select using ((select auth.uid()) = user_id);
create policy "tabs_owner_insert" on public.tabs for insert with check ((select auth.uid()) = user_id);
create policy "tabs_owner_update" on public.tabs for update using ((select auth.uid()) = user_id);
create policy "tabs_owner_delete" on public.tabs for delete using ((select auth.uid()) = user_id);
