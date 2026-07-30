import { SIGNAL_KINDS, type SignalKind } from '@/shared/signal-kinds';
import type { PerChatRule, PrivacyConfig, SignalMap } from '@/shared/schemas';

/**
 * Resolve se um sinal deve ser suprimido em uma conversa específica.
 * Regra: override da conversa tem precedência; ausência herda o global.
 * (US1/US2/US4 — granularidade per-chat, o diferencial vs. o concorrente global.)
 */
export function effectiveSignal(
  config: PrivacyConfig,
  rule: PerChatRule | undefined,
  signal: SignalKind,
): boolean {
  const override = rule?.overrides[signal];
  return override ?? config.signals[signal];
}

/** Estado efetivo de todos os sinais para uma conversa (o que vai pro `hooks.apply`). */
export function effectiveForChat(
  config: PrivacyConfig,
  rule: PerChatRule | undefined,
): SignalMap {
  return Object.fromEntries(
    SIGNAL_KINDS.map((k) => [k, effectiveSignal(config, rule, k)]),
  ) as SignalMap;
}

/** Indexa regras por chatId, ignorando duplicatas (última vence). */
export function indexRules(rules: PerChatRule[]): Map<string, PerChatRule> {
  const map = new Map<string, PerChatRule>();
  for (const r of rules) map.set(r.chatId, r);
  return map;
}
