import { describe, it, expect } from 'vitest';
import {
  initialSignal,
  applySelfTest,
  isGuaranteedActive,
  requiresFailSafeAlert,
} from '@/state/health';

describe('máquina de saúde (falha-segura)', () => {
  it('unknown → guaranteed quando o autoteste passa', () => {
    const s0 = initialSignal('read-receipt', 0);
    const s1 = applySelfTest(s0, { ok: true }, 10);
    expect(s1.health).toBe('guaranteed');
    expect(s1.hookApplied).toBe(true);
    expect(isGuaranteedActive(s1)).toBe(true);
  });

  it('qualquer estado → unavailable quando o autoteste falha, com motivo', () => {
    const s0 = applySelfTest(initialSignal('presence', 0), { ok: true }, 1);
    const s1 = applySelfTest(s0, { ok: false, reason: 'alvo interno sumiu' }, 2);
    expect(s1.health).toBe('unavailable');
    expect(s1.hookApplied).toBe(false);
    expect(s1.reason).toBe('alvo interno sumiu');
    expect(isGuaranteedActive(s1)).toBe(false);
  });

  it('NUNCA é "ativo garantido" sem hook aplicado', () => {
    const s = { ...initialSignal('typing', 0), health: 'guaranteed' as const, hookApplied: false };
    expect(isGuaranteedActive(s)).toBe(false);
  });

  it('transição para unavailable exige aviso de falha-segura', () => {
    const ok = applySelfTest(initialSignal('audio-played', 0), { ok: true }, 1);
    const down = applySelfTest(ok, { ok: false, reason: 'x' }, 2);
    expect(requiresFailSafeAlert(ok, down)).toBe(true);
    // já indisponível → não redispara aviso
    const stay = applySelfTest(down, { ok: false, reason: 'y' }, 3);
    expect(requiresFailSafeAlert(down, stay)).toBe(false);
  });
});
