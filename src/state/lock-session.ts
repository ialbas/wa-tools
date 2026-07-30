import type { LockConfig } from '@/shared/schemas';
import type { LockSession } from '@/privacy-screen/lock';
import {
  verifyPasscode,
  registerFailure,
  registerSuccess,
  isLockedOut,
  initialLockSession,
  backoffMs,
  MAX_ATTEMPTS,
} from '@/privacy-screen/lock';

/**
 * Uma tentativa de destravar a sessão (US5).
 *
 * Lógica pura e determinística sobre `@/privacy-screen/lock` — sem efeitos,
 * sem tocar o relógio (o chamador injeta `now`):
 *   - Durante um lockout ativo a tentativa é IGNORADA (fail-closed): a mesma
 *     sessão é retornada sem sequer derivar o hash da senha, o que impede
 *     brute-force contornar o backoff e evita trabalho de PBKDF2 à toa.
 *   - Fora do lockout, a senha é verificada em tempo constante:
 *       acerto  → `registerSuccess()`  (destranca, zera contadores)
 *       erro    → `registerFailure()`  (incrementa e, no limite, agenda backoff)
 */
export async function attemptUnlock(
  session: LockSession,
  passcode: string,
  config: LockConfig,
  now: number,
): Promise<LockSession> {
  if (isLockedOut(session, now)) return session;
  const ok = await verifyPasscode(passcode, config);
  return ok ? registerSuccess() : registerFailure(session, now);
}

// Re-exports convenientes para consumidores da camada de estado (ex.: a UI),
// evitando que precisem importar de dois módulos distintos.
export type { LockSession, LockConfig };
export {
  initialLockSession,
  isLockedOut,
  registerFailure,
  registerSuccess,
  backoffMs,
  MAX_ATTEMPTS,
};
