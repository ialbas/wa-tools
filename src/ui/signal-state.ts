import type { SuppressibleSignal } from '@/state/health';
import { isGuaranteedActive } from '@/state/health';

/**
 * Estado visual normativo de um sinal (ui-contract.md, FR-012 / US3).
 * `tone` mapeia 1:1 para um token de cor: accent → --wt-accent,
 * warn → --wt-warn, dim → --wt-text-dim.
 */
export type SignalUiState = {
  key: 'active' | 'unavailable' | 'inactive' | 'checking';
  label: string;
  tone: 'accent' | 'warn' | 'dim';
};

/**
 * Deriva o estado visual da falha-segura a partir do sinal e do desejo do usuário.
 *
 * Contrato NORMATIVO (proibido divergir — é o coração da falha-segura):
 *   1. garantido + hook aplicado + ligado → Ativo (accent)
 *   2. ligado mas `unavailable`            → Indisponível (warn) [+ motivo]
 *   3. desligado                            → Inativo (dim)
 *   4. caso contrário (unknown / verificando) → Verificando… (dim)
 *
 * INVARIANTE: só retorna `active` quando `isGuaranteedActive(signal)` é verdadeiro.
 * Um sinal `guaranteed` porém com `hookApplied === false` NUNCA é "Ativo" — cai em
 * Verificando…, preservando a garantia de falha-segura (nunca prometer supressão
 * que o autoteste não confirmou).
 */
export function signalUiState(signal: SuppressibleSignal, enabled: boolean): SignalUiState {
  // (1) Único caminho para "active" — atravessa o guard da falha-segura.
  if (enabled && isGuaranteedActive(signal)) {
    return { key: 'active', label: 'Ativo', tone: 'accent' };
  }

  // (3) Desligado tem precedência sobre saúde: a intenção do usuário é não suprimir.
  if (!enabled) {
    return { key: 'inactive', label: 'Inativo', tone: 'dim' };
  }

  // (2) Ligado, mas o autoteste reprovou → avisa e mostra o motivo, se houver.
  if (signal.health === 'unavailable') {
    const label = signal.reason ? `Indisponível — ${signal.reason}` : 'Indisponível';
    return { key: 'unavailable', label, tone: 'warn' };
  }

  // (4) Ligado, autoteste ainda inconclusivo (unknown) ou garantido-sem-hook.
  return { key: 'checking', label: 'Verificando…', tone: 'dim' };
}
