# WA Tools — Privacidade

Extensão de navegador (Chrome/Chromium, Manifest V3) que adiciona uma **camada de privacidade e ocultação** ao WhatsApp Web. **100% local**: sem contas, sem login, sem servidores, sem monetização — nada das suas conversas sai do dispositivo.

> ⚠️ Projeto independente, **não** afiliado, associado ou endossado pelo WhatsApp ou pela Meta. "WhatsApp" é marca da Meta.

## O que faz

**Tela de privacidade (antiespionagem)** — funcionando:
- Desfocar nomes, fotos, prévias de mensagens, conversa aberta e campo de composição, com **revelar ao passar o cursor**.
- **Blindagem por região** (robusta): borra a lista e a conversa inteiras, imune a mudanças de estrutura do WhatsApp.
- **Bloqueio por senha** local (PBKDF2 + lockout) — cobre o conteúdo até você autenticar.

**Ocultação de sinais** — lógica pronta e testada, integração ao vivo em andamento:
- Ler sem confirmação de leitura (tique azul) **por-conversa**, sem reciprocidade, cobrindo grupos.
- Modo invisível (online + visto por último), esconder "digitando…"/"gravando…", áudio sem recibo.
- **Falha-segura**: se um hook interno do WhatsApp quebra, a feature se desliga e avisa — nunca aparência de "ativo" sem suprimir de fato.

Fora de escopo por design: recuperação de mensagens apagadas/view-once e envio em massa/broadcast.

## Privacidade

- Permissões enxutas: `storage`, `activeTab` e host `web.whatsapp.com`. **Sem** `webRequest`, `<all_urls>`, `unlimitedStorage` ou `identity`.
- Nenhuma chamada de rede a servidores próprios ou de terceiros. Configurações só em `chrome.storage.local`.
- Não lê nem armazena o conteúdo das mensagens — mexe apenas nos metadados de saída (presença/recibos) e numa camada visual local.

Política completa: [PRIVACY.md](./PRIVACY.md).

## Stack

WXT (Manifest V3) · React 18 · Tailwind CSS v4 · TypeScript · Zod · Zustand · Vitest. A ocultação de sinais usa [WA-JS](https://github.com/wppconnect-team/wa-js) sob namespace isolado.

## Desenvolvimento

```bash
pnpm install
pnpm dev          # WXT em watch (dev)
pnpm test         # Vitest (unit)
pnpm typecheck    # tsc --noEmit
pnpm build        # build de produção → .output/chrome-mv3/
pnpm zip          # empacota → .output/wa-tools-<versão>-chrome.zip
pnpm gen:icons    # regenera os ícones a partir de assets/icon.svg
```

## Instalar sem compactação (dev)

1. `pnpm build`
2. `chrome://extensions` → ative **Modo do desenvolvedor** → **Carregar sem compactação** → selecione `.output/chrome-mv3/`.
3. Abra `web.whatsapp.com` e recarregue.

## Estado

- ✅ Tela de privacidade (blur + reveal + blindagem) e bloqueio por senha — verificados ao vivo.
- 🚧 Ocultação de sinais — módulos prontos e testados; falta a amarração ao vivo aos internos do WhatsApp + testes E2E de duas contas.
- Suíte: 110 testes unitários.

## Licença

[MIT](./LICENSE).
