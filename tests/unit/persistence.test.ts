import { describe, it, expect } from 'vitest';
import { loadState, KEYS, type StorageArea } from '@/state/persistence';
import { defaultPrivacyConfig, SCHEMA_VERSION } from '@/shared/schemas';

function fakeStorage(initial: Record<string, unknown> = {}): StorageArea & { data: Record<string, unknown> } {
  const data = { ...initial };
  return {
    data,
    get: async (keys) => Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]])),
    set: async (items) => void Object.assign(data, items),
  };
}

describe('persistence.loadState', () => {
  it('storage vazio ⇒ default + migração grava versão atual', async () => {
    const s = fakeStorage();
    const state = await loadState(s);
    expect(state.config).toEqual(defaultPrivacyConfig());
    expect(state.rules).toEqual([]);
    expect(state.lock).toBeNull();
    expect(s.data[KEYS.version]).toBe(SCHEMA_VERSION);
  });

  it('descarta regras inválidas sem quebrar (FR-016)', async () => {
    const good = { chatId: 'A', overrides: { typing: true }, updatedAt: 1 };
    const s = fakeStorage({
      [KEYS.version]: SCHEMA_VERSION,
      [KEYS.config]: defaultPrivacyConfig(),
      [KEYS.rules]: [good, { chatId: '', overrides: {}, updatedAt: 0 }, 42, null],
    });
    const state = await loadState(s);
    expect(state.rules).toHaveLength(1);
    expect(state.rules[0]?.chatId).toBe('A');
  });

  it('config corrompida ⇒ cai no default sem lançar', async () => {
    const s = fakeStorage({ [KEYS.config]: { signals: 'nope' } });
    const state = await loadState(s);
    expect(state.config).toEqual(defaultPrivacyConfig());
  });

  it('não usa storage.sync (sem egresso) — só as chaves wt:*', async () => {
    const s = fakeStorage();
    await loadState(s);
    expect(Object.keys(s.data).every((k) => k.startsWith('wt:'))).toBe(true);
  });
});
