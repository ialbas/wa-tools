export interface FailSafeBannerProps {
  /** Mensagem da falha-segura (ex.: "Confirmação de leitura indisponível — o hook interno mudou."). */
  message: string;
  /** Título do banner. */
  title?: string;
  /** Se fornecido, exibe um botão de dispensar não-destrutivo. */
  onDismiss?: () => void;
}

/**
 * Banner NÃO-bloqueante de falha-segura (ui-contract §Aviso de falha-segura,
 * disparo ≤ 2 s). Tom `warn` (fundo/borda derivados de --wt-warn via color-mix,
 * zero cor hardcoded). `role="alert"` para anúncio imediato a leitores de tela;
 * o ícone é decorativo — o significado vive no texto (não só na cor).
 */
export function FailSafeBanner({ message, title = 'Falha-segura', onDismiss }: FailSafeBannerProps) {
  return (
    <div className="wt-root wt-banner" role="alert">
      <svg
        className="wt-banner__icon"
        width={18}
        height={18}
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

      <div className="wt-banner__body">
        <span className="wt-banner__title">{title}</span>
        <span className="wt-banner__msg">{message}</span>
      </div>

      {onDismiss ? (
        <button
          type="button"
          className="wt-banner__dismiss"
          onClick={onDismiss}
          aria-label="Dispensar aviso"
        >
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
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
