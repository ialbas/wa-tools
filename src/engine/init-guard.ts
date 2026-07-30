/**
 * Invariante de inicialização (FR-013 / SC-005):
 * até os hooks estarem aplicados e verificados, NENHUM sinal de saída pode ser
 * emitido. Um sinal que vaza uma única vez na janela de init já expõe o usuário.
 *
 * Estratégia: bloquear (descartar) tentativas de emissão enquanto fechado.
 * Descartar é seguro — presença/digitação reemitem; recibo NÃO deve ir mesmo.
 */
export class InitGuard {
  private open = false;
  private blockedCount = 0;

  /** Envolve uma emissão de sinal. Retorna true se passou, false se bloqueada. */
  guard(emit: () => void): boolean {
    if (!this.open) {
      this.blockedCount++;
      return false;
    }
    emit();
    return true;
  }

  /** Abre o portão — só chamado após hooks aplicados E autoteste inicial concluído. */
  arm(): void {
    this.open = true;
  }

  isOpen(): boolean {
    return this.open;
  }

  /** Quantas emissões foram bloqueadas na janela de init (diagnóstico local). */
  blocked(): number {
    return this.blockedCount;
  }
}
