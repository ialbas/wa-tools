import { useCallback, useEffect, useId, useState } from 'react';
import type { CSSProperties, FormEvent, ReactElement } from 'react';
import type { LockConfig } from '@/shared/schemas';
import { attemptUnlock, initialLockSession, isLockedOut } from '@/state/lock-session';
import type { LockSession } from '@/state/lock-session';

export interface LockScreenProps {
  /** Configuração de bloqueio (hash da senha + parâmetros de derivação). */
  config: LockConfig;
  /** Chamado exatamente uma vez quando a sessão é destravada com sucesso. */
  onUnlocked: () => void;
  /** Fonte de tempo injetável (testes/determinismo). Default: `Date.now`. */
  now?: () => number;
}

/**
 * Estilos escopados: só cobrem o que estilos inline não alcançam
 * (`:focus-visible`, keyframes, `prefers-reduced-motion`). Todo valor de cor
 * vem de tokens `--wt-*`; nenhuma cor literal aqui.
 */
const SCOPED_CSS = `
.wt-lock-overlay{animation:wt-lock-fade 160ms ease-out}
.wt-lock-input:focus-visible,.wt-lock-btn:focus-visible{outline:2px solid var(--wt-accent);outline-offset:var(--wt-space-1)}
.wt-lock-btn:disabled{opacity:.55;cursor:not-allowed}
.wt-lock-input:disabled{opacity:.55}
@keyframes wt-lock-fade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion: reduce){.wt-lock-overlay{animation:none}}
`;

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2147483000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--wt-space-4)',
    background: 'var(--wt-bg)',
    color: 'var(--wt-text)',
    fontFamily: 'var(--wt-font)',
  },
  card: {
    width: 'min(92vw, 22rem)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--wt-space-3)',
    padding: 'var(--wt-space-4)',
    background: 'var(--wt-surface)',
    border: '1px solid var(--wt-surface-2)',
    borderRadius: 'var(--wt-radius)',
  },
  header: { display: 'flex', alignItems: 'center', gap: 'var(--wt-space-2)' },
  title: { margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--wt-text)' },
  subtitle: { margin: 0, fontSize: '.875rem', lineHeight: 1.5, color: 'var(--wt-text-dim)' },
  form: { display: 'flex', flexDirection: 'column', gap: 'var(--wt-space-2)' },
  label: { fontSize: '.8125rem', fontWeight: 500, color: 'var(--wt-text-dim)' },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: 'var(--wt-space-2) var(--wt-space-3)',
    background: 'var(--wt-surface-2)',
    color: 'var(--wt-text)',
    border: '1px solid var(--wt-surface-2)',
    borderRadius: 'var(--wt-radius)',
    fontFamily: 'var(--wt-font)',
    fontSize: '1rem',
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--wt-space-1)',
    marginTop: 'var(--wt-space-1)',
    padding: 'var(--wt-space-2) var(--wt-space-3)',
    background: 'var(--wt-accent)',
    color: 'var(--wt-accent-contrast)',
    border: 'none',
    borderRadius: 'var(--wt-radius)',
    fontFamily: 'var(--wt-font)',
    fontSize: '.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--wt-space-2)',
    margin: 0,
    fontSize: '.8125rem',
    lineHeight: 1.4,
  },
  statusError: { color: 'var(--wt-danger)' },
  statusWait: { color: 'var(--wt-warn)' },
} satisfies Record<string, CSSProperties>;

function LockIcon(): ReactElement {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function AlertIcon(): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function ClockIcon(): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes} min ${seconds}s` : `${seconds}s`;
}

/**
 * Tela de bloqueio (App Lock, US5).
 *
 * Enquanto a sessão está trancada cobre todo o conteúdo com um overlay
 * `role="dialog"` e pede a senha. Ao submeter chama `attemptUnlock`; no
 * sucesso dispara `onUnlocked` e some. Em erro e em lockout o estado é
 * comunicado por TEXTO + ÍCONE (não só cor) e anunciado a leitores de tela.
 */
export function LockScreen({ config, onUnlocked, now = Date.now }: LockScreenProps): ReactElement | null {
  const [session, setSession] = useState<LockSession>(() => initialLockSession(config.enabled));
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  // Tick só para re-renderizar a contagem regressiva durante o lockout.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (session.lockoutUntil === null) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [session.lockoutUntil]);

  const titleId = useId();
  const inputId = useId();
  const statusId = useId();

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (busy) return;
      const at = now();
      if (isLockedOut(session, at)) return;
      setBusy(true);
      setError(false);
      try {
        const next = await attemptUnlock(session, passcode, config, at);
        setSession(next);
        if (!next.locked) {
          onUnlocked();
        } else {
          setError(true);
          setPasscode('');
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, session, passcode, config, now, onUnlocked],
  );

  if (!session.locked) return null;

  const t = now();
  const lockedOut = isLockedOut(session, t);
  const remainingMs = session.lockoutUntil !== null ? Math.max(0, session.lockoutUntil - t) : 0;
  const disabled = busy || lockedOut;

  let notice: ReactElement | null = null;
  if (lockedOut) {
    notice = (
      <p role="status" style={{ ...styles.status, ...styles.statusWait }}>
        <ClockIcon />
        <span>Muitas tentativas. Tente novamente em {formatRemaining(remainingMs)}.</span>
      </p>
    );
  } else if (error) {
    notice = (
      <p role="alert" style={{ ...styles.status, ...styles.statusError }}>
        <AlertIcon />
        <span>Senha incorreta. Tente novamente.</span>
      </p>
    );
  }

  return (
    <div
      className="wt-lock-overlay"
      style={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <style>{SCOPED_CSS}</style>
      <div style={styles.card}>
        <div style={styles.header}>
          <LockIcon />
          <h2 id={titleId} style={styles.title}>
            App bloqueado
          </h2>
        </div>
        <p style={styles.subtitle}>Digite sua senha para revelar o conteúdo protegido.</p>
        <form style={styles.form} onSubmit={submit}>
          <label htmlFor={inputId} style={styles.label}>
            Senha
          </label>
          <input
            id={inputId}
            className="wt-lock-input"
            style={styles.input}
            type="password"
            autoComplete="off"
            value={passcode}
            disabled={disabled}
            aria-describedby={statusId}
            onChange={(event) => setPasscode(event.target.value)}
          />
          <button
            className="wt-lock-btn"
            style={styles.button}
            type="submit"
            disabled={disabled || passcode.length === 0}
          >
            {busy ? 'Verificando…' : 'Desbloquear'}
          </button>
        </form>
        <div id={statusId} aria-live="polite">
          {notice}
        </div>
      </div>
    </div>
  );
}
