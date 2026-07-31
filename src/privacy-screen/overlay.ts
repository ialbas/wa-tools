import type { PrivacyScreenConfig } from '@/shared/schemas';

/**
 * Privacy Screen (US5) — camada de ofuscação visual do WhatsApp Web.
 *
 * DOM puro (sem React): injeta um único `<style>` com regras de `filter: blur`
 * e alterna atributos `data-wt-*` na raiz. Todo o estado visível vive em CSS,
 * então ligar/desligar um alvo é só (des)marcar um atributo — sem tocar no DOM
 * do WhatsApp e sem custo de reflow por elemento.
 *
 * Contratos externos são importados, nunca reimplementados.
 */

/* -------------------------------------------------------------------------- *
 * SELECTORS — mapa dos alvos reais no DOM do WhatsApp Web.
 *
 * ⚠️  AJUSTAR CONTRA web.whatsapp.com: as classes do WhatsApp são ofuscadas e
 *     mudam entre releases. Mantemos aqui, isolado, os seletores mais estáveis
 *     (atributos ARIA/estruturais) para que a manutenção seja um único ponto.
 *     Cada valor pode ser uma lista de seletores separada por vírgula.
 * -------------------------------------------------------------------------- */
// Verificado ao vivo contra web.whatsapp.com (build jul/2026). O WhatsApp renderiza
// cada view num container/role diferente: a lista principal em #pane-side [role="row"];
// ARQUIVADAS (e buscas) sob #app com [role="listitem"]; o nome no cabeçalho da conversa
// é #main header span[dir="auto"] (SEM title). Por isso cobrimos row E listitem, de forma
// container-agnóstica — cobrir a mais é o lado seguro numa tela de privacidade (um nome
// que vaza derruba o propósito; um blur a mais, não).
export const SELECTORS = {
  /** Nomes: linhas da lista (principal + arquivadas/busca) + cabeçalho da conversa. */
  names:
    '#pane-side [role="row"] span[title][dir="auto"], [role="listitem"] span[title][dir="auto"], #main header span[dir="auto"]',
  /** Fotos de perfil: o avatar é um SVG com <image> dentro (NÃO um <img> HTML) —
   *  por isso cobrimos svg:has(image) + img, em todas as views. */
  photos:
    '#pane-side [role="row"] :is(svg:has(image), img), [role="listitem"] :is(svg:has(image), img), #main header :is(svg:has(image), img)',
  /** Prévia da última mensagem (inclui mensagens de sistema/reações/"mudou a
   *  descrição", que ficam em span SEM dir) — cobrimos todo span do gridcell da prévia. */
  recent:
    '#pane-side [role="row"] [role="gridcell"]:last-child span, [role="listitem"] [role="gridcell"]:last-child span',
  /** Mensagens dentro da conversa aberta (linha inteira do balão). */
  conversation: '#main [role="row"]',
  /** Campo de composição (input de texto da conversa). */
  composer: '#main footer [contenteditable="true"], #main footer [role="textbox"]',
} as const;

/* -------------------------------------------------------------------------- *
 * Constantes internas
 * -------------------------------------------------------------------------- */

/** Id único do `<style>` — garante um só nó por documento (idempotência). */
const STYLE_ID = 'wt-privacy-screen';

/** Marcador na raiz: indica que a Privacy Screen está ativa e ancora o escopo. */
const ROOT_ATTR = 'data-wt-privacy-screen';

/** Atributo que habilita as regras de revelar-ao-passar-o-cursor. */
const REVEAL_ATTR = 'data-wt-reveal-hover';

/**
 * Força/duração expostas como tokens (com fallback) — nada de números mágicos
 * hardcoded no componente; consumidores podem sobrescrever via CSS custom props.
 */
const BLUR = 'var(--wt-privacy-blur, 8px)';
const REVEAL = 'var(--wt-privacy-reveal, 120ms)';

interface Target {
  /** Flag correspondente na config. */
  readonly flag: keyof Omit<PrivacyScreenConfig, 'revealOnHover'>;
  /** Atributo `data-wt-*` alternado na raiz quando a flag está ligada. */
  readonly attr: string;
  /** Seletor CSS do alvo no DOM do WhatsApp. */
  readonly selector: string;
}

/** Os 5 alvos, na ordem de precedência visual (lista → conversa → composer). */
const TARGETS: readonly Target[] = [
  { flag: 'blurNames', attr: 'data-wt-blur-names', selector: SELECTORS.names },
  { flag: 'blurPhotos', attr: 'data-wt-blur-photos', selector: SELECTORS.photos },
  { flag: 'blurRecent', attr: 'data-wt-blur-recent', selector: SELECTORS.recent },
  { flag: 'blurConversation', attr: 'data-wt-blur-conversation', selector: SELECTORS.conversation },
  { flag: 'blurComposer', attr: 'data-wt-blur-composer', selector: SELECTORS.composer },
] as const;

/* -------------------------------------------------------------------------- *
 * API pública
 * -------------------------------------------------------------------------- */

export interface PrivacyScreenHandle {
  /** Reaplica a config: reescreve as regras e re-sincroniza os atributos, sem duplicar o `<style>`. */
  update(config: PrivacyScreenConfig): void;
  /** Remove o `<style>` e limpa todos os atributos da raiz. Idempotente. */
  dispose(): void;
}

/**
 * Aplica a Privacy Screen sobre `root` (documento inteiro por padrão).
 *
 * Idempotente: chamadas repetidas reaproveitam o mesmo `<style id="wt-privacy-screen">`
 * em vez de acumular nós.
 */
export function applyPrivacyScreen(
  config: PrivacyScreenConfig,
  root: Document | HTMLElement = document,
): PrivacyScreenHandle {
  const doc = resolveDoc(root);
  const rootEl = resolveRootElement(root);
  const container = resolveContainer(root);
  const styleEl = getOrCreateStyle(doc, container);

  let disposed = false;

  const render = (cfg: PrivacyScreenConfig): void => {
    styleEl.textContent = buildCss(cfg);
    syncAttributes(rootEl, cfg);
  };

  render(config);

  return {
    update(next: PrivacyScreenConfig): void {
      if (disposed) return;
      render(next);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      styleEl.remove();
      clearAttributes(rootEl);
    },
  };
}

/* -------------------------------------------------------------------------- *
 * Geração de CSS
 * -------------------------------------------------------------------------- */

/**
 * Monta as regras para a config atual. Só emite regras para as flags ligadas,
 * cada uma ancorada em `[ROOT_ATTR][attr]` (o mesmo atributo alternado na raiz),
 * o que mantém o escopo dentro da subárvore marcada.
 *
 * `!important` no blur é deliberado: é uma garantia de privacidade — precisa
 * vencer estilos utilitários/inline do WhatsApp. A regra de hover (mais
 * específica e posterior) sobrepõe o blur para revelar sob o cursor.
 */
function buildCss(config: PrivacyScreenConfig): string {
  const active = TARGETS.filter((t) => config[t.flag]);
  if (active.length === 0) return '';

  const blocks: string[] = [];

  for (const t of active) {
    blocks.push(
      `[${ROOT_ATTR}][${t.attr}] :is(${t.selector}) {\n` +
        `  filter: blur(${BLUR}) !important;\n` +
        `  transition: filter ${REVEAL} ease;\n` +
        `}`,
    );
  }

  if (config.revealOnHover) {
    for (const t of active) {
      blocks.push(
        `[${ROOT_ATTR}][${REVEAL_ATTR}][${t.attr}] :is(${t.selector}):hover {\n` +
          `  filter: none !important;\n` +
          `}`,
      );
    }
  }

  // Acessibilidade: quem pede menos movimento não recebe a transição de revelar.
  const activeSelectors = active.map((t) => t.selector).join(', ');
  blocks.push(
    `@media (prefers-reduced-motion: reduce) {\n` +
      `  [${ROOT_ATTR}] :is(${activeSelectors}) { transition: none; }\n` +
      `}`,
  );

  return blocks.join('\n\n');
}

/* -------------------------------------------------------------------------- *
 * Atributos na raiz
 * -------------------------------------------------------------------------- */

function syncAttributes(el: HTMLElement, config: PrivacyScreenConfig): void {
  el.setAttribute(ROOT_ATTR, '');
  for (const t of TARGETS) toggleAttr(el, t.attr, config[t.flag]);
  toggleAttr(el, REVEAL_ATTR, config.revealOnHover);
}

function clearAttributes(el: HTMLElement): void {
  el.removeAttribute(ROOT_ATTR);
  el.removeAttribute(REVEAL_ATTR);
  for (const t of TARGETS) el.removeAttribute(t.attr);
}

function toggleAttr(el: HTMLElement, attr: string, on: boolean): void {
  if (on) el.setAttribute(attr, '');
  else el.removeAttribute(attr);
}

/* -------------------------------------------------------------------------- *
 * Resolução de raiz / container / `<style>`
 * -------------------------------------------------------------------------- */

function isDocument(root: Document | HTMLElement): root is Document {
  return root.nodeType === 9; // Node.DOCUMENT_NODE
}

function resolveDoc(root: Document | HTMLElement): Document {
  return isDocument(root) ? root : root.ownerDocument;
}

/** Elemento que carrega os atributos: `<html>` para Document, o próprio para Element. */
function resolveRootElement(root: Document | HTMLElement): HTMLElement {
  return isDocument(root) ? root.documentElement : root;
}

/** Onde o `<style>` é inserido: `<head>` para Document, o próprio elemento para Element. */
function resolveContainer(root: Document | HTMLElement): Element {
  if (isDocument(root)) return root.head ?? root.documentElement;
  return root;
}

/** Reaproveita o `<style>` existente (idempotência) ou cria um novo. */
function getOrCreateStyle(doc: Document, container: Element): HTMLStyleElement {
  const existing = doc.getElementById(STYLE_ID);
  if (existing instanceof HTMLStyleElement) return existing;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  container.appendChild(style);
  return style;
}
