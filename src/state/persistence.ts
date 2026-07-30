import {
  SCHEMA_VERSION,
  defaultPrivacyConfig,
  lockConfigSchema,
  perChatRuleSchema,
  privacyConfigSchema,
  type LockConfig,
  type PerChatRule,
  type PrivacyConfig,
} from '@/shared/schemas';

export const KEYS = {
  version: 'wt:schemaVersion',
  config: 'wt:config',
  rules: 'wt:rules',
  lock: 'wt:lock',
} as const;

/** Abstração mínima sobre `chrome.storage.local` — injetável para teste. */
export interface StorageArea {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface PersistedState {
  config: PrivacyConfig;
  rules: PerChatRule[];
  lock: LockConfig | null;
}

/**
 * Lê o estado persistido de forma tolerante a falhas (FR-016):
 * valores inválidos são normalizados/descartados sem quebrar o estado.
 * Executa migração se a versão for anterior à atual.
 */
export async function loadState(storage: StorageArea): Promise<PersistedState> {
  const raw = await storage.get([KEYS.version, KEYS.config, KEYS.rules, KEYS.lock]);

  const config = privacyConfigSchema.safeParse(raw[KEYS.config]);
  const lock = lockConfigSchema.safeParse(raw[KEYS.lock]);

  const rulesInput = Array.isArray(raw[KEYS.rules]) ? (raw[KEYS.rules] as unknown[]) : [];
  const rules = rulesInput
    .map((r) => perChatRuleSchema.safeParse(r))
    .filter((res): res is { success: true; data: PerChatRule } => res.success)
    .map((res) => res.data);

  const state: PersistedState = {
    config: config.success ? config.data : defaultPrivacyConfig(),
    rules,
    lock: lock.success ? lock.data : null,
  };

  const version = typeof raw[KEYS.version] === 'number' ? (raw[KEYS.version] as number) : 0;
  if (version < SCHEMA_VERSION) {
    await migrate(storage, version, state);
  }
  return state;
}

/** Migrações idempotentes. v0→v1: apenas grava o estado normalizado + versão. */
async function migrate(storage: StorageArea, _from: number, state: PersistedState): Promise<void> {
  await storage.set({
    [KEYS.version]: SCHEMA_VERSION,
    [KEYS.config]: state.config,
    [KEYS.rules]: state.rules,
    ...(state.lock ? { [KEYS.lock]: state.lock } : {}),
  });
}

export async function saveConfig(storage: StorageArea, config: PrivacyConfig): Promise<void> {
  await storage.set({ [KEYS.version]: SCHEMA_VERSION, [KEYS.config]: config });
}

export async function saveRules(storage: StorageArea, rules: PerChatRule[]): Promise<void> {
  await storage.set({ [KEYS.rules]: rules });
}

export async function saveLock(storage: StorageArea, lock: LockConfig | null): Promise<void> {
  await storage.set({ [KEYS.lock]: lock });
}

/** StorageArea real sobre `chrome.storage.local` (sem `storage.sync` — evita egresso). */
export function chromeStorageArea(): StorageArea {
  return {
    get: (keys) => chrome.storage.local.get(keys),
    set: (items) => chrome.storage.local.set(items),
  };
}
