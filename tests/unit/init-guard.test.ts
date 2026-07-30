import { describe, it, expect, vi } from 'vitest';
import { InitGuard } from '@/engine/init-guard';

describe('InitGuard — nenhum sinal vaza na init', () => {
  it('bloqueia emissões enquanto fechado', () => {
    const guard = new InitGuard();
    const emit = vi.fn();
    expect(guard.guard(emit)).toBe(false);
    expect(emit).not.toHaveBeenCalled();
    expect(guard.blocked()).toBe(1);
  });

  it('libera emissões após arm()', () => {
    const guard = new InitGuard();
    const emit = vi.fn();
    guard.arm();
    expect(guard.isOpen()).toBe(true);
    expect(guard.guard(emit)).toBe(true);
    expect(emit).toHaveBeenCalledOnce();
  });

  it('conta emissões bloqueadas antes de armar', () => {
    const guard = new InitGuard();
    guard.guard(() => {});
    guard.guard(() => {});
    expect(guard.blocked()).toBe(2);
    guard.arm();
    guard.guard(() => {});
    expect(guard.blocked()).toBe(2);
  });
});
