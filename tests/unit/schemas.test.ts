import { describe, it, expect } from 'vitest';
import {
  defaultPrivacyConfig,
  privacyConfigSchema,
  perChatRuleSchema,
  lockConfigSchema,
} from '@/shared/schemas';
import { SIGNAL_KINDS } from '@/shared/signal-kinds';

describe('privacyConfigSchema', () => {
  it('aceita o default e cobre todos os SignalKind', () => {
    const cfg = defaultPrivacyConfig();
    expect(privacyConfigSchema.safeParse(cfg).success).toBe(true);
    expect(Object.keys(cfg.signals).sort()).toEqual([...SIGNAL_KINDS].sort());
  });

  it('default é opt-in: todo sinal começa desligado', () => {
    const cfg = defaultPrivacyConfig();
    expect(Object.values(cfg.signals).every((v) => v === false)).toBe(true);
    expect(cfg.optionalStatusViewing).toBe(false);
  });

  it('rejeita config com sinal faltando', () => {
    const bad = { ...defaultPrivacyConfig(), signals: { 'read-receipt': true } };
    expect(privacyConfigSchema.safeParse(bad).success).toBe(false);
  });
});

describe('perChatRuleSchema', () => {
  it('aceita override parcial', () => {
    const r = { chatId: '55319@c.us', overrides: { 'read-receipt': true }, updatedAt: 1 };
    expect(perChatRuleSchema.safeParse(r).success).toBe(true);
  });
  it('rejeita chatId vazio', () => {
    const r = { chatId: '', overrides: {}, updatedAt: 1 };
    expect(perChatRuleSchema.safeParse(r).success).toBe(false);
  });
});

describe('lockConfigSchema', () => {
  it('exige iterations positivo', () => {
    const bad = { enabled: true, passHash: 'x', salt: 'y', iterations: 0 };
    expect(lockConfigSchema.safeParse(bad).success).toBe(false);
  });
});
