import { describe, it, expect } from 'vitest';
import { SELECTORS } from '@/privacy-screen/overlay';

/**
 * Regressão: o WhatsApp renderiza views em containers/roles diferentes.
 * As ARQUIVADAS (e buscas) usam [role="listitem"] sob #app — se os seletores
 * cobrissem só #pane-side [role="row"], nomes/fotos/prévias vazariam lá
 * (bug pego ao vivo). Estes testes garantem a cobertura container-agnóstica.
 */
describe('SELECTORS — cobertura de todas as views (anti-vazamento)', () => {
  it('names cobre lista principal (row), arquivadas (listitem) e cabeçalho', () => {
    expect(SELECTORS.names).toContain('[role="row"]');
    expect(SELECTORS.names).toContain('[role="listitem"]');
    // cabeçalho: nome é span[dir="auto"] SEM title
    expect(SELECTORS.names).toContain('#main header span[dir="auto"]');
  });

  it('photos cobre row e listitem (avatares em qualquer view)', () => {
    expect(SELECTORS.photos).toContain('[role="row"]');
    expect(SELECTORS.photos).toContain('[role="listitem"]');
  });

  it('photos cobre o avatar SVG (<image>), não só <img> — o avatar do WhatsApp é SVG', () => {
    expect(SELECTORS.photos).toContain('svg:has(image)');
  });

  it('recent (prévias) cobre row e listitem', () => {
    expect(SELECTORS.recent).toContain('[role="row"]');
    expect(SELECTORS.recent).toContain('[role="listitem"]');
  });
});
