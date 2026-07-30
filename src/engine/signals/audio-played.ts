import type { SelfTestOutcome } from '@/state/health';
import type { SignalModule, SuppressResolver, WAEngine } from '@/engine/signals/types';

/**
 * Módulo de sinal AUDIO-PLAYED (US6).
 *
 * Suprime o recibo de "áudio ouvido" (microfone azul) das mensagens de voz:
 * o usuário reproduz o áudio localmente e o remetente NÃO recebe o indicador
 * de reprodução. Segue o padrão de um módulo por sinal — isola o ponto de
 * quebra, instala um override e expõe autoteste granular (falha-segura).
 */

/** Wrapper instalado, marcado para o autoteste reconhecê-lo. */
type WrappedFn = ((...args: unknown[]) => unknown) & { __wt?: true };

/**
 * Seam de integração ao vivo — a ÚNICA parte acoplada ao WhatsApp real.
 *
 * INTEGRAÇÃO AO VIVO: o caminho do interno que despacha o recibo "played"
 * (microfone azul de mensagens de voz ouvidas) DEVE ser confirmado contra
 * web.whatsapp.com. Alvo provável, no WA-JS isolado sob `window.__WT`: o módulo
 * Store de envio de recibos — algo como `__WT.whatsapp.SendSeenStore.sendPlayed`
 * (o interno equivalente ao usado por `WPP.chat.markIsPlayed`). A interceptação
 * limpa é no nível da função do Store, ANTES da cifragem Noise do WebSocket.
 *
 * Se o alvo não existir (a Meta mudou o interno), retorna `null` → `apply` não
 * instala nada e `verify` falha depois (nunca reportamos "garantido" sem hook).
 */
function locateTarget(
  ns: any,
): { get(): Function | undefined; set(fn: Function): void } | null {
  const store = ns?.whatsapp?.SendSeenStore;
  if (!store || typeof store.sendPlayed !== 'function') return null;
  return {
    get: (): Function | undefined => store.sendPlayed as Function | undefined,
    set: (fn: Function): void => {
      store.sendPlayed = fn;
    },
  };
}

/**
 * Extrai o chatId dos argumentos do interno para consultar o resolver por-chat.
 * Aceita as formas plausíveis do alvo ao vivo: string crua, WID serializado
 * (`{ _serialized }`) ou objeto Chat (`{ id }`, com `id` string ou WID).
 * Formato desconhecido ⇒ `null` (o resolver decide no escopo global).
 */
function extractChatId(args: readonly unknown[]): string | null {
  const first = args[0];
  if (typeof first === 'string') return first;
  if (first && typeof first === 'object') {
    const o = first as Record<string, unknown>;
    if (typeof o['_serialized'] === 'string') return o['_serialized'];
    const id = o['id'];
    if (typeof id === 'string') return id;
    if (id && typeof id === 'object') {
      const serialized = (id as Record<string, unknown>)['_serialized'];
      if (typeof serialized === 'string') return serialized;
    }
  }
  return null;
}

const KIND = 'audio-played' as const;

export const audioPlayedSignal: SignalModule = {
  kind: KIND,

  apply(engine: WAEngine, resolve: SuppressResolver): () => void {
    const seam = locateTarget(engine.ns);
    // Alvo ausente ⇒ não instala; o verify posterior falhará (falha-segura).
    if (!seam) return (): void => undefined;

    const original = seam.get();
    const wrapper: WrappedFn = function (this: unknown, ...args: unknown[]): unknown {
      const chatId = extractChatId(args);
      // Supressão on ⇒ no-op: o recibo "played" nunca é enviado.
      if (resolve(chatId)) return undefined;
      // Caso contrário, comportamento nativo intacto.
      return typeof original === 'function' ? original.apply(this, args) : undefined;
    };
    wrapper.__wt = true;
    seam.set(wrapper);

    return (): void => {
      // Restaura só se ainda formos o alvo instalado (idempotente e seguro).
      if (seam.get() === wrapper && typeof original === 'function') seam.set(original);
    };
  },

  verify(engine: WAEngine): SelfTestOutcome {
    const seam = locateTarget(engine.ns);
    if (!seam) {
      return {
        ok: false,
        reason: 'alvo interno do recibo "played" ausente (interno do WhatsApp mudou?)',
      };
    }
    const current = seam.get();
    if (typeof current === 'function' && (current as WrappedFn).__wt === true) {
      return { ok: true };
    }
    return { ok: false, reason: 'override do recibo "played" não está instalado' };
  },
};
