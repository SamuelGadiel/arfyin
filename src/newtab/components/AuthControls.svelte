<script lang="ts">
  import { onMount } from "svelte";
  import { getAuthState, signInWithGoogle, signOut, type AuthState } from "@/shared/auth";

  // nomeada "authState" (nao "state") para nao confundir o analisador com a
  // rune `$state` — ver mesma nota em SyncStatusBanner.svelte.
  let authState = $state<AuthState>({ loggedIn: false, email: null, name: null, avatarUrl: null });
  let error: string | null = $state(null);

  async function refresh() {
    try {
      authState = await getAuthState();
    } catch {
      // Supabase/env nao configurado — trata como deslogado, sem quebrar a UI.
      authState = { loggedIn: false, email: null, name: null, avatarUrl: null };
    }
  }

  onMount(refresh);

  async function handleSignIn() {
    error = null;
    try {
      await signInWithGoogle();
      await refresh();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  async function handleSignOut() {
    await signOut();
    await refresh();
  }
</script>

<div class="auth-controls">
  {#if authState.loggedIn}
    <div class="account-card">
      {#if authState.avatarUrl}
        <img class="avatar" src={authState.avatarUrl} alt="" />
      {:else}
        <div class="avatar avatar-placeholder">{(authState.name ?? authState.email ?? "?")[0]?.toUpperCase()}</div>
      {/if}
      <div class="account-info">
        {#if authState.name}<span class="account-name">{authState.name}</span>{/if}
        <span class="account-email">{authState.email}</span>
      </div>
      <button onclick={handleSignOut}>Sair</button>
    </div>
  {:else}
    <button onclick={handleSignIn}>Conectar com Google</button>
  {/if}
  {#if error}<span class="error">{error}</span>{/if}
</div>

<style>
  .auth-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 11px;
    opacity: 0.9;
  }
  .account-card {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    padding: 10px 12px;
  }
  .avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    flex-shrink: 0;
    object-fit: cover;
  }
  .avatar-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.12);
    font-size: 14px;
    font-weight: 600;
  }
  .account-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .account-name {
    font-size: 13px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .account-email {
    font-size: 11px;
    opacity: 0.6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  button {
    background: rgba(255, 255, 255, 0.08);
    border: none;
    color: inherit;
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 11px;
    flex-shrink: 0;
  }
  .error {
    color: #f5a3a3;
  }
</style>
