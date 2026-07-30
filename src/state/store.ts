import { createStore } from 'zustand/vanilla';
import { SIGNAL_KINDS, type SignalKind } from '@/shared/signal-kinds';
import {
  defaultPrivacyConfig,
  type PerChatRule,
  type PrivacyConfig,
  type SignalMap,
} from '@/shared/schemas';
import {
  applySelfTest,
  initialSignal,
  requiresFailSafeAlert,
  type SelfTestOutcome,
  type SuppressibleSignal,
} from './health';
import { effectiveForChat, indexRules } from './effective';

export interface WTState {
  config: PrivacyConfig;
  rules: Map<string, PerChatRule>;
  signals: Record<SignalKind, SuppressibleSignal>;

  setGlobalSignal(kind: SignalKind, enabled: boolean): void;
  /** enabled boolean sobrescreve; 'inherit' remove o override (herda global). */
  setPerChatSignal(chatId: string, kind: SignalKind, value: boolean | 'inherit', now: number): void;
  /** Aplica resultado de autoteste; retorna se deve disparar aviso de falha-segura. */
  applySelfTestResult(kind: SignalKind, outcome: SelfTestOutcome, now: number): { alert: boolean };
  /** Estado efetivo (per-chat > global) para o hooks.apply. */
  effective(chatId: string | null): SignalMap;
}

function initialSignals(now: number): Record<SignalKind, SuppressibleSignal> {
  return Object.fromEntries(SIGNAL_KINDS.map((k) => [k, initialSignal(k, now)])) as Record<
    SignalKind,
    SuppressibleSignal
  >;
}

export function createWTStore(init?: Partial<Pick<WTState, 'config' | 'rules'>>, now = 0) {
  return createStore<WTState>((set, get) => ({
    config: init?.config ?? defaultPrivacyConfig(),
    rules: init?.rules ?? new Map(),
    signals: initialSignals(now),

    setGlobalSignal(kind, enabled) {
      set((s) => ({ config: { ...s.config, signals: { ...s.config.signals, [kind]: enabled } } }));
    },

    setPerChatSignal(chatId, kind, value, now) {
      set((s) => {
        const rules = new Map(s.rules);
        const existing = rules.get(chatId);
        const overrides = { ...(existing?.overrides ?? {}) };
        if (value === 'inherit') delete overrides[kind];
        else overrides[kind] = value;

        if (Object.keys(overrides).length === 0) rules.delete(chatId);
        else rules.set(chatId, { chatId, overrides, updatedAt: now });
        return { rules };
      });
    },

    applySelfTestResult(kind, outcome, now) {
      const prev = get().signals[kind];
      const next = applySelfTest(prev, outcome, now);
      const alert = requiresFailSafeAlert(prev, next);
      set((s) => ({ signals: { ...s.signals, [kind]: next } }));
      return { alert };
    },

    effective(chatId) {
      const s = get();
      const rule = chatId ? s.rules.get(chatId) : undefined;
      return effectiveForChat(s.config, rule);
    },
  }));
}

/** Reconstrói o Map de regras a partir do array persistido. */
export function rulesFromArray(rules: PerChatRule[]): Map<string, PerChatRule> {
  return indexRules(rules);
}
