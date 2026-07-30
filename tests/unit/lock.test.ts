import { describe, it, expect } from 'vitest';
import {
  createLockConfig,
  verifyPasscode,
  initialLockSession,
  registerFailure,
  registerSuccess,
  isLockedOut,
  backoffMs,
  MAX_ATTEMPTS,
} from '@/privacy-screen/lock';

describe('app-lock crypto', () => {
  it('verifica a senha correta e rejeita a errada; nunca guarda texto claro', async () => {
    const cfg = await createLockConfig('supersecret');
    expect(cfg.passHash).not.toContain('supersecret');
    expect(await verifyPasscode('supersecret', cfg)).toBe(true);
    expect(await verifyPasscode('wrong', cfg)).toBe(false);
  });

  it('rejeita senha curta demais', async () => {
    await expect(createLockConfig('ab')).rejects.toThrow();
  });

  it('salts diferentes ⇒ hashes diferentes p/ a mesma senha', async () => {
    const a = await createLockConfig('samesame');
    const b = await createLockConfig('samesame');
    expect(a.passHash).not.toBe(b.passHash);
  });
});

describe('lockout com backoff', () => {
  it('não bloqueia antes de MAX_ATTEMPTS', () => {
    expect(backoffMs(MAX_ATTEMPTS - 1)).toBe(0);
    expect(backoffMs(MAX_ATTEMPTS)).toBeGreaterThan(0);
  });

  it('backoff cresce e satura em 15min', () => {
    expect(backoffMs(MAX_ATTEMPTS)).toBe(30_000);
    expect(backoffMs(MAX_ATTEMPTS + 1)).toBe(60_000);
    expect(backoffMs(MAX_ATTEMPTS + 50)).toBe(15 * 60_000);
  });

  it('5 falhas ⇒ bloqueado; sucesso zera tudo', () => {
    let s = initialLockSession(true);
    for (let i = 0; i < MAX_ATTEMPTS; i++) s = registerFailure(s, 1000);
    expect(isLockedOut(s, 1000)).toBe(true);
    expect(isLockedOut(s, 1000 + 30_000)).toBe(false); // após a janela
    const ok = registerSuccess();
    expect(ok.locked).toBe(false);
    expect(ok.failedAttempts).toBe(0);
  });
});
