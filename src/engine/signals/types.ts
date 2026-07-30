import type { SignalKind } from '@/shared/signal-kinds';
import type { SelfTestOutcome } from '@/state/health';

/** Handle para o WA-JS isolado (window.__WT), resolvido em runtime no MAIN world. */
export interface WAEngine {
  readonly ns: unknown; // tipado por módulo ao amarrar no interno real do WhatsApp
}

/** Resolve, por conversa, se o sinal deve ser suprimido (per-chat > global). */
export type SuppressResolver = (chatId: string | null) => boolean;

/**
 * Contrato de um módulo de sinal. Cada sinal isola seu ponto de quebra:
 *  - `apply` instala o override e devolve um disposer que restaura o original;
 *  - `verify` é o autoteste (o override está de fato ativo?).
 * A amarração em `target` depende do interno real do WhatsApp (integração ao vivo).
 */
export interface SignalModule {
  readonly kind: SignalKind;
  apply(engine: WAEngine, resolve: SuppressResolver): () => void;
  verify(engine: WAEngine): SelfTestOutcome;
}
