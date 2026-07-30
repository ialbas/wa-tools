import { describe, it, expect, vi } from 'vitest';
import type { SuppressResolver, WAEngine } from '@/engine/signals/types';
import { readReceiptModule, markReadNow } from '@/engine/signals/read-receipt';

type SendSeen = (...args: unknown[]) => unknown;

/**
 * Monta um engine com um `ns` falso cujo alvo interno (`SendSeen.sendSeen`) é
 * um spy — no mesmo caminho que o `locateTarget` do módulo sabe acessar
 * (`ns.whatsapp.SendSeen.sendSeen`). Sem argumento: `ns` sem o alvo.
 */
function makeEngine(sendSeen?: SendSeen): {
  engine: WAEngine;
  container: { sendSeen?: SendSeen } | null;
} {
  if (!sendSeen) {
    return { engine: { ns: { whatsapp: {} } }, container: null };
  }
  const container: { sendSeen?: SendSeen } = { sendSeen };
  const engine: WAEngine = { ns: { whatsapp: { SendSeen: container } } };
  return { engine, container };
}

/** Modelo de Chat mínimo, na forma que o `extractChatId` sabe ler. */
function chat(id: string): unknown {
  return { id: { _serialized: id } };
}

const suppressAll: SuppressResolver = () => true;
const suppressNone: SuppressResolver = () => false;

describe('read-receipt — supressão do tique azul por-conversa', () => {
  it('apply instala o wrapper e o autoteste passa', () => {
    const original = vi.fn();
    const { engine } = makeEngine(original);

    // antes de aplicar: alvo existe mas não é o nosso override
    expect(readReceiptModule.verify(engine)).toEqual({ ok: false, reason: expect.any(String) });

    const dispose = readReceiptModule.apply(engine, suppressAll);
    expect(readReceiptModule.verify(engine)).toEqual({ ok: true });
    dispose();
  });

  it('resolve=true SUPRIME (o original NÃO é chamado)', () => {
    const original = vi.fn();
    const { engine, container } = makeEngine(original);
    const dispose = readReceiptModule.apply(engine, (id) => id === 'a@c.us');

    container!.sendSeen!(chat('a@c.us'));

    expect(original).not.toHaveBeenCalled();
    dispose();
  });

  it('resolve=false encaminha ao original (comportamento nativo)', () => {
    const original = vi.fn();
    const { engine, container } = makeEngine(original);
    const dispose = readReceiptModule.apply(engine, suppressNone);

    const arg = chat('b@c.us');
    container!.sendSeen!(arg);

    expect(original).toHaveBeenCalledTimes(1);
    expect(original).toHaveBeenCalledWith(arg);
    dispose();
  });

  it('o mesmo hook decide por-conversa (suprime a, deixa b passar)', () => {
    const original = vi.fn();
    const { engine, container } = makeEngine(original);
    const dispose = readReceiptModule.apply(engine, (id) => id === 'a@c.us');

    container!.sendSeen!(chat('a@c.us')); // suprimido
    container!.sendSeen!(chat('b@c.us')); // liberado

    expect(original).toHaveBeenCalledTimes(1);
    expect(original).toHaveBeenCalledWith(chat('b@c.us'));
    dispose();
  });

  it('o disposer restaura o original e o autoteste volta a reprovar', () => {
    const original = vi.fn();
    const { engine, container } = makeEngine(original);
    const dispose = readReceiptModule.apply(engine, suppressAll);

    expect(container!.sendSeen).not.toBe(original); // wrapper instalado
    dispose();

    expect(container!.sendSeen).toBe(original); // original de volta
    expect(readReceiptModule.verify(engine)).toEqual({ ok: false, reason: expect.any(String) });
  });

  it('ns sem o alvo: apply não instala e verify reprova (falha-segura)', () => {
    const { engine } = makeEngine(); // sem sendSeen

    const dispose = readReceiptModule.apply(engine, suppressAll);
    const outcome = readReceiptModule.verify(engine);

    expect(outcome.ok).toBe(false);
    expect(() => dispose()).not.toThrow(); // disposer no-op é seguro
  });
});

describe('read-receipt — markReadNow (FR-002, liberar sob demanda)', () => {
  it('libera o recibo mesmo com supressão ativa (chama o original)', () => {
    const original = vi.fn();
    const { engine } = makeEngine(original);
    const dispose = readReceiptModule.apply(engine, suppressAll); // tudo suprimido

    const ok = markReadNow(engine, 'a@c.us');

    expect(ok).toBe(true);
    expect(original).toHaveBeenCalledTimes(1);
    const passed = original.mock.calls[0]?.[0] as any;
    expect(passed?.id?._serialized).toBe('a@c.us');
    dispose();
  });

  it('funciona sem wrapper instalado (chama o original diretamente)', () => {
    const original = vi.fn();
    const { engine } = makeEngine(original);

    const ok = markReadNow(engine, 'z@c.us');

    expect(ok).toBe(true);
    expect(original).toHaveBeenCalledTimes(1);
  });

  it('resolve o modelo real via Store.Chat.get quando disponível', () => {
    const original = vi.fn();
    const container: { sendSeen?: SendSeen } = { sendSeen: original };
    const model = { id: { _serialized: 'c@c.us' }, real: true };
    const engine: WAEngine = {
      ns: { whatsapp: { SendSeen: container, Chat: { get: (id: string) => (id === 'c@c.us' ? model : null) } } },
    };

    const ok = markReadNow(engine, 'c@c.us');

    expect(ok).toBe(true);
    expect(original).toHaveBeenCalledWith(model);
  });

  it('retorna false quando não há alvo', () => {
    const { engine } = makeEngine();
    expect(markReadNow(engine, 'a@c.us')).toBe(false);
  });
});
