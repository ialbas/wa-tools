import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { createRoot, type Root } from 'react-dom/client';
import { ContentApp } from '@/ui/ContentApp';
import '@/ui/theme.css';

/**
 * Content script no ISOLATED world — a UI. Renderiza o painel de privacidade
 * (US5) num shadow root (isola nossos estilos do WhatsApp). O overlay de blur
 * é aplicado ao documento pelo próprio ContentApp, fora do shadow root.
 */
export default defineContentScript({
  matches: ['*://web.whatsapp.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const ui = await createShadowRootUi<Root>(ctx, {
      name: 'wt-privacy-panel',
      position: 'inline',
      anchor: 'body',
      onMount(container) {
        const root = createRoot(container);
        root.render(<ContentApp />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();
  },
});
