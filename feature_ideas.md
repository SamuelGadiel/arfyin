# feature_ideas.md — arfyin

> Captura bruta e completa de tudo que o Samuel descreveu sobre a extensão. Nenhum ponto foi descartado — apenas organizado por tema. Fonte original: conversa de 2026-11-20 (ver histórico; ideias numeradas 1–11 como ditadas). Este arquivo é a base para o `kanban.md`.

---

## Tema A — Sincronia e dados (nunca locais-apenas)

### A1. Backend de sincronia obrigatório
- A extensão **não pode depender apenas de armazenamento local**.
- Precisa sincronizar com "alguma coisa": gist/repositório do usuário, Firebase/Supabase, Google Drive, ou equivalente.
- Ao instalar a extensão num computador novo, o usuário precisa poder **"logar"/"conectar"** para carregar tudo que já tem salvo.
- Objetivo final: garantir que os dados **nunca sejam perdidos**, independente da máquina.

### A2. Exportação/Importação total
- Dois arquivos de exportação:
  1. **Dump de dados** — tudo que está salvo (grupos, abas, etc.)
  2. **Arquivo de configuração** — tudo que o usuário configurou na extensão (aparência, atalhos, etc.)
- Precisa ser possível **exportar tudo** e, consequentemente, **importar tudo**.
- Ao importar, é preciso **juntar com o que já está salvo na nuvem** (merge) e tratar conflitos.
- **Decisão explícita do usuário sobre conflitos**: preferir **duplicar** em vez de tentar decidir o que manter. Justificativa dele: abas podem se repetir entre grupos, então não dá pra saber com segurança o que deveria ser descartado — duplicar é mais seguro que perder dado.

### A3. Resiliência: a extensão nunca pode parar de funcionar por causa da nuvem
- Adicionado em 2026-11-20, na discussão sobre o backend de sync (Supabase) e o risco do projeto free pausar por inatividade.
- **Cópia local sempre presente**: a extensão já guarda uma cópia completa dos dados localmente (IndexedDB) — é isso que garante abrir uma aba e ver tudo instantaneamente, sem depender da nuvem para leitura do dia a dia.
- **Se a conexão com o Supabase cair (projeto pausado, sem internet, etc.), a extensão continua funcionando 100% normalmente** usando só os dados locais — nada pode travar ou degradar por causa disso.
- **Indicador visual**: quando a sincronização com a nuvem estiver fora do ar, deve aparecer um **card discreto, porém fixo**, na new-tab avisando o usuário disso (para ele saber que precisa ir no painel do Supabase reativar o projeto, se for o caso).
- **Retomada automática**: assim que a conexão com o Supabase voltar, a extensão deve sincronizar tudo que ficou pendente localmente, sem o usuário precisar fazer nada manualmente (além de reativar o projeto pausado, que é uma ação só dele no painel do Supabase).

### A4. Keep-alive contra a pausa do Supabase — decisão: adiado por escolha do usuário
- Contexto: Supabase free pausa um projeto após 7 dias sem atividade real de API vinda de fora. Pesquisamos a fundo (ver `docs/architecture/decisions.md`, ADR-011) e confirmamos que um job `pg_cron` rodando *dentro* do Postgres provavelmente **não** conta como atividade válida (não documentado, evidência da comunidade sugere que não); a forma confirmada e documentada é tráfego real de API vindo de fora (ex.: um cron externo rodando no próprio servidor do usuário, fazendo uma chamada HTTP real).
- **Decisão do usuário**: não implementar esse keep-alive agora. Motivo: na prática ele não espera ficar uma semana inteira sem usar o Chrome; se isso um dia acontecer, é pontual, e reativar o projeto manualmente no painel do Supabase é um esforço aceitável. Graças ao requisito A3 (resiliência total offline), mesmo se o projeto pausar, a extensão não quebra — só mostra o aviso.
- Revisitar essa decisão **só se a pausa se tornar um problema recorrente na prática**, não antecipadamente. Se isso acontecer, a solução já desenhada é: um cron pequeno no servidor Oracle Cloud do usuário fazendo uma chamada HTTP real contra a API do Supabase (não pg_cron interno).

---

## Tema B — New-tab: estrutura de grupos e abas salvas

### B1. Substituição do new-tab
- A extensão substitui a página de nova aba do Chrome.
- A new-tab mostra toda a estrutura de "abas que a gente mencionou": grupos de abas e abas salvas individualmente (fora de grupos).

### B2. Grupos colapsáveis
- Grupos podem ficar muito grandes → precisa ter esquema de **colapsar/expandir** grupos.

### B3. Favicon + nome
- Cada aba exibida (salva ou individual) mostra **favicon** + **nome da aba**.

### B4. Reordenação
- Deve ser possível **reordenar abas dentro de um grupo**.
- Deve ser possível **arrastar abas entre grupos**, e também **arrastar para fora** de qualquer grupo (tornando-a uma aba solta/individual).
- Deve ser possível **ordenar a lista geral**: por grupos primeiro (ordem alfabética, por exemplo) OU modo "misturado", onde abas soltas podem aparecer entre grupos.

---

## Tema C — Integração com abas/janelas abertas ao vivo

### C1. Visualização ao vivo
- A new-tab deve mostrar **todas as abas abertas atualmente**, organizadas pelas **janelas** reais a que pertencem (como Session Buddy faz hoje).

### C2. Drag-and-drop de aba viva → grupo
- O usuário pode **clicar e arrastar** uma aba aberta para dentro de um grupo salvo.
- Comportamento padrão (sem modificador): a aba é **salva no grupo**, mas **continua aberta** na janela original.
- Comportamento com **tecla modificadora** (ex.: Option no Mac) pressionada durante o drag: a aba é salva no grupo **E fechada** da janela original.

### C3. Drag-and-drop de janela inteira → grupo
- O mesmo comportamento (C2) deve valer para **uma janela inteira**: arrastar a janela para um grupo salva todas as suas abas lá, com a mesma lógica de modificador para fechar ou não a janela/abas originais.

### C4. Criação rápida de grupo
- Criar um grupo novo deve ser trivial: botão **"+"** simples, pede um nome, pronto.

### C5. Confirmação ao fechar/remover abas (2026-11-22)
- Fechar uma aba viva (única ou em lote, via seleção múltipla) e remover uma aba salva de um grupo pedem confirmação antes de agir — comportamento **configurável** (liga/desliga nas configurações, em "Gestão de abas"), default ligado.
- Não se aplica a "apagar grupo" nem "fechar janela inteira": essas duas já confirmavam sempre, incondicionalmente, por serem operações maiores (perdem N abas de uma vez) — ficam fora do escopo desta flag.

---

## Tema D — Persistência de sessão / substituir "restaurar abas" do Chrome (v2 candidata)

> O próprio usuário marcou este tema como "pensar mais antes de fazer — talvez v2".

### D1. Chrome hoje mantém abas entre reinícios
- Configuração atual do usuário: Chrome sempre reabre todas as abas que estavam abertas ao reiniciar o programa.

### D2. Extensão assume esse papel
- Ideia: a extensão monitora as abas abertas (igual ao tema C) e **salva automaticamente o estado** delas.
- Com isso, o usuário poderia **desligar** a configuração nativa do Chrome de restaurar abas — fecha o Chrome, as abas são descartadas de verdade, mas tudo que estava aberto fica **salvo dentro da extensão** e pode ser recuperado por lá.

### D3. Requisito crítico de monitoramento em background
- Esse monitoramento **não pode depender da new-tab estar aberta**. Precisa funcionar mesmo que não haja nenhuma new-tab aberta no momento — o usuário pode fechar o Chrome sem ter aberto nenhuma new-tab naquela sessão, e ainda assim espera que tudo tenha sido salvo.

### D4. Achado técnico (2026-11-21) — limitação real da Chrome Extensions API, não só "pensar mais"
Pesquisa aprofundada (docs oficiais `developer.chrome.com` + Chromium issue tracker) confirma uma limitação arquitetural, não apenas uma decisão de produto em aberto:
- **Não existe API de extensão para desligar o restore nativo do Chrome** ("Continuar de onde parou"). O pref (`session.restore_on_startup`) só é exposto via **enterprise policy** administrada por domínio — não por código de extensão. A `manifest key` `chrome_settings_overrides.startup_pages` controla apenas a opção "abrir página específica", não o modo de restaurar sessão.
- **Não existe evento que avise a extensão que o Chrome restaurou abas automaticamente no boot.** `chrome.runtime.onStartup` dispara ao iniciar o profile, mas não diferencia "restaurou sessão anterior" de "abriu limpo".
- **Não existe um "beforeunload" de navegador** (só de página). `windows.onRemoved`/`tabs.onRemoved` disparam por aba/janela individualmente, sem garantia de capturar o fechamento final do processo antes que ele morra — é um [issue aberto e não resolvido no próprio Chromium](https://issues.chromium.org/issues/40337437).
- **Consequência prática para D2**: dá para a extensão *também* salvar seu próprio estado continuamente (o que ARF-030/031 já faz via eventos `tabs`/`windows`), mas **não dá para desligar o restore nativo do Chrome por código** — as duas rotinas (nativa + extensão) sempre coexistem. O máximo que a extensão pode oferecer é: (a) guiar o usuário a desligar manualmente em `chrome://settings/onStartup` (ação dele, não da extensão), e (b) ter sua própria cópia do estado pronta para o caso de ele desligar. Não existe um "toggle" que a extensão ligue/desligue sozinha como o ARF-040 original presumia.
- Isso não invalida o tema D, mas muda o escopo real do ARF-040: de "a extensão desliga o restore nativo" para "a extensão oferece seu próprio restore paralelo, e o usuário decide manualmente desligar o nativo se quiser evitar duplicação". Decisão de como desenhar o SDD fica para quando o usuário quiser destravar este tema.

---

## Tema E — Arquitetura de performance (processo central + cache)

### E1. Baixo consumo de memória/recursos
- A extensão precisa ser **leve**.
- Mesmo com várias new-tabs abertas simultaneamente, **não** deve haver uma lógica de monitoramento/processamento duplicada rodando em cada aba.

### E2. Processo central único
- Deve existir **um processo central** (ex.: background/service worker) que todas as new-tabs **consultam**.
- Esse processo central é o mesmo responsável pelo monitoramento em background mencionado no Tema D (funciona com ou sem new-tab aberta).

### E3. Velocidade de carregamento
- Abrir uma new-tab tem que carregar o conteúdo **instantaneamente**.

### E4. Cache local da nuvem
- É necessário ter uma cópia/cache local dos dados que vêm da nuvem.
- Toda modificação do usuário **tem que ser salva na nuvem**.
- Mas a extensão **não pode consultar a nuvem a cada nova aba aberta** — isso geraria gargalo e risco de rate limit.
- A leitura do dia a dia tem que ser **instantânea, local, rápida**; a escrita/sincronização com a nuvem acontece em paralelo/background.

---

## Tema F — Estética "cozy" (inspirada no Tabliss)

### F1. Imagem de fundo rotativa
- Cada new-tab pode mostrar uma **nova imagem de fundo** (como o Tabliss fazia).

### F2. Controles de darken e blur
- Configurável: **quão escuro** (darken) o background fica.
- Configurável: **nível de blur**.

### F3. Widgets centrais
- Possibilidade de colocar **widgets no centro da tela**.
- Uso real do usuário: só relógio + data, minimalista.

### F4. Navegação entre backgrounds
- Poder **pular para o próximo** ou **voltar para o anterior** background sem fechar/reabrir a aba — uma setinha de navegação.

### F5. Fontes de imagem configuráveis
- **Unsplash**: suporte nativo, com **tópicos configuráveis pelo usuário** (a extensão traz padrões, mas o usuário pode mudar).
- **Subreddits de imagens**: suporte também, com subreddits configuráveis pelo usuário (padrões + customização livre).
- **Cor de fundo sólida**: lista de cores pré-definidas + seletor de cor livre (color picker).
- **Imagem(ns) local(is) do computador**: usuário seleciona uma ou várias imagens locais, e a extensão alterna entre elas conforme a frequência configurada.

### F6. Frequência de troca
- Configurável: **frequência de troca** da imagem de fundo (ou travar numa imagem específica/fixa).

### F7. Personalização do relógio
- Formato 24h ou AM/PM.
- Fuso horário — configurável, mas considerar pegar automaticamente do sistema/computador.
- Formato de data e hora.
- Fonte, tamanho, cor.
- (Usuário sinalizou que pode pensar em mais customizações de "cozy" depois — este tema é aberto.)

---

## Tema G — Modo Zen

### G1. Atalho de teclado
- Apertar **barra de espaço** ativa o modo zen.

### G2. Comportamento visual
- Mostra **apenas a imagem de fundo**, sem blur, sem darken, sem nenhum elemento gráfico/texto/ícone por cima. Só o background puro.

### G3. Toggle
- Apertar barra de espaço novamente **desativa** o modo zen e volta ao normal.

### G4. Escopo por aba
- O modo zen é **contextual por aba** — ativar em uma new-tab não afeta outras new-tabs abertas simultaneamente.

---

## Tema H — Interações detalhadas de abas e grupos

### H1. Clique em aba salva
- Clique simples numa aba salva: abre em **nova aba com foco**.
- **Cmd (Mac) + clique**: abre em nova aba **sem dar foco** (fica em background).

### H2. Abrir grupo inteiro
- Clicar no grupo em si **não** abre tudo.
- Precisa de um **botão específico** para "abrir grupo inteiro" — abre todas as abas do grupo, mas **sem foco** em nenhuma delas.

### H3. Customização visual de grupo
- Grupo pode ter **cor** e/ou **ícone**, além do nome.

### H4. Fixar abas dentro de um grupo
- Uma aba pode ser **fixada (pin)** dentro do seu grupo.
- Abas fixadas aparecem **no topo do grupo**, independente da ordenação normal.

---

## Tema I — Layouts da new-tab (configurável pelo usuário)

> Três variações pensadas; usuário escolhe qual prefere usar nas configurações.

### I1. Layout "scroll reveal"
- Ao abrir a new-tab, aparece **apenas o relógio** centralizado + background.
- Um único "tick" de scroll (roda do mouse) ou apertar **seta para baixo** já rola toda a tela para a seção de gestão de abas (sem precisar rolar manualmente até o fim).
- Durante essa transição, o background pode ficar **mais escuro e mais borrado** (parametrizável): valor padrão definido pela extensão, mas o usuário pode configurar o nível de blur/darken aplicado nessa transição.

### I2. Layout "coexistente"
- Relógio fica no **centro superior** da tela.
- Gestão de abas aparece **no mesmo espaço**, sem necessidade de rolagem — tudo visível/coexistindo.
- Como não há transição de rolagem, existe **apenas um** nível de blur/darken (não dois estados como no I1).

### I3. Layout "sem relógio"
- Usuário pode optar por **não mostrar relógio nenhum** — a new-tab mostra direto a gestão de abas.

### I4. Nota aberta
- Podem existir outras variações de layout no futuro — o usuário só conseguiu pensar nessas 3 até agora.

---

## Tema J — Acesso rápido numerado (1–9)

### J1. Conceito
- Separado do conceito de "grupos"/"abas salvas": são os sites que o usuário sempre acessa ao abrir o navegador (ex.: YouTube, Jira, e-mail).
- Até **9 itens configuráveis**, cada um atribuído a uma tecla numérica de **1 a 9**.

### J2. Posicionamento visual
- Sugestão do usuário: centralizados, **abaixo do relógio**.

### J3. Atalhos de teclado
- Apertar **um número (1-9)**: navega/abre o item correspondente **com foco**.
- **Tecla modificadora + número**: abre aquele item em nova aba **sem foco**.
- Pode encadear: modificador + vários números em sequência → abre **múltiplos** itens de acesso rápido em abas, todos sem foco.
- Possível tecla **0** (ou equivalente): abre **todos** os itens de acesso rápido de uma vez.

### J4. Bug conhecido (2026-11-21) — tecla numérica vai para a barra de endereços, não para o atalho
Reportado pelo usuário em uso real: apertar "1" (sem modificador) digitou "1" na barra de endereços do Chrome em vez de abrir o item de acesso rápido correspondente. Causa provável: o Chrome trata teclas numéricas simples como atalho nativo para a barra de endereços em certos contextos de foco da new-tab, competindo com o `keydown` da extensão. **Investigação e correção adiadas a pedido explícito do usuário** ("vamos pensar nisso depois, não agora") — possível direção: exigir sempre uma tecla modificadora (não só para abrir sem foco), a decidir quando o tema for retomado.

---

---

## Tema K — Brainstorm de melhorias (2026-11-27)

Claude fez um brainstorm amplo de gaps/melhorias olhando feature_ideas.md, kanban.md, ADRs e a pesquisa competitiva, testando o app ao vivo com volume realista (35 abas, 6 grupos). O usuário validou alguns pontos, descartou outros explicitamente por não serem seu caso de uso real — registrado aqui para não propor de novo sem motivo novo.

### K1. Indicador de "tempo sem uso" por grupo — [IDEIA VALIDADA, não priorizada ainda]
Mostrar no card do grupo há quanto tempo faz que nenhuma aba daquele grupo foi *aberta de verdade* no navegador (não contar expandir/colapsar o card como "uso"). Endereça a fricção de revisão que a própria pesquisa competitiva (`docs/research/chrome-context.md`) identificou como causa de abandono do Session Buddy/Tab Group: nada hoje diferencia um grupo criado ontem de um esquecido há 8 meses. Falta decidir: onde guardar o timestamp de "última abertura real" (precisa de um evento novo — hoje não existe rastreamento de "abri esta aba salva"), formato de exibição ("há 3 meses" vs data exata), e se afeta ordenação. **Não implementar sem o usuário pedir explicitamente** — é só uma ideia capturada.

### K2. Pontos considerados e EXPLICITAMENTE descartados pelo usuário (não repropor sem contexto novo)
- **Busca/filtro de abas ou grupos**: usuário nunca teve esse caso de uso na prática, mesmo com 60+ abas reais. Não é prioridade.
- **Densidade visual da lista de abas vivas** (parede de texto com volume alto): usuário gosta exatamente disso — prefere ver a lista completa a um resumo/agrupamento automático, usa a lista como forma de navegar e focar abas em vez de procurar na barra de abas do Chrome. Não "resolver" isso.
- **Detecção de abas duplicadas**: usuário não se incomoda em ter várias abas iguais abertas (ex. 3 Gmails) — não é um problema pra ele.
- **Grupos vazios ocupando espaço**: não incomoda.
- **Ações em lote tipo "fechar as outras"/"fechar à direita"**: não é o que o usuário tinha em mente ao mencionar "ações em lote" — ver K3.

### K3. Criar grupo diretamente a partir de uma seleção de abas vivas — [FEITO, ver ARF-170 no kanban]
Hoje o fluxo exige criar o grupo primeiro, depois mover abas pra ele. Usuário quer: no modo "Selecionar" (abas vivas), um botão "Criar grupo" ao lado de "Cancelar seleção" — abre o `GroupDialog` já existente, e ao confirmar cria o grupo já com as abas selecionadas dentro. Tecla modificadora (Alt/Option, mesmo padrão já usado no app) no clique do botão decide se fecha as abas originais do Chrome ou mantém abertas. Pré-visualização do grupo no dialog: sem ícones/abas reais (não quer isso), só o contador ao lado do nome (hoje sempre "0") virando dinâmico = quantidade de abas selecionadas. Ver card correspondente no `kanban.md`.

### K4. Performance — flash de fundo preto ao abrir nova aba — [FEITO]
Causa raiz confirmada: o fundo real depende de 2 round-trips sequenciais (IPC+IndexedDB para config, depois outro para o cache de candidatos reddit/unsplash) mais o fetch de rede da imagem — nada ficava disponível de forma síncrona no primeiro paint. Corrigido com `src/newtab/lib/backgroundQuickCache.ts`: a última cor/imagem efetivamente exibida é gravada em `localStorage` (síncrono) e lida no mount do `BackgroundLayer`, antes de qualquer round-trip, servindo de palpite imediato até o valor real chegar (que sempre o substitui). Validado: com a config real atrasada propositalmente, o fundo aparece em ~244ms via cache em vez de esperar o round-trip completo.

### K5. Consumo de memória da extensão — [ANALISADO, decisão pendente do usuário]
Investigação profunda feita via subagente Opus. Achado principal: a maior parte do consumo (pico de ~350MB, ~99MB em repouso) vem da imagem de papel de parede do Reddit/Unsplash sendo usada na resolução ORIGINAL (não a da tela) — não de vazamento de memória JS (heap da página fica entre 3,5-8MB). Recomendações de baixo risco já identificadas (pré-carregar sem seguro bytes na aba via `<link rel="prefetch">`, filtrar eventos irrelevantes no broadcast de abas vivas, lazy-load do `supabase-js` só quando o painel de configurações abre, criar formatadores de data do relógio uma vez). A correção de maior impacto (redimensionar a imagem para o tamanho da tela antes de aplicar) precisa de uma decisão do usuário, pois ele já pediu explicitamente "sem limitar resolução" no passado — avaliar se topa esse trade-off agora que o custo de memória ficou claro. Nenhuma correção aplicada ainda.

---

## Decisões/âmbito ainda aberto (não são perguntas ao usuário — são registradas para quando formos desenhar o SDD correspondente)

- Escolha concreta do backend de sync (Supabase vs Firebase vs Drive vs Git) — arquitetura decide, ver `docs/architecture/decisions.md`.
- Provedor de autenticação (OAuth Google é o caminho mais natural dado o uso atual do usuário).
- Formato exato dos dois arquivos de export (JSON estruturado).
- Semântica de "duplicar" na importação de **configuração** (config não é lista, não há o que duplicar — import de config substitui; só dados [grupos/abas] duplicam). Registrado como decisão de arquitetura, não pendência de produto.
