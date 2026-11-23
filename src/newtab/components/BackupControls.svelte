<script lang="ts">
  import { send } from "../lib/client";
  import { store } from "../lib/store.svelte";
  import type { BackupBundle } from "@/shared/types";

  function downloadJson(filename: string, content: unknown) {
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportBackup() {
    const res = await send<"BACKUP_EXPORTED">({ type: "EXPORT_BACKUP" });
    if (res.type === "BACKUP_EXPORTED") downloadJson("arfyin-backup.json", res.data);
  }

  function readJsonFile(input: HTMLInputElement): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const file = input.files?.[0];
      if (!file) return reject(new Error("Nenhum arquivo selecionado."));
      const reader = new FileReader();
      reader.onload = () => resolve(JSON.parse(reader.result as string));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  async function importBackup(event: Event) {
    const input = event.target as HTMLInputElement;
    try {
      const data = (await readJsonFile(input)) as BackupBundle;
      await send({ type: "IMPORT_BACKUP", data });
      await store.loadAll();
      alert("Backup importado: abas/grupos duplicados, configuração substituída.");
    } catch (err) {
      alert(`Falha ao importar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      input.value = "";
    }
  }
</script>

<div class="backup-controls">
  <button onclick={exportBackup}>Exportar tudo</button>
  <label class="file-button">
    Importar
    <input type="file" accept="application/json" onchange={importBackup} />
  </label>
</div>

<style>
  .backup-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-bottom: 8px;
  }
  button,
  .file-button {
    background: rgba(255, 255, 255, 0.08);
    border: none;
    color: inherit;
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 11px;
  }
  button:hover,
  .file-button:hover {
    background: rgba(255, 255, 255, 0.16);
  }
  .file-button input {
    display: none;
  }
</style>
