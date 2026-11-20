<script lang="ts">
  import { send } from "../lib/client";
  import { store } from "../lib/store.svelte";
  import type { ConfigExport, DataExport } from "@/shared/types";

  function downloadJson(filename: string, content: unknown) {
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportData() {
    const res = await send<"DATA_EXPORTED">({ type: "EXPORT_DATA" });
    if (res.type === "DATA_EXPORTED") downloadJson("arfyin-data-export.json", res.data);
  }

  async function exportConfig() {
    const res = await send<"CONFIG_EXPORTED">({ type: "EXPORT_CONFIG" });
    if (res.type === "CONFIG_EXPORTED") downloadJson("arfyin-config-export.json", res.data);
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

  async function importData(event: Event) {
    const input = event.target as HTMLInputElement;
    try {
      const data = (await readJsonFile(input)) as DataExport;
      await send({ type: "IMPORT_DATA", data });
      await store.loadAll();
      alert("Dados importados (duplicados, nada foi substituído).");
    } catch (err) {
      alert(`Falha ao importar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      input.value = "";
    }
  }

  async function importConfig(event: Event) {
    const input = event.target as HTMLInputElement;
    try {
      const data = (await readJsonFile(input)) as ConfigExport;
      await send({ type: "IMPORT_CONFIG", data });
      await store.loadAll();
      alert("Configuração importada (substituiu a anterior).");
    } catch (err) {
      alert(`Falha ao importar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      input.value = "";
    }
  }
</script>

<div class="backup-controls">
  <button onclick={exportData}>Exportar dados</button>
  <label class="file-button">
    Importar dados
    <input type="file" accept="application/json" onchange={importData} />
  </label>
  <button onclick={exportConfig}>Exportar config</button>
  <label class="file-button">
    Importar config
    <input type="file" accept="application/json" onchange={importConfig} />
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
