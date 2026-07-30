import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

/**
 * Extensão MV3. Permissões ENXUTAS e intencionais (FR-014/015):
 * - storage: só configurações locais (sem unlimitedStorage — não cacheamos mensagens)
 * - activeTab + host web.whatsapp.com: injeção só no WhatsApp Web
 * SEM webRequest, SEM <all_urls>, SEM identity (sem contas/monetização), SEM rede.
 */
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'WA Tools — Privacidade',
    description:
      'Controle de privacidade e ocultação para WhatsApp Web. 100% local, sem contas, sem rede.',
    permissions: ['storage', 'activeTab'],
    host_permissions: ['*://web.whatsapp.com/*'],
  },
});
