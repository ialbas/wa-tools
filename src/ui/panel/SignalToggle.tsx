import { useId } from 'react';
import type { SuppressibleSignal } from '@/state/health';
import { signalUiState } from '@/ui/signal-state';
import { SignalState } from '@/ui/panel/SignalState';

export interface SignalToggleProps {
  /** Rótulo legível do sinal (ex.: "Confirmação de leitura"). */
  label: string;
  /** Descrição opcional de apoio. */
  description?: string;
  /** Saúde/hook do sinal (máquina de falha-segura). */
  signal: SuppressibleSignal;
  /** Desejo do usuário — ligar a supressão deste sinal. */
  enabled: boolean;
  /** Chamado com o próximo valor desejado ao alternar. */
  onToggle: (next: boolean) => void;
}

/**
 * Uma linha do painel: rótulo (+ descrição), estado normativo do sinal e o
 * switch. O estado exibido deriva SEMPRE de `signalUiState` — o switch reflete
 * a intenção do usuário (`enabled`), enquanto o `SignalState` reflete a
 * realidade da falha-segura (garantido/indisponível/verificando).
 */
export function SignalToggle({
  label,
  description,
  signal,
  enabled,
  onToggle,
}: SignalToggleProps) {
  const ui = signalUiState(signal, enabled);
  const labelId = useId();

  return (
    <div className="wt-row" data-state={ui.key}>
      <div className="wt-row__text">
        <span id={labelId} className="wt-row__label">
          {label}
        </span>
        {description ? <span className="wt-row__desc">{description}</span> : null}
        <SignalState state={ui} />
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-labelledby={labelId}
        className="wt-switch"
        data-on={enabled}
        onClick={() => onToggle(!enabled)}
      >
        <span className="wt-switch__knob" aria-hidden={true} />
      </button>
    </div>
  );
}
