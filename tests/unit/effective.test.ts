import { describe, it, expect } from 'vitest';
import { defaultPrivacyConfig, type PerChatRule } from '@/shared/schemas';
import { effectiveSignal, effectiveForChat, indexRules } from '@/state/effective';

describe('resolução per-chat (override ?? global)', () => {
  it('sem regra, herda o global', () => {
    const cfg = defaultPrivacyConfig();
    cfg.signals['read-receipt'] = true;
    expect(effectiveSignal(cfg, undefined, 'read-receipt')).toBe(true);
    expect(effectiveSignal(cfg, undefined, 'presence')).toBe(false);
  });

  it('override da conversa vence o global (nos dois sentidos)', () => {
    const cfg = defaultPrivacyConfig(); // read-receipt global = false
    const ruleOn: PerChatRule = { chatId: 'A', overrides: { 'read-receipt': true }, updatedAt: 1 };
    expect(effectiveSignal(cfg, ruleOn, 'read-receipt')).toBe(true);

    cfg.signals['read-receipt'] = true; // global = true
    const ruleOff: PerChatRule = { chatId: 'B', overrides: { 'read-receipt': false }, updatedAt: 1 };
    expect(effectiveSignal(cfg, ruleOff, 'read-receipt')).toBe(false);
  });

  it('chat A e chat B podem divergir simultaneamente (SC-002)', () => {
    const cfg = defaultPrivacyConfig();
    const a: PerChatRule = { chatId: 'A', overrides: { 'read-receipt': true }, updatedAt: 1 };
    const b: PerChatRule = { chatId: 'B', overrides: { 'read-receipt': false }, updatedAt: 1 };
    expect(effectiveSignal(cfg, a, 'read-receipt')).toBe(true);
    expect(effectiveSignal(cfg, b, 'read-receipt')).toBe(false);
  });

  it('effectiveForChat cobre todos os sinais', () => {
    const map = effectiveForChat(defaultPrivacyConfig(), undefined);
    expect(Object.keys(map).length).toBe(5);
  });

  it('indexRules: última regra do mesmo chatId vence', () => {
    const idx = indexRules([
      { chatId: 'A', overrides: { typing: true }, updatedAt: 1 },
      { chatId: 'A', overrides: { typing: false }, updatedAt: 2 },
    ]);
    expect(idx.get('A')?.overrides.typing).toBe(false);
  });
});
