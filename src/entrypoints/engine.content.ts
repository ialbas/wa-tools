import { defineContentScript } from 'wxt/utils/define-content-script';
import { WT_NAMESPACE } from '@/engine/namespace';

/**
 * Content script no MAIN world — o ÚNICO com acesso aos internos do WhatsApp.
 * `document_start` + MAIN garantem que estamos no lugar certo, cedo o bastante
 * para o init-guard fechar a corrida de emissão de sinais.
 *
 * INTEGRAÇÃO AO VIVO (próxima fase): aqui carregamos o bundle do WA-JS
 * compilado sob `window.__WT`, registramos os módulos de sinal
 * (src/engine/signals/*), aplicamos os overrides via HookRegistry + InitGuard,
 * rodamos o autoteste inicial e só então `arm()`.
 *
 * Nesta fase de UI, apenas asseguramos que o seam do namespace existe — a
 * privacy-screen e o app-lock (US5) rodam no ISOLATED world e não dependem disto.
 */
export default defineContentScript({
  matches: ['*://web.whatsapp.com/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    const w = window as unknown as Record<string, unknown>;
    if (w[WT_NAMESPACE] == null) {
      w[WT_NAMESPACE] = { ready: false };
    }
  },
});
