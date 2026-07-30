import type { SignalKind } from '@/shared/signal-kinds';
import type { SelfTestOutcome } from '@/state/health';
import type { SignalModule, SuppressResolver, WAEngine } from './signals/types';

/**
 * Registro dos módulos de sinal. Aplica overrides, roda o autoteste por-hook e
 * expõe disposers. Um módulo por sinal ⇒ quando a Meta quebra um interno, só
 * aquele hook é marcado indisponível (não derruba os demais).
 */
export class HookRegistry {
  private readonly modules = new Map<SignalKind, SignalModule>();
  private readonly disposers = new Map<SignalKind, () => void>();

  register(mod: SignalModule): void {
    this.modules.set(mod.kind, mod);
  }

  registered(): SignalKind[] {
    return [...this.modules.keys()];
  }

  /** Aplica (ou reaplica) o override de um sinal. Idempotente: descarta o anterior. */
  apply(kind: SignalKind, engine: WAEngine, resolve: SuppressResolver): void {
    const mod = this.modules.get(kind);
    if (!mod) return;
    this.disposers.get(kind)?.();
    this.disposers.set(kind, mod.apply(engine, resolve));
  }

  applyAll(engine: WAEngine, resolve: SuppressResolver): void {
    for (const kind of this.modules.keys()) this.apply(kind, engine, resolve);
  }

  /** Autoteste de um sinal. Módulo ausente ⇒ indisponível. */
  verify(kind: SignalKind, engine: WAEngine): SelfTestOutcome {
    const mod = this.modules.get(kind);
    if (!mod) return { ok: false, reason: 'módulo não registrado' };
    try {
      return mod.verify(engine);
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : 'exceção no autoteste' };
    }
  }

  verifyAll(engine: WAEngine): Map<SignalKind, SelfTestOutcome> {
    return new Map([...this.modules.keys()].map((k) => [k, this.verify(k, engine)]));
  }

  disposeAll(): void {
    for (const d of this.disposers.values()) d();
    this.disposers.clear();
  }
}
