# Checklist de publicação — Chrome Web Store

> ARF-120. Nada aqui foi executado (publicar é uma ação irreversível/pública que só o usuário deve disparar) — é o roteiro para quando ele decidir publicar.

## Antes de empacotar
- [ ] `npm run typecheck && npm run test && npm run test:e2e` — tudo verde.
- [ ] `npm run build` — conferir `dist/manifest.json` (versão, permissões mínimas necessárias).
- [ ] Ícones reais (16/32/48/128px) — hoje a extensão não declara `icons` no manifest; a Web Store exige pelo menos 128px para a listagem.
- [ ] Decidir sobre `ARF-011`/Google OAuth: se for publicar, o redirect URI do Google Cloud (`https://<id>.chromiumapp.org/`) precisa ser atualizado para o **ID final** da extensão na Web Store (diferente do ID de desenvolvimento local).
- [ ] `.env` de produção com as credenciais reais do Supabase (já existe) — build de produção embute `VITE_SUPABASE_PUBLISHABLE_KEY` no bundle, o que é esperado e seguro (RLS protege os dados, não o sigilo da chave).

## Empacotamento
- [ ] `dist/` zipado (a própria Web Store aceita a pasta ou um `.zip`).
- [ ] Conta de developer na Chrome Web Store (taxa única de $5, se ainda não tiver).

## Listagem
- [ ] Descrição, screenshots, categoria.
- [ ] Política de privacidade — **obrigatória** porque a extensão usa `identity` (login) e envia dados a um backend (Supabase). Precisa declarar isso.
- [ ] Justificativa de cada permissão no formulário de review (`tabs`, `storage`, `alarms`, `identity`, `host_permissions` para `reddit.com`) — a review do Google costuma pedir justificativa individual para `identity` e host permissions.

## Pós-publicação
- [ ] Atualizar o redirect URI do Google OAuth (ver acima).
- [ ] Versionamento: `manifest.json.version` precisa subir a cada update (`npm version` ou manual).
