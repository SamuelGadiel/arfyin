/**
 * Estado de UI efemero compartilhado entre componentes (nao vai pro AppConfig —
 * nao e preferencia persistida). Hoje so o drawer de configuracoes, para o
 * atalho de zen mode (barra de espaco) saber que nao deve ativar enquanto o
 * usuario esta interagindo com um botao/slider dentro do drawer.
 */
export const uiState = $state({ settingsOpen: false });
