import type { SignalModule, SuppressResolver, WAEngine } from '@/engine/signals/types';
import type { SelfTestOutcome } from '@/state/health';

/**
 * US2 — Modo invisível (kind: 'presence').
 *
 * Suprime a presença "online" e a atualização de "visto por último" interceptando
 * o envio de presença "available". Enquanto a supressão vale, o WhatsApp nunca
 * emite `available` ⇒ o observador vê o usuário offline e com "visto por último"
 * congelado; o usuário continua vendo o estado alheio a partir do estado recebido
 * (só o envio de saída é bloqueado).
 *
 * Escopo (global ou por-contato) já vem resolvido em `resolve(chatId)`: o módulo
 * apenas respeita a decisão. A presença "available" é, na prática, global (sem
 * chatId nos argumentos) ⇒ nesse caso consultamos `resolve(null)`.
 *
 * Testável offline: a ÚNICA dependência do WhatsApp ao vivo é `locateTarget`,
 * o seam que localiza o interno. Todo o resto (wrapper, extração de chatId,
 * autoteste) é puro e determinístico.
 */

/** Chave do método interno de envio da presença "available" no host localizado. */
const PRESENCE_FN_KEY = 'sendPresenceAvailable';

/** Marca do wrapper instalado — o autoteste a usa para reconhecer o override. */
const WRAPPER_MARK = '__wt' as const;

/** Acessor sobre o alvo interno: lê o valor atual e o substitui in-place. */
interface TargetRef {
  get(): Function | undefined;
  set(fn: Function): void;
}

/**
 * Seam de integração ao vivo. Devolve um acessor get/set para o interno de
 * presença "available", ou `null` se o alvo não existir (falha-segura: sem alvo,
 * `apply` não instala nada e o `verify` posterior reprova).
 *
 * // INTEGRAÇÃO AO VIVO: o caminho real do interno precisa ser confirmado contra
 * // web.whatsapp.com. Referência provável (via WA-JS isolado em window.__WT):
 * //   ns.Store.PresenceSend.sendPresenceAvailable
 * // equivalente ao módulo interno WAWebSendPresenceModule.sendPresenceAvailable,
 * // que dispara a presença "available" — origem do "online" e da atualização de
 * // "visto por último". Suprimi-lo ⇒ modo invisível.
 */
function locateTarget(ns: any): TargetRef | null {
  const host = ns?.Store?.PresenceSend as Record<string, unknown> | undefined;
  if (!host || typeof host[PRESENCE_FN_KEY] !== 'function') return null;
  return {
    get: () => {
      const current = host[PRESENCE_FN_KEY];
      return typeof current === 'function' ? (current as Function) : undefined;
    },
    set: (fn: Function) => {
      host[PRESENCE_FN_KEY] = fn;
    },
  };
}

/**
 * Extrai o chatId dos argumentos da chamada de presença. A presença "available"
 * é global (sem alvo) ⇒ retorna `null`, e o wrapper consulta `resolve(null)`.
 * Também aceita a forma por-conversa (string ou wid `{ id: { _serialized } }`),
 * caso o interno amarrado carregue um destino — mantendo o escopo por-contato.
 */
function extractChatId(args: readonly unknown[]): string | null {
  const first = args[0];
  if (typeof first === 'string') return first;
  if (first && typeof first === 'object') {
    const obj = first as Record<string, unknown>;
    if (typeof obj._serialized === 'string') return obj._serialized;
    const id = obj.id ?? obj.wid ?? obj.chatId;
    if (typeof id === 'string') return id;
    if (id && typeof id === 'object') {
      const serialized = (id as Record<string, unknown>)._serialized;
      if (typeof serialized === 'string') return serialized;
    }
  }
  return null;
}

function isWrapper(fn: Function | undefined): boolean {
  return (
    typeof fn === 'function' &&
    (fn as unknown as Record<string, unknown>)[WRAPPER_MARK] === true
  );
}

export const presenceSignal: SignalModule = {
  kind: 'presence',

  apply(engine: WAEngine, resolve: SuppressResolver): () => void {
    const ref = locateTarget(engine.ns);
    if (!ref) return () => {}; // sem alvo ⇒ não instala; verify reprova (falha-segura)

    const original = ref.get();
    if (typeof original !== 'function') return () => {};

    const wrapper = function (this: unknown, ...args: unknown[]): unknown {
      const chatId = extractChatId(args);
      if (resolve(chatId)) return undefined; // SUPRIME: não emite "available" (no-op)
      return original.apply(this, args);
    };
    (wrapper as unknown as Record<string, unknown>)[WRAPPER_MARK] = true;
    ref.set(wrapper);

    // Disposer: restaura o original — mas só se o alvo ainda for o NOSSO wrapper,
    // para não pisar sobre um override instalado por cima depois.
    return () => {
      if (ref.get() === wrapper) ref.set(original);
    };
  },

  verify(engine: WAEngine): SelfTestOutcome {
    const ref = locateTarget(engine.ns);
    if (!ref) return { ok: false, reason: 'alvo interno de presença ("available") ausente' };
    if (!isWrapper(ref.get())) return { ok: false, reason: 'override de presença não instalado' };
    return { ok: true };
  },
};
