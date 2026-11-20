<script lang="ts">
  import type { PingMessage, PongMessage } from "@shared/messaging";

  let status: "checking" | "online" | "offline" = $state("checking");

  async function pingBackground() {
    const message: PingMessage = { type: "PING" };
    try {
      const response = (await chrome.runtime.sendMessage(message)) as PongMessage;
      status = response?.type === "PONG" ? "online" : "offline";
    } catch {
      status = "offline";
    }
  }

  pingBackground();
</script>

<main>
  <h1>arfyin</h1>
  <p>service worker: {status}</p>
</main>
