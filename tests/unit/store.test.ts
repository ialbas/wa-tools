import { describe, it, expect } from 'vitest';
import { createWTStore } from '@/state/store';

describe('WTStore', () => {
  it('setGlobalSignal reflete no efetivo sem regra', () => {
    const store = createWTStore();
    store.getState().setGlobalSignal('read-receipt', true);
    expect(store.getState().effective(null)['read-receipt']).toBe(true);
  });

  it('override per-chat vence o global; inherit remove a regra', () => {
    const store = createWTStore();
    store.getState().setGlobalSignal('read-receipt', true);
    store.getState().setPerChatSignal('A', 'read-receipt', false, 1);
    expect(store.getState().effective('A')['read-receipt']).toBe(false);
    expect(store.getState().rules.has('A')).toBe(true);

    store.getState().setPerChatSignal('A', 'read-receipt', 'inherit', 2);
    expect(store.getState().effective('A')['read-receipt']).toBe(true); // volta ao global
    expect(store.getState().rules.has('A')).toBe(false); // regra vazia removida
  });

  it('chats divergentes simultâneos (SC-002)', () => {
    const store = createWTStore();
    store.getState().setPerChatSignal('A', 'typing', true, 1);
    store.getState().setPerChatSignal('B', 'typing', false, 1);
    expect(store.getState().effective('A').typing).toBe(true);
    expect(store.getState().effective('B').typing).toBe(false);
  });

  it('autoteste falho vira unavailable e sinaliza aviso; recuperação não realerta', () => {
    const store = createWTStore();
    store.getState().applySelfTestResult('presence', { ok: true }, 1);
    const down = store.getState().applySelfTestResult('presence', { ok: false, reason: 'x' }, 2);
    expect(down.alert).toBe(true);
    expect(store.getState().signals.presence.health).toBe('unavailable');
    const stay = store.getState().applySelfTestResult('presence', { ok: false, reason: 'y' }, 3);
    expect(stay.alert).toBe(false);
    const up = store.getState().applySelfTestResult('presence', { ok: true }, 4);
    expect(up.alert).toBe(false);
    expect(store.getState().signals.presence.health).toBe('guaranteed');
  });
});
