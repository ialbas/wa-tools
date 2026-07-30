import type { SignalModule, WAEngine } from '@/engine/signals/types';

/**
 * Módulo READ-RECEIPT (US1, FR-001/FR-002).
 *
 * Suprime a confirmação de leitura (tique azul) por-conversa. O único ponto
 * dependente do WhatsApp ao vivo é o `locateTarget` abaixo (o "seam"): tudo o
 * mais é lógica pura e testável offline com um `ns` mockado.
 *
 * `engine.ns` é o handle do WA-JS isolado (window.__WT); nunca lemos o global
 * diretamente aqui — recebê-lo por parâmetro é o que torna o módulo testável.
 */

/** Seam sobre a propriedade interna que envia o "visto": permite ler e trocar. */
type TargetSeam = {
  get(): Function | undefined;
  set(fn: Function): void;
};

/** Marca posta no wrapper para o autoteste reconhecer que é NOSSO override. */
const WRAP_FLAG = '__wt';
/** Onde o wrapper guarda o original, para o `markReadNow` liberar sob demanda. */
const WRAP_ORIGINAL = '__wtOriginal';

/** Navega `engine.ns` sem lutar contra o `unknown` do contrato em cada uso. */
function nsOf(engine: WAEngine): any {
  return (engine as { ns: any }).ns;
}

/**
 * Localiza o alvo interno de "send seen" e devolve um seam get/set sobre ele.
 *
 * // INTEGRAÇÃO AO VIVO: o caminho real do interno deve ser confirmado contra
 * // web.whatsapp.com. Em WA-JS o "enviar visto" é `Store.SendSeen.sendSeen`
 * // (também exposto sob o namespace isolado como `__WT.whatsapp.SendSeen.sendSeen`).
 * // Este seam localiza o CONTÊINER e expõe get/set sobre a propriedade `sendSeen`,
 * // permitindo trocar a função por um wrapper e restaurá-la no dispose.
 * Se o alvo não existir (WA-JS ausente ou interno renomeado por um update da Meta),
 * retorna `null` — e a falha-segura assume: `apply` não instala e `verify` reprova.
 */
function locateTarget(ns: any): TargetSeam | null {
  const container = ns?.whatsapp?.SendSeen ?? ns?.Store?.SendSeen ?? ns?.SendSeen ?? null;
  if (!container || typeof container.sendSeen !== 'function') return null;
  return {
    get: () => container.sendSeen as Function | undefined,
    set: (fn: Function) => {
      container.sendSeen = fn;
    },
  };
}

/**
 * Extrai o chatId dos argumentos do interno. O `sendSeen` recebe o modelo de
 * Chat (ou o Wid, ou o id serializado). Tolerante às três formas para não
 * quebrar caso a assinatura interna varie entre versões.
 */
function extractChatId(args: unknown[]): string | null {
  const first = args[0] as any;
  if (first == null) return null;
  if (typeof first === 'string') return first; // já é o id serializado
  const id = first.id ?? first; // Chat model → id (Wid); ou o próprio Wid
  if (typeof id === 'string') return id;
  if (id != null && typeof id._serialized === 'string') return id._serialized;
  return null;
}

/**
 * Resolve o argumento a passar ao original em `markReadNow`.
 *
 * // INTEGRAÇÃO AO VIVO: o interno real (`Store.SendSeen.sendSeen`) espera o
 * // MODELO de Chat, não a string do id. Se o store expõe `Store.Chat.get`,
 * // resolvemos o modelo real a partir do id; confirmar esse caminho contra
 * // web.whatsapp.com. Como último recurso (e para o teste offline) caímos num
 * // objeto mínimo `{ id: { _serialized } }` que os internos aceitam como id.
 */
function resolveChatArg(ns: any, chatId: string): unknown {
  const chatStore = ns?.whatsapp?.Chat ?? ns?.Store?.Chat ?? null;
  if (chatStore && typeof chatStore.get === 'function') {
    const model = chatStore.get(chatId);
    if (model != null) return model;
  }
  return { id: { _serialized: chatId } };
}

export const readReceiptModule: SignalModule = {
  kind: 'read-receipt',

  apply(engine, resolve) {
    const seam = locateTarget(nsOf(engine));
    // Falha-segura: sem alvo, não instalamos nada — o `verify` posterior reprova.
    if (!seam) return () => {};

    const original = seam.get();
    if (typeof original !== 'function') return () => {};

    const wrapper = function (this: unknown, ...args: unknown[]): unknown {
      const chatId = extractChatId(args);
      if (resolve(chatId) === true) {
        // SUPRIME: não enviamos o "visto" → sem tique azul nesta conversa (no-op).
        return undefined;
      }
      // Deixa passar: comportamento nativo do WhatsApp para as demais conversas.
      return original.apply(this, args);
    };
    (wrapper as any)[WRAP_FLAG] = true;
    (wrapper as any)[WRAP_ORIGINAL] = original;

    seam.set(wrapper);

    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      // Só restauramos se o alvo atual ainda é o NOSSO wrapper: nunca pisar num
      // rehook do WhatsApp ou de outra extensão instalada por cima.
      if (seam.get() === wrapper) seam.set(original);
    };
  },

  verify(engine) {
    const seam = locateTarget(nsOf(engine));
    if (!seam) {
      return { ok: false, reason: 'alvo send-seen não encontrado (WA-JS ausente ou interno renomeado)' };
    }
    const current = seam.get();
    if (typeof current !== 'function') {
      return { ok: false, reason: 'alvo send-seen ausente' };
    }
    if ((current as any)[WRAP_FLAG] !== true) {
      return { ok: false, reason: 'override de recibo não está instalado' };
    }
    return { ok: true };
  },
};

/**
 * FR-002 — libera o recibo (tique azul) SOB DEMANDA para uma conversa, mesmo
 * com a supressão ativa. Chama o original de "send seen" para aquele chat,
 * contornando o wrapper. Retorna `true` se conseguiu disparar o original.
 *
 * Quando o wrapper está instalado, o original real está guardado nele; sem
 * wrapper, o alvo atual já é o próprio original.
 */
export function markReadNow(engine: WAEngine, chatId: string): boolean {
  const ns = nsOf(engine);
  const seam = locateTarget(ns);
  if (!seam) return false;

  const current = seam.get();
  if (typeof current !== 'function') return false;

  const original: unknown =
    (current as any)[WRAP_FLAG] === true ? (current as any)[WRAP_ORIGINAL] : current;
  if (typeof original !== 'function') return false;

  const chatArg = resolveChatArg(ns, chatId);
  if (chatArg == null) return false;

  try {
    (original as Function).call(undefined, chatArg);
    return true;
  } catch {
    return false;
  }
}
