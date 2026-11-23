# arfyin

Extensão Chrome própria para substituir Session Buddy, TabStack, Tab Group e Tabliss — gestão de abas/favoritos do Samuel.

## Contexto obrigatório

Antes de discutir requisitos, arquitetura ou código desta extensão, leia:

- [`docs/research/chrome-context.md`](docs/research/chrome-context.md) — estado real do Chrome do usuário (abas abertas, favoritos, e análise funcional/técnica das 4 extensões concorrentes já instaladas: Session Buddy, TabStack, Tab Group, Tabliss). Inclui diagnóstico do padrão comportamental que a extensão nova precisa resolver.

Esse documento é vivo — qualquer achado novo relevante sobre o problema, concorrência ou decisões de produto/arquitetura deve ser adicionado lá (ou em novo arquivo dentro de `docs/research/`), não apenas relatado no chat.

## Workflow obrigatório — commit atômico autônomo, sem pedir aprovação, documentando sempre

Instrução explícita do usuário (2026-11-23, repetida mais de uma vez depois de uma sessão inteira acumular ~10 rodadas de trabalho sem nenhum commit): **este projeto é exceção à regra global de sempre pedir aprovação antes de `git commit`** (`~/.claude/CLAUDE.md`). Aqui, pra `git commit` (nunca `git push`, nunca `--force`, nunca reescrever histórico já existente):

1. **Não propor mensagem de commit e esperar aprovação. Só commitar.** Pedir aprovação a cada rodada é exatamente o comportamento que o usuário pediu pra eliminar — ele quer ver o trabalho pronto, documentado e já commitado, não um pedido de "posso?".
2. **Quebrar em commits atômicos de verdade**, por concern/unidade lógica — não "um commit por rodada de conversa". Se uma resposta implementa um bugfix de tema E um ajuste de UI não relacionado, são dois commits, não um. Cada commit carrega sua própria fatia de `REGISTRO.md`/`kanban.md` quando fizer sentido separar.
3. Documentar (`REGISTRO.md`, `kanban.md`, `feature_ideas.md` quando introduzir conceito novo de produto) **imediatamente**, no mesmo commit do código a que se refere — nunca num commit "docs" solto no fim acumulando várias rodadas.
4. `git push` continua exigindo aprovação explícita (não coberto por esta exceção — só commits locais). Qualquer operação destrutiva/irreversível de verdade (migração de banco destrutiva, force-push, reset --hard, etc.) também continua exigindo confirmação — essa exceção é só pro loop de aprovação de commit local rotineiro.
