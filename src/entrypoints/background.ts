import { defineBackground } from 'wxt/utils/define-background';

/**
 * Service worker (MV3). Efêmero por natureza — a fonte da verdade é
 * `chrome.storage.local`, reidratada quando necessário.
 *
 * v1 (esta fase): o content script acessa o storage direto para a
 * privacy-screen e o app-lock (US5), que não dependem do engine de sinais.
 *
 * PRÓXIMA FASE (integração ao vivo dos sinais): este SW passa a ser o dono do
 * estado + orquestrador do bridge (content ↔ background ↔ main-world) e do
 * autoteste/canário — conforme contracts/bridge-messages.md.
 */
export default defineBackground(() => {
  // Sem trabalho no startup ainda; presença registrada para o MV3.
});
