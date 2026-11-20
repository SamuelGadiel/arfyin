# arfyin

Extensão Chrome própria para substituir Session Buddy, TabStack, Tab Group e Tabliss — gestão de abas/favoritos do Samuel.

## Contexto obrigatório

Antes de discutir requisitos, arquitetura ou código desta extensão, leia:

- [`docs/research/chrome-context.md`](docs/research/chrome-context.md) — estado real do Chrome do usuário (abas abertas, favoritos, e análise funcional/técnica das 4 extensões concorrentes já instaladas: Session Buddy, TabStack, Tab Group, Tabliss). Inclui diagnóstico do padrão comportamental que a extensão nova precisa resolver.

Esse documento é vivo — qualquer achado novo relevante sobre o problema, concorrência ou decisões de produto/arquitetura deve ser adicionado lá (ou em novo arquivo dentro de `docs/research/`), não apenas relatado no chat.
