# SDD — ARF-011: Login com Google (Supabase Auth)

## Contexto
Tema A1. Permite "logar num computador novo" e dá ao RLS do schema (ADR-005) um `auth.uid()` real para usar.

## Pesquisa técnica (antes de implementar, para não errar)
`chrome.identity.getAuthToken()` retorna um **access token**, não um **ID token** — e `supabase.auth.signInWithIdToken()` exige especificamente um ID token. O padrão confirmado pela própria comunidade/discussões oficiais do Supabase para Chrome extensions é:

1. Construir a URL de autorização do Google manualmente (`response_type=token id_token`, `redirect_uri=https://<extension-id>.chromiumapp.org/`).
2. Abrir com `chrome.identity.launchWebAuthFlow()`.
3. Extrair o `id_token` do hash da URL de retorno.
4. Chamar `supabase.auth.signInWithIdToken({ provider: "google", token: idToken })`.

Isso evita qualquer backend próprio de troca de token — a validação do ID token é feita pelo próprio Supabase.

## Escopo
Implementa todo o código do fluxo (`src/shared/auth.ts`, mensagens, UI). **Não implementa a configuração externa** (ver "Bloqueio" abaixo) — sem ela, o botão de login existe mas o fluxo real não completa.

## Bloqueio (ação só do usuário, mesmo padrão do Supabase/projeto)
1. **Google Cloud Console**: criar um projeto (ou reaproveitar um existente), configurar a "OAuth consent screen", e criar uma credencial **OAuth 2.0 Client ID** do tipo **"Web application"**, com o redirect URI `https://<id-da-extensao>.chromiumapp.org/` (o id da extensão só existe depois do primeiro `npm run build` + carregar no Chrome — é estável enquanto a pasta `dist/` não mudar de chave, mas muda se a extensão for publicada na Web Store depois, então o redirect URI precisa ser atualizado nesse momento).
2. **Supabase Dashboard → Authentication → Providers → Google**: colar o Client ID e o Client Secret gerados no passo 1.
3. Colocar o Client ID também no `.env` local (`VITE_GOOGLE_CLIENT_ID`) para o código da extensão montar a URL de autorização.

Card fica em **Backlog** (não Blocked) porque o código já está pronto e revisável — só falta a credencial para testar de ponta a ponta.

**Nota (2026-11-22)**: o JSON baixado do Google Cloud Console no passo 1 (`client_secret_*.json`) é material de setup **descartável** depois que os passos 2 e 3 acima forem feitos — o código da extensão só lê `client_id` (via `.env`/`VITE_GOOGLE_CLIENT_ID`), nunca o `client_secret` (esse só é consumido pelo Supabase Dashboard, uma vez, na configuração do provider). Não faz sentido incorporar o secret ao `.env`: nada no bundle client-side precisa dele, e colar em `.env` sob o prefixo `VITE_` vazaria o secret pro bundle publicado. Se o arquivo for perdido, o Google Cloud Console permite visualizar/regerar o secret a qualquer momento (não é "revela uma vez só"). `client_secret_*.json` está no `.gitignore` por segurança, mas o arquivo em si não precisa ficar na raiz do projeto.

## Design técnico
- `src/shared/auth.ts`: `signInWithGoogle()`, `signOut()`, `getAuthState()`, reaproveita `getSupabaseClient()`.
- **Sem mensagens novas** — a UI chama essas funções diretamente (não via `routeMessage`), porque `launchWebAuthFlow` precisa do gesto/contexto do usuário na própria página, não faz sentido saltar pro background.
- **Correção de arquitetura feita junto**: `getSupabaseClient()` agora usa um `storage` customizado baseado em `chrome.storage.local` (não o `localStorage` padrão do supabase-js) — background e new-tab são processos JS separados, e só `chrome.storage` é realmente compartilhado entre eles. Sem isso, logar na UI nunca seria visto pelo service worker (que é quem faz o sync de verdade).
- `AuthControls.svelte`: botão "Conectar com Google" / mostra e-mail + "Sair" quando autenticado.
- Permissão `identity` adicionada ao manifest.

## Testes previstos
A lógica de extração do `id_token` do hash da URL de retorno é pura e testável isoladamente (`parseIdTokenFromRedirectUrl`). O fluxo completo (`launchWebAuthFlow` real) não é testável em CI/unit — fica para validação manual quando a credencial existir.
