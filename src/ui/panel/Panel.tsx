import type { ReactNode } from 'react';

export interface PanelProps {
  /** Toggles de sinal (e outras seções) renderizados no corpo do painel. */
  children: ReactNode;
  /** Subtítulo do cabeçalho. */
  subtitle?: string;
  /** Área de rodapé opcional (ex.: banner de falha-segura). */
  footer?: ReactNode;
}

/** Marca do produto — quadrado accent com glifo em accent-contrast (usa ambos os tokens). */
function BrandMark() {
  return (
    <span className="wt-brand__mark" aria-hidden={true}>
      <svg
        width={13}
        height={13}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 1.6 2.6 3.9v3.4c0 3.3 2.2 5.7 5.4 7.1 3.2-1.4 5.4-3.8 5.4-7.1V3.9L8 1.6Z" />
        <path d="M5.7 8.1 7.3 9.7l3-3.4" />
      </svg>
    </span>
  );
}

/**
 * Shell do painel WA Tools: cabeçalho de marca + corpo com a lista de toggles
 * (children). Dark-first, todas as cores/spacing via token. Superfície estática
 * e enxuta (FCP ≤ 500 ms — ui-contract). `aria-label` nomeia a região.
 */
export function Panel({ children, subtitle = 'Privacidade — 100% local', footer }: PanelProps) {
  return (
    <section className="wt-root wt-panel" aria-label="WA Tools — painel de privacidade">
      <header className="wt-panel__header">
        <span className="wt-brand">
          <BrandMark />
          WA Tools
        </span>
        <span className="wt-panel__subtitle">{subtitle}</span>
      </header>

      <div className="wt-panel__body">{children}</div>

      {footer ? <div className="wt-panel__footer">{footer}</div> : null}
    </section>
  );
}
