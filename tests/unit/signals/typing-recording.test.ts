import { describe, it, expect, vi } from 'vitest';
import type { WAEngine } from '@/engine/signals/types';
import { typingSignal } from '@/engine/signals/typing';
import { recordingSignal } from '@/engine/signals/recording';

/**
 * Autoteste offline dos dois módulos de chat-state (US4). O engine é MOCKADO:
 * um `ns` falso expõe o interno como um spy em `Store.ChatState[method]`, que é
 * exatamente o caminho que o seam `locateTarget` sabe acessar. Nenhum contato
 * com o WhatsApp ao vivo.
 */

// Espelha o `method` que cada módulo amarra (parte da amarração ao interno).
const cases = [
  { name: 'typing', mod: typingSignal, kind: 'typing', method: 'sendChatStateComposing' },
  { name: 'recording', mod: recordingSignal, kind: 'recording', method: 'sendChatStateRecording' },
] as const;

// Argumento do interno compatível com como `extractChatId` lê (chat.id._serialized).
const chat = { id: { _serialized: 'chat-1@c.us' } };

function makeEngine(method: string) {
  const original = vi.fn(() => 'sent');
  const chatState: Record<string, unknown> = { [method]: original };
  const engine: WAEngine = { ns: { Store: { ChatState: chatState } } };
  const target = () => chatState[method] as (...args: unknown[]) => unknown;
  return { engine, chatState, original, target };
}

describe.each(cases)('chat-state signal · $name', ({ mod, kind, method }) => {
  it(`expõe kind '${kind}'`, () => {
    expect(mod.kind).toBe(kind);
  });

  it('apply instala o wrapper e verify passa', () => {
    const { engine, original, target } = makeEngine(method);
    expect(mod.verify(engine).ok).toBe(false); // ainda não instalado

    const dispose = mod.apply(engine, () => false);
    expect(target()).not.toBe(original); // alvo foi substituído
    expect(mod.verify(engine)).toEqual({ ok: true });

    dispose();
  });

  it('resolve=true SUPRIME (o original não é chamado)', () => {
    const { engine, original, target } = makeEngine(method);
    const dispose = mod.apply(engine, () => true);

    const result = target()(chat);

    expect(original).not.toHaveBeenCalled();
    expect(result).toBeUndefined(); // no-op
    dispose();
  });

  it('resolve=false chama o original (com args e retorno preservados)', () => {
    const { engine, original, target } = makeEngine(method);
    const dispose = mod.apply(engine, () => false);

    const result = target()(chat);

    expect(original).toHaveBeenCalledOnce();
    expect(original).toHaveBeenCalledWith(chat);
    expect(result).toBe('sent');
    dispose();
  });

  it('resolve por-conversa: suprime a conversa marcada, deixa passar as demais', () => {
    const { engine, original, target } = makeEngine(method);
    const dispose = mod.apply(engine, (id) => id === 'chat-1@c.us');

    target()(chat); // suprimida
    target()({ id: { _serialized: 'outra@c.us' } }); // liberada

    expect(original).toHaveBeenCalledOnce();
    expect(original).toHaveBeenCalledWith({ id: { _serialized: 'outra@c.us' } });
    dispose();
  });

  it('disposer restaura o original e verify volta a falhar', () => {
    const { engine, original, target } = makeEngine(method);
    const dispose = mod.apply(engine, () => true);
    expect(mod.verify(engine).ok).toBe(true);

    dispose();

    expect(target()).toBe(original);
    expect(mod.verify(engine).ok).toBe(false);

    // Original de volta no lugar: chamadas passam direto, sem supressão.
    target()(chat);
    expect(original).toHaveBeenCalledOnce();
  });

  it('alvo ausente no ns ⇒ apply não instala e verify falha (falha-segura)', () => {
    const engine: WAEngine = { ns: { Store: { ChatState: {} } } };

    const dispose = mod.apply(engine, () => true);
    const outcome = mod.verify(engine);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toMatch(/não encontrado/);
    expect(() => dispose()).not.toThrow(); // disposer no-op é seguro
  });
});
