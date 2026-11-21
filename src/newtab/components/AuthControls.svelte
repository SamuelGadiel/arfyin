<script lang="ts">
  import { onMount } from "svelte";
  import { getAuthState, signInWithGoogle, signOut } from "@/shared/auth";

  let state = $state<{ loggedIn: boolean; email: string | null }>({ loggedIn: false, email: null });
  let error: string | null = $state(null);

  async function refresh() {
    try {
      state = await getAuthState();
    } catch {
      // Supabase/env nao configurado — trata como deslogado, sem quebrar a UI.
      state = { loggedIn: false, email: null };
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
  {#if state.loggedIn}
    <span>{state.email}</span>
    <button onclick={handleSignOut}>Sair</button>
  {:else}
    <button onclick={handleSignIn}>Conectar com Google</button>
  {/if}
  {#if error}<span class="error">{error}</span>{/if}
</div>

<style>
  .auth-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    opacity: 0.8;
  }
  button {
    background: rgba(255, 255, 255, 0.08);
    border: none;
    color: inherit;
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 11px;
  }
  .error {
    color: #f5a3a3;
  }
</style>
