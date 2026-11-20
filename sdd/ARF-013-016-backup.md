# SDD — ARF-013 a ARF-016: exportar/importar dados e configuração

## Contexto
Tema A2. Dois arquivos JSON distintos: dump de dados (grupos+abas) e configuração. Decisão já registrada (ADR-007): import de dados **sempre duplica** (nunca decide o que descartar); import de config **substitui** (é um objeto único, não uma lista).

## Critérios de aceite
- [x] `EXPORT_DATA` retorna `{schemaVersion, exportedAt, groups, tabs}` com **todos** os grupos e abas (de todos os grupos + soltas).
- [x] `IMPORT_DATA` recebe o mesmo formato e **duplica** tudo: cada grupo/aba recebe novo id (via `createGroup`/`addTabToGroup`, que já geram id e `order` corretos), remapeando `groupId` antigo→novo. Nunca apaga nada existente.
- [x] `EXPORT_CONFIG` / `IMPORT_CONFIG` (este último substitui o `AppConfig` inteiro).
- [x] UI: botões de exportar (baixa um `.json` via blob + link sintético, sem precisar da permissão `downloads`) e importar (`<input type="file">`).

## Design técnico
- `src/shared/backup.ts`: tipos `DataExport`/`ConfigExport` + função pura `remapGroupIds` para o import (separada da orquestração com IDB, testável isoladamente).
- `storage.ts`: `exportAllData`/`importDataExport` reaproveitam as funções já existentes (`createGroup`, `addTabToGroup`, `updateGroupAppearance`) em vez de inserir registros "crus" — garante que os invariantes (order 0..n-1, etc.) continuem valendo nos dados importados.
- Import **não** enfileira sync automaticamente por enquanto (seria uma rajada grande); o próximo `kickSync` natural (próxima mutação, ou o alarme de 15min) drena.

## Testes previstos
`remapGroupIds` (lógica pura de remapeamento) + `exportAllData`/`importDataExport` via fake-indexeddb, incluindo o caso de duplicação (importar os mesmos dados duas vezes resulta em todos os itens duplicados com ids diferentes).
