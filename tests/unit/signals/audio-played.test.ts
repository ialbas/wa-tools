import { describe, expect, it, vi } from 'vitest';
import type { SuppressResolver, WAEngine } from '@/engine/signals/types';
import { audioPlayedSignal } from '@/engine/signals/audio-played';

// chatId de teste no formato WID serializado que o extractChatId sabe ler.
const CHAT_ID = '5511999999999@c.us';
const chatArg = { id: { _serialized: CHAT_ID } } as const;

type SendPlayed = (...args: unknown[]) => unknown;

/**
 * Monta um `ns` falso do WA-JS (window.__WT) com o alvo interno como spy,
 * exatamente no caminho que o `locateTarget` do módulo sabe acessar.
 */
function makeEngine(sendPlayed?: SendPlayed): {
  engine: WAEngine;
  store: { sendPlayed?: SendPlayed };
} {
  const store: { sendPlayed?: SendPlayed } = {};
  if (sendPlayed) store.sendPlayed = sendPlayed;
  const engine: WAEngine = { ns: { whatsapp: { SendSeenStore: store } } };
  return { engine, store };
}

const always = (v: boolean): SuppressResolver => (): boolean => v;

describe('audioPlayedSignal', () => {
  it('declara o kind "audio-played"', () => {
    expect(audioPlayedSignal.kind).toBe('audio-played');
  });

  it('(1) apply instala o wrapper e verify passa (ok:true)', () => {
    const original = vi.fn();
    const { engine, store } = makeEngine(original);

    // Antes de instalar: alvo existe mas não é nosso wrapper ⇒ falha.
    expect(audioPlayedSignal.verify(engine)).toEqual({
      ok: false,
      reason: expect.any(String),
    });

    const dispose = audioPlayedSignal.apply(engine, always(false));

    expect(store.sendPlayed).not.toBe(original); // substituído pelo wrapper
    expect(audioPlayedSignal.verify(engine)).toEqual({ ok: true });

    dispose();
  });

  it('(2) resolve=true SUPRIME: o interno original NÃO é chamado (no-op)', () => {
    const original = vi.fn(() => 'PLAYED_SENT');
    const { engine, store } = makeEngine(original);

    audioPlayedSignal.apply(engine, always(true));
    const ret = store.sendPlayed!(chatArg);

    expect(original).not.toHaveBeenCalled();
    expect(ret).toBeUndefined();
  });

  it('(3) resolve=false deixa passar: o original É chamado com os mesmos args e o retorno passa através', () => {
    const original = vi.fn(() => 'PLAYED_SENT');
    const { engine, store } = makeEngine(original);

    const resolve = vi.fn((_chatId: string | null): boolean => false);
    audioPlayedSignal.apply(engine, resolve);

    const ret = store.sendPlayed!(chatArg, 'msgKeys');

    expect(original).toHaveBeenCalledTimes(1);
    expect(original).toHaveBeenCalledWith(chatArg, 'msgKeys');
    expect(ret).toBe('PLAYED_SENT');
    // O chatId foi extraído dos argumentos e passado ao resolver.
    expect(resolve).toHaveBeenCalledWith(CHAT_ID);
  });

  it('(4) disposer restaura o interno original (verify volta a falhar)', () => {
    const original = vi.fn(() => 'PLAYED_SENT');
    const { engine, store } = makeEngine(original);

    const dispose = audioPlayedSignal.apply(engine, always(true));
    expect(store.sendPlayed).not.toBe(original);

    dispose();

    expect(store.sendPlayed).toBe(original); // original de volta

    // Com o original restaurado, a supressão não age mais.
    store.sendPlayed!(chatArg);
    expect(original).toHaveBeenCalledTimes(1);

    expect(audioPlayedSignal.verify(engine).ok).toBe(false);
  });

  it('(5) ns sem o alvo interno: apply não instala e verify falha (falha-segura)', () => {
    const engine: WAEngine = { ns: { whatsapp: { SendSeenStore: {} } } };

    const dispose = audioPlayedSignal.apply(engine, always(true));
    expect(typeof dispose).toBe('function');
    expect(() => dispose()).not.toThrow(); // disposer no-op é seguro

    const outcome = audioPlayedSignal.verify(engine);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toEqual(expect.any(String));
  });

  it('(5b) ns totalmente vazio: verify falha sem lançar', () => {
    const engine: WAEngine = { ns: {} };
    expect(() => audioPlayedSignal.verify(engine)).not.toThrow();
    expect(audioPlayedSignal.verify(engine).ok).toBe(false);
  });
});
