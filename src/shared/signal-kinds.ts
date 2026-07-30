/**
 * Os sinais de saída que o usuário emite no WhatsApp Web e que podemos suprimir.
 * Fonte da verdade única — usada por schemas, engine, state e UI.
 */
export const SIGNAL_KINDS = [
  'read-receipt', // tique azul
  'presence', // online + visto por último (modo invisível)
  'typing', // "digitando…"
  'recording', // "gravando áudio…"
  'audio-played', // microfone azul
] as const;

export type SignalKind = (typeof SIGNAL_KINDS)[number];

export function isSignalKind(value: unknown): value is SignalKind {
  return typeof value === 'string' && (SIGNAL_KINDS as readonly string[]).includes(value);
}
