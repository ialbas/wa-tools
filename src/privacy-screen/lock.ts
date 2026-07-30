import type { LockConfig } from '@/shared/schemas';

const ITERATIONS = 210_000; // PBKDF2-HMAC-SHA256 (OWASP 2023+)
const SALT_BYTES = 16;
const KEY_BITS = 256;
export const MAX_ATTEMPTS = 5;

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function derive(passcode: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passcode),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    KEY_BITS,
  );
  return toHex(bits);
}

/** Cria a config de bloqueio a partir de uma senha — só o hash é persistido. */
export async function createLockConfig(passcode: string): Promise<LockConfig> {
  if (passcode.length < 4) throw new Error('passcode too short');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const passHash = await derive(passcode, salt, ITERATIONS);
  return { enabled: true, passHash, salt: toHex(salt.buffer), iterations: ITERATIONS };
}

/** Comparação em tempo constante (evita timing side-channel). */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPasscode(passcode: string, config: LockConfig): Promise<boolean> {
  const hash = await derive(passcode, fromHex(config.salt), config.iterations);
  return constantTimeEqual(hash, config.passHash);
}

export interface LockSession {
  locked: boolean;
  failedAttempts: number;
  lockoutUntil: number | null;
}

export function initialLockSession(enabled: boolean): LockSession {
  return { locked: enabled, failedAttempts: 0, lockoutUntil: null };
}

/** Backoff exponencial após MAX_ATTEMPTS falhas: 30s, 60s, 120s, … (cap 15min). */
export function backoffMs(failedAttempts: number): number {
  if (failedAttempts < MAX_ATTEMPTS) return 0;
  const over = failedAttempts - MAX_ATTEMPTS;
  return Math.min(30_000 * 2 ** over, 15 * 60_000);
}

export function isLockedOut(session: LockSession, now: number): boolean {
  return session.lockoutUntil !== null && now < session.lockoutUntil;
}

export function registerFailure(session: LockSession, now: number): LockSession {
  const failedAttempts = session.failedAttempts + 1;
  const backoff = backoffMs(failedAttempts);
  return {
    ...session,
    failedAttempts,
    lockoutUntil: backoff > 0 ? now + backoff : session.lockoutUntil,
  };
}

export function registerSuccess(): LockSession {
  return { locked: false, failedAttempts: 0, lockoutUntil: null };
}
