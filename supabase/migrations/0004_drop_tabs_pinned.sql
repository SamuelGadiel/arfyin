-- arfyin: remove a coluna `pinned` da tabela tabs.
-- A funcionalidade de "fixar aba" foi removida da UI e de todo o codigo
-- TypeScript numa rodada anterior (ARF-159); a coluna foi deixada intacta
-- de proposito ali (DROP COLUMN e destrutivo, pedia aprovacao explicita em
-- separado). Aprovada pelo usuario em 2026-11-22 -- aplicada via MCP do
-- Supabase (nao precisou do SQL Editor manual desta vez).

alter table public.tabs drop column pinned;
