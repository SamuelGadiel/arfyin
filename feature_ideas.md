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

---

## Decisões/âmbito ainda aberto (não são perguntas ao usuário — são registradas para quando formos desenhar o SDD correspondente)

- Escolha concreta do backend de sync (Supabase vs Firebase vs Drive vs Git) — arquitetura decide, ver `docs/architecture/decisions.md`.
- Provedor de autenticação (OAuth Google é o caminho mais natural dado o uso atual do usuário).
- Formato exato dos dois arquivos de export (JSON estruturado).
- Semântica de "duplicar" na importação de **configuração** (config não é lista, não há o que duplicar — import de config substitui; só dados [grupos/abas] duplicam). Registrado como decisão de arquitetura, não pendência de produto.
