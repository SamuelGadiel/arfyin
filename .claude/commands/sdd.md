---
description: Cria o esqueleto de um SDD para um card do kanban.md e move o card de Backlog para Ready.
argument-hint: ARF-NNN
---

Você vai processar o card `$1` do `kanban.md`.

1. Leia `kanban.md`, encontre a linha do card `$1` na seção Backlog. Se não existir, avise e pare.
2. Leia `feature_ideas.md` na seção referenciada pela coluna "Ref." daquele card, e `docs/architecture/decisions.md` para restrições relevantes.
3. Crie `sdd/$1-<slug-curto>.md` seguindo o formato descrito em `.claude/agents/product-owner.md` (Contexto / Escopo / Critérios de aceite / Design técnico / Casos de borda / Testes previstos).
4. Edite `kanban.md`: remova a linha do card de Backlog e adicione em Ready, com um link para o SDD criado.
5. Não implemente nada — este comando só produz a spec.
