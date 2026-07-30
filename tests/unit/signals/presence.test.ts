import { describe, it, expect, vi } from 'vitest';
import type { WAEngine } from '@/engine/signals/types';
import { presenceSignal } from '@/engine/signals/presence';

/**
 * Engine mockado, 100% offline. O seam `locateTarget` navega
 * `ns.Store.PresenceSend.sendPresenceAvailable`; aqui montamos exatamente esse
 * caminho, com o interno como um spy, para exercitar o wrapper sem WhatsApp ao vivo.
 */
function makeEngine(internal?: (...args: unknown[]) => unknown) {
  const host = internal ? { sendPresenceAvailable: internal } : undefined;
  const ns = host ? { Store: { PresenceSend: host } } : { Store: {} };
  return { engine: { ns } as WAEngine, host };
}

/** Chama o alvo (já com o override instalado) através do namespace. */
function callTarget(engine: WAEngine, ...args: unknown[]): unknown {
  const fn = (engine.ns as any).Store.PresenceSend.sendPresenceAvailable as (
    ...a: unknown[]
  ) => unknown;
  return fn(...args);
}

const SUPPRESS_ALL = () => true;

describe('sinal de presença (modo invisível)', () => {
  it('apply instala o wrapper e verify aprova', () => {
    const { engine } = makeEngine(vi.fn());
    const dispose = presenceSignal.apply(engine, SUPPRESS_ALL);
    try {
      expect(presenceSignal.verify(engine)).toEqual({ ok: true });
    } finally {
      dispose();
    }
  });

  it('resolve=true ⇒ SUPRIME (o original não é chamado)', () => {
    const original = vi.fn();
    const { engine } = makeEngine(original);
    const dispose = presenceSignal.apply(engine, SUPPRESS_ALL);
    try {
      const ret = callTarget(engine, '5511999999999@c.us');
      expect(original).not.toHaveBeenCalled();
      expect(ret).toBeUndefined();
    } finally {
      dispose();
    }
  });

  it('resolve=false ⇒ o original É chamado, com os mesmos argumentos', () => {
    const original = vi.fn(() => 'ok');
    const { engine } = makeEngine(original);
    const dispose = presenceSignal.apply(engine, () => false);
    try {
      const ret = callTarget(engine, '5511888888888@c.us');
      expect(original).toHaveBeenCalledTimes(1);
      expect(original).toHaveBeenCalledWith('5511888888888@c.us');
      expect(ret).toBe('ok');
    } finally {
      dispose();
    }
  });

  it('presença global (sem chatId nos args) consulta resolve(null)', () => {
    const original = vi.fn();
    const { engine } = makeEngine(original);
    const seen: (string | null)[] = [];
    const resolve = (chatId: string | null) => {
      seen.push(chatId);
      return true;
    };
    const dispose = presenceSignal.apply(engine, resolve);
    try {
      callTarget(engine); // envio global: nenhum argumento
      expect(seen).toEqual([null]);
      expect(original).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });

  it('escopo por-contato: suprime só o contato alvo, os demais passam', () => {
    const original = vi.fn();
    const { engine } = makeEngine(original);
    const BLOCKED = 'blocked@c.us';
    const dispose = presenceSignal.apply(engine, (chatId) => chatId === BLOCKED);
    try {
      callTarget(engine, BLOCKED); // suprimido
      callTarget(engine, 'allowed@c.us'); // passa
      expect(original).toHaveBeenCalledTimes(1);
      expect(original).toHaveBeenCalledWith('allowed@c.us');
    } finally {
      dispose();
    }
  });

  it('extrai chatId da forma wid { id: { _serialized } } (integração ao vivo)', () => {
    const original = vi.fn();
    const { engine } = makeEngine(original);
    const seen: (string | null)[] = [];
    const dispose = presenceSignal.apply(engine, (chatId) => {
      seen.push(chatId);
      return true;
    });
    try {
      callTarget(engine, { id: { _serialized: 'wid@c.us' } });
      expect(seen).toEqual(['wid@c.us']);
      expect(original).not.toHaveBeenCalled();
    } finally {
      dispose();
    }
  });

  it('disposer restaura o original (verify reprova e o interno volta a ser chamado)', () => {
    const original = vi.fn();
    const { engine, host } = makeEngine(original);
    const dispose = presenceSignal.apply(engine, SUPPRESS_ALL);

    // instalado: o alvo é o nosso wrapper, não o original
    expect(host?.sendPresenceAvailable).not.toBe(original);

    dispose();

    // restaurado: alvo original de volta e autoteste reprova
    expect(host?.sendPresenceAvailable).toBe(original);
    expect(presenceSignal.verify(engine)).toEqual({
      ok: false,
      reason: expect.any(String),
    });
    callTarget(engine, 'again@c.us');
    expect(original).toHaveBeenCalledTimes(1);
  });

  it('ns sem o alvo ⇒ apply não instala e verify reprova (falha-segura)', () => {
    const { engine } = makeEngine(); // Store.PresenceSend ausente
    const dispose = presenceSignal.apply(engine, SUPPRESS_ALL);
    expect(presenceSignal.verify(engine)).toEqual({
      ok: false,
      reason: expect.any(String),
    });
    expect(() => dispose()).not.toThrow(); // disposer no-op é seguro
  });
});
