import type { SignalKind } from '@/shared/signal-kinds';
import type { SelfTestOutcome } from '@/state/health';
import type { SignalModule, SuppressResolver, WAEngine } from '@/engine/signals/types';

/**
 * US4 — Supressão de chat-states de saída ("digitando…" / "gravando áudio…").
 *
 * Ambos os sinais (typing/recording) quebram no MESMO interno do WhatsApp: a
 * função que envia o chat-state pela rede. A única diferença é qual método é
 * amarrado. Por isso o núcleo vive aqui (`createChatStateSignal`) e é
 * reaproveitado por `recording.ts`, mas cada arquivo exporta um `SignalModule`
 * distinto — quando a Meta quebra um interno, só aquele hook cai (falha-segura
 * por-sinal, conforme o contrato do HookRegistry).
 */

/** Assinatura de um interno do WhatsApp que emite um chat-state para uma conversa. */
type WAInternalFn = (this: unknown, ...args: unknown[]) => unknown;

/** Nosso wrapper carrega uma marca para o autoteste reconhecer o override. */
type MarkedWrapper = WAInternalFn & { __wt?: true };

/** Seam sobre o alvo interno: lê/escreve a função no objeto do WhatsApp ao vivo. */
interface ChatStateRef {
  get(): WAInternalFn | undefined;
  set(fn: WAInternalFn): void;
}

/** Forma mínima do handle WA-JS (window.__WT) que o seam precisa enxergar. */
type ChatStateNamespace = {
  Store?: { ChatState?: Record<string, unknown> };
};

/**
 * Extrai o chatId do primeiro argumento do interno de chat-state.
 * O interno recebe o modelo de conversa (`chat`) cujo id é um Wid; aceitamos
 * também um id já serializado (string) ou um Wid nu, para resistir a variações
 * do WhatsApp sem quebrar a supressão.
 */
function extractChatId(args: readonly unknown[]): string | null {
  const first = args[0];
  if (typeof first === 'string') return first;
  if (first && typeof first === 'object') {
    const o = first as { id?: unknown; _serialized?: unknown };
    if (o.id && typeof o.id === 'object') {
      const wid = o.id as { _serialized?: unknown };
      if (typeof wid._serialized === 'string') return wid._serialized;
    }
    if (typeof o.id === 'string') return o.id;
    if (typeof o._serialized === 'string') return o._serialized;
  }
  return null;
}

/**
 * Fábrica do módulo de chat-state. `method` é o nome do interno a amarrar.
 *
 * INTEGRAÇÃO AO VIVO: o caminho real do interno deve ser confirmado contra
 * web.whatsapp.com. Alvo provável = o módulo de chat-state do Store exposto
 * pelo WA-JS em `__WT.Store.ChatState`, com os métodos de envio
 * `sendChatStateComposing` (typing) e `sendChatStateRecording` (recording).
 * Se o alvo não existir, `locateTarget` retorna `null` e o hook fica
 * indisponível (o `verify` falha) — nunca fingimos supressão que não existe.
 */
export function createChatStateSignal(kind: SignalKind, method: string): SignalModule {
  /** A ÚNICA parte dependente do WhatsApp ao vivo. */
  function locateTarget(ns: unknown): ChatStateRef | null {
    // INTEGRAÇÃO AO VIVO: `__WT.Store.ChatState[method]` — confirmar contra web.whatsapp.com.
    const container = (ns as ChatStateNamespace | null | undefined)?.Store?.ChatState;
    if (!container || typeof container[method] !== 'function') return null;
    return {
      get: () => container[method] as WAInternalFn | undefined,
      set: (fn: WAInternalFn) => {
        container[method] = fn;
      },
    };
  }

  return {
    kind,

    apply(engine: WAEngine, resolve: SuppressResolver): () => void {
      const ref = locateTarget(engine.ns);
      // Alvo ausente ⇒ não instala nada; o `verify` posterior falhará (falha-segura).
      if (!ref) return () => {};

      const original = ref.get();
      if (!original) return () => {};

      const wrapper: MarkedWrapper = function (this: unknown, ...args: unknown[]): unknown {
        const chatId = extractChatId(args);
        // Suprime a conversa marcada: no-op (não chama o original, nada vai à rede).
        if (resolve(chatId)) return undefined;
        return original.apply(this, args);
      };
      wrapper.__wt = true;

      ref.set(wrapper);

      // Disposer: restaura o original — mas só se ainda formos o alvo instalado,
      // para não pisar num override mais novo (ex.: reaplicação concorrente).
      return () => {
        if (ref.get() === wrapper) ref.set(original);
      };
    },

    verify(engine: WAEngine): SelfTestOutcome {
      const ref = locateTarget(engine.ns);
      if (!ref) {
        return { ok: false, reason: `alvo interno de chat-state (${method}) não encontrado` };
      }
      const current = ref.get();
      if (typeof current === 'function' && (current as MarkedWrapper).__wt === true) {
        return { ok: true };
      }
      return { ok: false, reason: `override de chat-state (${method}) não está instalado` };
    },
  };
}

/** Suprime "digitando…" (chat-state composing). */
export const typingSignal: SignalModule = createChatStateSignal('typing', 'sendChatStateComposing');
