import type { SignalUiState } from '@/ui/signal-state';

/** tone → token de cor (1:1 com o ui-contract). Nenhuma cor hardcoded. */
const TONE_COLOR: Record<SignalUiState['tone'], string> = {
  accent: 'var(--wt-accent)',
  warn: 'var(--wt-warn)',
  dim: 'var(--wt-text-dim)',
};

/**
 * Ícone por estado — herda a cor via `currentColor`. É decorativo
 * (`aria-hidden`): o significado é carregado pelo texto do rótulo, nunca só
 * pela cor (requisito de acessibilidade do ui-contract).
 */
function StateIcon({ state }: { state: SignalUiState['key'] }) {
  switch (state) {
    case 'active':
      // check
      return (
        <svg
          width={14}
          height={14}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden={true}
        >
          <path d="M13.5 4.5 6.5 11.5 3 8" />
        </svg>
      );
    case 'unavailable':
      // triângulo de alerta
      return (
        <svg
          width={14}
          height={14}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden={true}
        >
          <path d="M8 2.2 1.6 13.2h12.8L8 2.2Z" />
          <path d="M8 6.4v3.1" />
          <path d="M8 11.6h.01" />
        </svg>
      );
    case 'inactive':
      // traço (desligado)
      return (
        <svg
          width={14}
          height={14}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden={true}
        >
          <path d="M4 8h8" />
        </svg>
      );
    case 'checking':
      // arco (spinner) — parado sob prefers-reduced-motion
      return (
        <svg
          className="wt-spin"
          width={14}
          height={14}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          aria-hidden={true}
        >
          <path d="M8 2.5a5.5 5.5 0 1 1-5.2 3.7" />
        </svg>
      );
  }
}

export interface SignalStateProps {
  state: SignalUiState;
}

/**
 * Renderiza o estado normativo de um sinal (texto + ícone), com cor via token.
 * `role="status"` + `aria-live="polite"` para anunciar transições da
 * falha-segura a leitores de tela sem interromper o usuário.
 */
export function SignalState({ state }: SignalStateProps) {
  return (
    <span
      className="wt-signal-state"
      data-state={state.key}
      style={{ color: TONE_COLOR[state.tone] }}
      role="status"
      aria-live="polite"
    >
      <StateIcon state={state.key} />
      <span>{state.label}</span>
    </span>
  );
}
