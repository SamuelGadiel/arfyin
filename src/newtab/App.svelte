<script lang="ts">
  import type { ArfyinResponse } from "@/shared/messaging";
  import type { Group } from "@/shared/types";

  let status: "checking" | "online" | "offline" = $state("checking");
  let groups: Group[] = $state([]);

  async function send(message: Parameters<typeof chrome.runtime.sendMessage>[0]) {
    return (await chrome.runtime.sendMessage(message)) as ArfyinResponse;
  }

  async function load() {
    const pong = await send({ type: "PING" });
    status = pong?.type === "PONG" ? "online" : "offline";

    const response = await send({ type: "LIST_GROUPS" });
    if (response?.type === "GROUPS") {
      groups = response.groups;
    }
  }

  load();
</script>

<main>
  <h1>arfyin</h1>
  <p>service worker: {status}</p>

  <section>
    <h2>Grupos</h2>
    {#if groups.length === 0}
      <p>Nenhum grupo ainda.</p>
    {:else}
      <ul>
        {#each groups as group (group.id)}
          <li>{group.name}</li>
        {/each}
      </ul>
    {/if}
  </section>
</main>
