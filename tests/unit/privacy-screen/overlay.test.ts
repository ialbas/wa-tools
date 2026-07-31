// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import type { PrivacyScreenConfig } from '@/shared/schemas';
import { applyPrivacyScreen, SELECTORS } from '@/privacy-screen/overlay';

const STYLE_ID = 'wt-privacy-screen';
const ROOT_ATTR = 'data-wt-privacy-screen';
const REVEAL_ATTR = 'data-wt-reveal-hover';

/** Contrato observável flag → atributo `data-wt-*` (fixado propositalmente). */
const FLAG_ATTR: ReadonlyArray<[keyof PrivacyScreenConfig, string, string]> = [
  ['blurNames', 'data-wt-blur-names', SELECTORS.names],
  ['blurPhotos', 'data-wt-blur-photos', SELECTORS.photos],
  ['blurRecent', 'data-wt-blur-recent', SELECTORS.recent],
  ['blurConversation', 'data-wt-blur-conversation', SELECTORS.conversation],
  ['blurComposer', 'data-wt-blur-composer', SELECTORS.composer],
];

function cfg(overrides: Partial<PrivacyScreenConfig> = {}): PrivacyScreenConfig {
  return {
    blurNames: false,
    blurPhotos: false,
    blurRecent: false,
    blurConversation: false,
    blurComposer: false,
    shieldList: false,
    shieldChat: false,
    revealOnHover: false,
    ...overrides,
  };
}

function styleNodes(root: Document | HTMLElement = document): NodeListOf<Element> {
  return root.querySelectorAll(`style#${STYLE_ID}`);
}

function styleText(root: Document | HTMLElement = document): string {
  return root.querySelector(`style#${STYLE_ID}`)?.textContent ?? '';
}

afterEach(() => {
  document.getElementById(STYLE_ID)?.remove();
  const html = document.documentElement;
  [...html.attributes]
    .filter((a) => a.name.startsWith('data-wt-'))
    .forEach((a) => html.removeAttribute(a.name));
  document.body.innerHTML = '';
});

describe('applyPrivacyScreen — injeção do <style>', () => {
  it('injeta exatamente um <style id="wt-privacy-screen">', () => {
    applyPrivacyScreen(cfg({ blurNames: true }), document);
    expect(styleNodes()).toHaveLength(1);
    expect(document.getElementById(STYLE_ID)).toBeInstanceOf(HTMLStyleElement);
  });

  it('marca a raiz como ativa (data-wt-privacy-screen)', () => {
    applyPrivacyScreen(cfg(), document);
    expect(document.documentElement.hasAttribute(ROOT_ATTR)).toBe(true);
  });
});

describe('applyPrivacyScreen — cada flag liga/desliga alvo + atributo', () => {
  it.each(FLAG_ATTR)('flag %s liga atributo e emite o seletor', (flag, attr, selector) => {
    applyPrivacyScreen(cfg({ [flag]: true } as Partial<PrivacyScreenConfig>), document);

    // Atributo alternado na raiz.
    expect(document.documentElement.hasAttribute(attr)).toBe(true);
    // Regra de blur presente com o seletor real do alvo.
    const css = styleText();
    expect(css).toContain(selector);
    expect(css).toMatch(/filter:\s*blur\(/);
  });

  it.each(FLAG_ATTR)('flag %s desligada não marca atributo nem emite seletor', (flag, attr, selector) => {
    // Todas as flags true, exceto a que estamos testando.
    const all = cfg({
      blurNames: true,
      blurPhotos: true,
      blurRecent: true,
      blurConversation: true,
      blurComposer: true,
    });
    applyPrivacyScreen({ ...all, [flag]: false }, document);

    expect(document.documentElement.hasAttribute(attr)).toBe(false);
    expect(styleText()).not.toContain(selector);
  });

  it('sem nenhuma flag ligada, o <style> existe mas sem regras de blur', () => {
    applyPrivacyScreen(cfg(), document);
    expect(styleNodes()).toHaveLength(1);
    expect(styleText()).not.toMatch(/filter:\s*blur\(/);
  });
});

describe('applyPrivacyScreen — revealOnHover controla a regra :hover', () => {
  it('com revealOnHover: inclui regra :hover e o atributo na raiz', () => {
    applyPrivacyScreen(cfg({ blurNames: true, revealOnHover: true }), document);
    expect(document.documentElement.hasAttribute(REVEAL_ATTR)).toBe(true);
    expect(styleText()).toContain(':hover');
  });

  it('sem revealOnHover: nenhuma regra :hover e sem o atributo', () => {
    applyPrivacyScreen(cfg({ blurNames: true, revealOnHover: false }), document);
    expect(document.documentElement.hasAttribute(REVEAL_ATTR)).toBe(false);
    expect(styleText()).not.toContain(':hover');
  });
});

describe('update — reescreve regras sem duplicar o <style>', () => {
  it('troca o conteúdo mantendo um único nó e re-sincroniza atributos', () => {
    const handle = applyPrivacyScreen(cfg({ blurNames: true, revealOnHover: false }), document);
    const before = styleText();
    expect(document.documentElement.hasAttribute('data-wt-blur-names')).toBe(true);
    expect(before).toContain(SELECTORS.names);
    expect(before).not.toContain(':hover');

    handle.update(cfg({ blurComposer: true, revealOnHover: true }));

    // Continua exatamente um <style>.
    expect(styleNodes()).toHaveLength(1);

    // Regras trocaram: nomes saíram, composer entrou, hover apareceu.
    const after = styleText();
    expect(after).not.toBe(before);
    expect(after).not.toContain(SELECTORS.names);
    expect(after).toContain(SELECTORS.composer);
    expect(after).toContain(':hover');

    // Atributos re-sincronizados.
    expect(document.documentElement.hasAttribute('data-wt-blur-names')).toBe(false);
    expect(document.documentElement.hasAttribute('data-wt-blur-composer')).toBe(true);
    expect(document.documentElement.hasAttribute(REVEAL_ATTR)).toBe(true);
  });
});

describe('dispose — remove o <style> e limpa os atributos', () => {
  it('remove o nó e todos os data-wt-*', () => {
    const handle = applyPrivacyScreen(
      cfg({ blurNames: true, blurPhotos: true, revealOnHover: true }),
      document,
    );
    expect(styleNodes()).toHaveLength(1);

    handle.dispose();

    expect(styleNodes()).toHaveLength(0);
    expect(document.getElementById(STYLE_ID)).toBeNull();
    const leftover = [...document.documentElement.attributes].filter((a) =>
      a.name.startsWith('data-wt-'),
    );
    expect(leftover).toHaveLength(0);
  });

  it('é idempotente: dispose repetido e update pós-dispose são no-ops seguros', () => {
    const handle = applyPrivacyScreen(cfg({ blurNames: true }), document);
    handle.dispose();
    expect(() => handle.dispose()).not.toThrow();
    expect(() => handle.update(cfg({ blurPhotos: true }))).not.toThrow();
    // Nada ressuscitou.
    expect(styleNodes()).toHaveLength(0);
    expect(document.documentElement.hasAttribute('data-wt-blur-photos')).toBe(false);
  });
});

describe('idempotência de aplicação e escopo por elemento', () => {
  it('aplicar duas vezes reaproveita o mesmo <style> (não acumula)', () => {
    applyPrivacyScreen(cfg({ blurNames: true }), document);
    applyPrivacyScreen(cfg({ blurPhotos: true }), document);
    expect(styleNodes()).toHaveLength(1);
  });

  it('aceita um HTMLElement como raiz: <style> e atributos ficam nele', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const handle = applyPrivacyScreen(cfg({ blurComposer: true, revealOnHover: true }), host);

    // O <style> foi para dentro do host, não para o <head>.
    expect(host.querySelectorAll(`style#${STYLE_ID}`)).toHaveLength(1);
    expect(document.head.querySelector(`style#${STYLE_ID}`)).toBeNull();

    // Atributos no host, não no <html>.
    expect(host.hasAttribute(ROOT_ATTR)).toBe(true);
    expect(host.hasAttribute('data-wt-blur-composer')).toBe(true);
    expect(document.documentElement.hasAttribute(ROOT_ATTR)).toBe(false);

    handle.dispose();
    expect(host.querySelector(`style#${STYLE_ID}`)).toBeNull();
    expect(host.hasAttribute(ROOT_ATTR)).toBe(false);
  });
});
