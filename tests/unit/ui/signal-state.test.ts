import { describe, it, expect } from 'vitest';
import type { Health, SuppressibleSignal } from '@/state/health';
import { isGuaranteedActive } from '@/state/health';
import { signalUiState } from '@/ui/signal-state';

const HEALTHS: readonly Health[] = ['unknown', 'guaranteed', 'unavailable'];

/** Constrói um sinal; omite `reason` quando ausente (exactOptionalPropertyTypes). */
function sig(health: Health, hookApplied: boolean, reason?: string): SuppressibleSignal {
  const base: SuppressibleSignal = { kind: 'read-receipt', health, hookApplied, lastCheck: 0 };
  return reason === undefined ? base : { ...base, reason };
}

describe('signalUiState — mapeamento normativo da falha-segura (ui-contract)', () => {
  it('garantido + hook aplicado + ligado → Ativo/accent', () => {
    expect(signalUiState(sig('guaranteed', true), true)).toEqual({
      key: 'active',
      label: 'Ativo',
      tone: 'accent',
    });
  });

  it('ligado + unavailable → Indisponível/warn, com o motivo no rótulo', () => {
    const ui = signalUiState(sig('unavailable', false, 'hook interno mudou'), true);
    expect(ui.key).toBe('unavailable');
    expect(ui.tone).toBe('warn');
    expect(ui.label).toContain('Indisponível');
    expect(ui.label).toContain('hook interno mudou');
  });

  it('ligado + unavailable sem motivo → rótulo "Indisponível" puro', () => {
    expect(signalUiState(sig('unavailable', false), true)).toEqual({
      key: 'unavailable',
      label: 'Indisponível',
      tone: 'warn',
    });
  });

  it('desligado → Inativo/dim (mesmo garantido e aplicado)', () => {
    expect(signalUiState(sig('guaranteed', true), false)).toEqual({
      key: 'inactive',
      label: 'Inativo',
      tone: 'dim',
    });
    // desligado tem precedência sobre unavailable
    expect(signalUiState(sig('unavailable', false, 'x'), false)).toEqual({
      key: 'inactive',
      label: 'Inativo',
      tone: 'dim',
    });
  });

  it('ligado + unknown (autoteste não concluído) → Verificando…/dim', () => {
    expect(signalUiState(sig('unknown', false), true)).toEqual({
      key: 'checking',
      label: 'Verificando…',
      tone: 'dim',
    });
  });

  it('ligado + guaranteed mas hook NÃO aplicado → Verificando… (jamais Ativo)', () => {
    const ui = signalUiState(sig('guaranteed', false), true);
    expect(ui.key).toBe('checking');
    expect(ui.key).not.toBe('active');
  });

  it('INVARIANTE: nunca "active" quando health!=="guaranteed" ou hookApplied===false — mesmo ligado', () => {
    for (const health of HEALTHS) {
      for (const hookApplied of [true, false]) {
        for (const enabled of [true, false]) {
          for (const reason of [undefined, 'motivo'] as const) {
            const signal = sig(health, hookApplied, reason);
            const ui = signalUiState(signal, enabled);

            // Equivalência normativa: active ⟺ (guard da falha-segura) ∧ ligado.
            expect(ui.key === 'active').toBe(isGuaranteedActive(signal) && enabled);

            if (ui.key === 'active') {
              expect(enabled).toBe(true);
              expect(health).toBe('guaranteed');
              expect(hookApplied).toBe(true);
              expect(isGuaranteedActive(signal)).toBe(true);
            }

            // A proibição explícita do contrato.
            if (health !== 'guaranteed' || hookApplied === false) {
              expect(ui.key).not.toBe('active');
            }
          }
        }
      }
    }
  });

  it('tone e key são sempre coerentes com o conjunto do contrato', () => {
    const ui = signalUiState(sig('unknown', false), true);
    expect(['active', 'unavailable', 'inactive', 'checking']).toContain(ui.key);
    expect(['accent', 'warn', 'dim']).toContain(ui.tone);
  });
});
