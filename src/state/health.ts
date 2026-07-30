import type { SignalKind } from '@/shared/signal-kinds';

export type Health = 'unknown' | 'guaranteed' | 'unavailable';

export interface SuppressibleSignal {
  kind: SignalKind;
  health: Health;
  hookApplied: boolean;
  lastCheck: number;
  reason?: string;
}

export function initialSignal(kind: SignalKind, now: number): SuppressibleSignal {
  return { kind, health: 'unknown', hookApplied: false, lastCheck: now };
}

/**
 * Invariante da falha-segura (FR-012 / ui-contract):
 * uma feature só pode ser exibida/tratada como "ativa e garantida" quando
 * o autoteste passou (`guaranteed`) E o hook está aplicado.
 * Qualquer outro estado ⇒ NÃO garantida.
 */
export function isGuaranteedActive(s: SuppressibleSignal): boolean {
  return s.health === 'guaranteed' && s.hookApplied;
}

export type SelfTestOutcome = { ok: true } | { ok: false; reason: string };

/**
 * Aplica o resultado de um autoteste, retornando o novo estado do sinal.
 * Transições válidas:
 *   unknown/unavailable --(ok)--> guaranteed
 *   qualquer            --(falha)--> unavailable (desliga + motivo)
 * Puro (sem efeitos) para ser testável e determinístico.
 */
export function applySelfTest(
  prev: SuppressibleSignal,
  outcome: SelfTestOutcome,
  now: number,
): SuppressibleSignal {
  if (outcome.ok) {
    const { reason: _cleared, ...rest } = prev;
    return { ...rest, health: 'guaranteed', hookApplied: true, lastCheck: now };
  }
  return {
    ...prev,
    health: 'unavailable',
    hookApplied: false,
    lastCheck: now,
    reason: outcome.reason,
  };
}

/** Uma transição para `unavailable` exige aviso de falha-segura ao usuário (≤2s). */
export function requiresFailSafeAlert(
  prev: SuppressibleSignal,
  next: SuppressibleSignal,
): boolean {
  return prev.health !== 'unavailable' && next.health === 'unavailable';
}
