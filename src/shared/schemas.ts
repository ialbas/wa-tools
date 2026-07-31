import { z } from 'zod';
import { SIGNAL_KINDS } from './signal-kinds';

/** Schema version — bump ao mudar a forma persistida (dispara migração). */
export const SCHEMA_VERSION = 1;

const signalKindSchema = z.enum(SIGNAL_KINDS);

const signalMapSchema = z.object(
  Object.fromEntries(SIGNAL_KINDS.map((k) => [k, z.boolean()])) as Record<
    (typeof SIGNAL_KINDS)[number],
    z.ZodBoolean
  >,
);

export const privacyScreenConfigSchema = z.object({
  // Granular (por categoria) — controle fino, seletores por elemento.
  blurNames: z.boolean(),
  blurPhotos: z.boolean(),
  blurRecent: z.boolean(),
  blurConversation: z.boolean(),
  blurComposer: z.boolean(),
  // Blindado (por região) — borra o container inteiro; imune ao churn do DOM interno.
  shieldList: z.boolean(),
  shieldChat: z.boolean(),
  revealOnHover: z.boolean(),
});

export const lockConfigSchema = z.object({
  enabled: z.boolean(),
  passHash: z.string(),
  salt: z.string(),
  iterations: z.number().int().positive(),
});

export const privacyConfigSchema = z.object({
  signals: signalMapSchema,
  presenceScope: z.enum(['all', 'per-contact']),
  privacyScreen: privacyScreenConfigSchema,
  optionalStatusViewing: z.boolean(),
});

export const perChatRuleSchema = z.object({
  chatId: z.string().min(1),
  overrides: z.record(signalKindSchema, z.boolean()),
  updatedAt: z.number(),
});

export type SignalMap = z.infer<typeof signalMapSchema>;
export type PrivacyScreenConfig = z.infer<typeof privacyScreenConfigSchema>;
export type LockConfig = z.infer<typeof lockConfigSchema>;
export type PrivacyConfig = z.infer<typeof privacyConfigSchema>;
export type PerChatRule = z.infer<typeof perChatRuleSchema>;

/** Configuração global padrão — tudo desligado (opt-in explícito), local, anônimo. */
export function defaultPrivacyConfig(): PrivacyConfig {
  return {
    signals: Object.fromEntries(SIGNAL_KINDS.map((k) => [k, false])) as SignalMap,
    presenceScope: 'all',
    privacyScreen: {
      blurNames: false,
      blurPhotos: false,
      blurRecent: false,
      blurConversation: false,
      blurComposer: false,
      shieldList: false,
      shieldChat: false,
      revealOnHover: true,
    },
    optionalStatusViewing: false,
  };
}
