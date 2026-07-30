import { describe, it, expect } from 'vitest';
import { createLockConfig } from '@/privacy-screen/lock';
import {
  attemptUnlock,
  initialLockSession,
  registerFailure,
  isLockedOut,
  MAX_ATTEMPTS,
} from '@/state/lock-session';

describe('attemptUnlock (US5)', () => {
  it('senha correta destranca e zera os contadores', async () => {
    const config = await createLockConfig('correct-horse');
    const start = initialLockSession(true);

    const next = await attemptUnlock(start, 'correct-horse', config, 1_000);

    expect(next.locked).toBe(false);
    expect(next.failedAttempts).toBe(0);
    expect(next.lockoutUntil).toBeNull();
  });

  it('senha errada incrementa failedAttempts e mantém trancado', async () => {
    const config = await createLockConfig('correct-horse');
    const start = initialLockSession(true);

    const next = await attemptUnlock(start, 'nope', config, 1_000);

    expect(next.locked).toBe(true);
    expect(next.failedAttempts).toBe(1);

    // Uma segunda falha continua acumulando.
    const again = await attemptUnlock(next, 'still-wrong', config, 2_000);
    expect(again.failedAttempts).toBe(2);
  });

  it('durante o lockout a tentativa é ignorada — nem a senha certa passa', async () => {
    const config = await createLockConfig('correct-horse');

    // Constrói o lockout de forma pura (sem PBKDF2) até estourar MAX_ATTEMPTS.
    let session = initialLockSession(true);
    for (let i = 0; i < MAX_ATTEMPTS; i++) session = registerFailure(session, 1_000);
    expect(isLockedOut(session, 1_000)).toBe(true);

    // Mesmo com a senha correta, dentro da janela nada muda (fail-closed):
    // a mesma referência de sessão é retornada, sem derivar hash.
    const blocked = await attemptUnlock(session, 'correct-horse', config, 1_500);
    expect(blocked).toBe(session);
    expect(blocked.locked).toBe(true);

    // Passada a janela de backoff, a senha correta volta a destravar.
    const unlocked = await attemptUnlock(session, 'correct-horse', config, 1_000 + 30_000);
    expect(unlocked.locked).toBe(false);
    expect(unlocked.failedAttempts).toBe(0);
  });
});
