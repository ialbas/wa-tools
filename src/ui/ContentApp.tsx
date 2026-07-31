import { useEffect, useRef, useState } from 'react';
import { chromeStorageArea, loadState, saveConfig, saveLock } from '@/state/persistence';
import { applyPrivacyScreen, type PrivacyScreenHandle } from '@/privacy-screen/overlay';
import {
  defaultPrivacyConfig,
  type LockConfig,
  type PrivacyConfig,
  type PrivacyScreenConfig,
} from '@/shared/schemas';
import { createLockConfig } from '@/privacy-screen/lock';
import { LockScreen } from '@/ui/lock/LockScreen';

const BLUR_FIELDS: ReadonlyArray<{ key: keyof PrivacyScreenConfig; label: string }> = [
  { key: 'blurNames', label: 'Nomes dos contatos' },
  { key: 'blurPhotos', label: 'Fotos dos contatos' },
  { key: 'blurRecent', label: 'Mensagens recentes' },
  { key: 'blurConversation', label: 'Mensagens da conversa' },
  { key: 'blurComposer', label: 'Campo de composição' },
];

// Blindagem por região (robusta): borra o container inteiro, imune ao DOM interno.
const SHIELD_FIELDS: ReadonlyArray<{ key: keyof PrivacyScreenConfig; label: string }> = [
  { key: 'shieldList', label: 'Blindar a lista inteira' },
  { key: 'shieldChat', label: 'Blindar a conversa aberta' },
];

const surface: React.CSSProperties = {
  background: 'var(--wt-surface)',
  color: 'var(--wt-text)',
  borderRadius: 'var(--wt-radius, 12px)',
  fontFamily: 'var(--wt-font)', // mesma fonte do WhatsApp (Roboto Variable)
  fontSize: 14,
  lineHeight: 1.4,
};

/**
 * Painel injetado (US5): controla a privacy-screen (blur + reveal) e o app-lock.
 * 100% local — lê/escreve só `chrome.storage.local` via a persistência testada;
 * o overlay é aplicado ao documento do WhatsApp fora do shadow root.
 */
export function ContentApp() {
  const storage = useRef(chromeStorageArea());
  const handle = useRef<PrivacyScreenHandle | null>(null);
  const [config, setConfig] = useState<PrivacyConfig>(defaultPrivacyConfig());
  const [lock, setLock] = useState<LockConfig | null>(null);
  const [locked, setLocked] = useState(false);
  const [open, setOpen] = useState(true);
  const [pass, setPass] = useState('');

  useEffect(() => {
    let alive = true;
    void loadState(storage.current).then((s) => {
      if (!alive) return;
      setConfig(s.config);
      setLock(s.lock);
      setLocked(s.lock?.enabled ?? false);
      handle.current = applyPrivacyScreen(s.config.privacyScreen);
    });
    return () => {
      alive = false;
      handle.current?.dispose();
    };
  }, []);

  function updateScreen(next: PrivacyScreenConfig) {
    const nextConfig: PrivacyConfig = { ...config, privacyScreen: next };
    setConfig(nextConfig);
    handle.current?.update(next);
    void saveConfig(storage.current, nextConfig);
  }

  function toggleBlur(key: keyof PrivacyScreenConfig) {
    updateScreen({ ...config.privacyScreen, [key]: !config.privacyScreen[key] });
  }

  async function definePasscode() {
    if (pass.length < 4) return;
    const cfg = await createLockConfig(pass);
    setLock(cfg);
    setPass('');
    await saveLock(storage.current, cfg);
  }

  if (locked && lock) {
    return <LockScreen config={lock} onUnlocked={() => setLocked(false)} />;
  }

  return (
    <div
      className="wt-root"
      style={{
        ...surface,
        position: 'fixed',
        top: 76,
        right: 16,
        width: 300,
        zIndex: 2147483000,
        boxShadow: '0 12px 32px rgba(0,0,0,.4)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          all: 'unset',
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          boxSizing: 'border-box',
          padding: '12px 14px',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 128 128" fill="none" aria-hidden="true">
            <rect x="8" y="8" width="112" height="112" rx="30" fill="var(--wt-surface-2)" />
            <path
              d="M50 28h28c12.15 0 22 9.85 22 22v14c0 12.15-9.85 22-22 22H52l-14.6 12.4c-1.96 1.66-4.96.27-4.96-2.3V85.2C34.9 82.4 28 74 28 64V50c0-12.15 9.85-22 22-22Z"
              fill="var(--wt-accent)"
            />
            <circle cx="64" cy="52" r="9" fill="var(--wt-surface-2)" />
            <path
              d="M59.5 58.5 55.5 74a1.5 1.5 0 0 0 1.46 1.86h14.08A1.5 1.5 0 0 0 72.5 74l-4-15.5Z"
              fill="var(--wt-surface-2)"
            />
          </svg>
          WA Tools · Privacidade
        </span>
        <span style={{ color: 'var(--wt-text-dim)' }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px' }}>
          <p style={{ color: 'var(--wt-text-dim)', margin: '0 0 8px', fontSize: 12 }}>
            Modo privado (antiespionagem de tela)
          </p>
          {BLUR_FIELDS.map((f) => (
            <label
              key={f.key}
              style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}
            >
              <input
                type="checkbox"
                checked={config.privacyScreen[f.key]}
                onChange={() => toggleBlur(f.key)}
              />
              {f.label}
            </label>
          ))}
          <label
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              padding: '8px 0 0',
              color: 'var(--wt-text-dim)',
            }}
          >
            <input
              type="checkbox"
              checked={config.privacyScreen.revealOnHover}
              onChange={() =>
                updateScreen({
                  ...config.privacyScreen,
                  revealOnHover: !config.privacyScreen.revealOnHover,
                })
              }
            />
            Revelar ao passar o cursor
          </label>

          <p style={{ color: 'var(--wt-text-dim)', margin: '12px 0 4px', fontSize: 12 }}>
            Blindagem — robusto (borra o container inteiro)
          </p>
          {SHIELD_FIELDS.map((f) => (
            <label
              key={f.key}
              style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}
            >
              <input
                type="checkbox"
                checked={config.privacyScreen[f.key]}
                onChange={() => toggleBlur(f.key)}
              />
              {f.label}
            </label>
          ))}

          <hr style={{ border: 0, borderTop: '1px solid var(--wt-surface-2)', margin: '12px 0' }} />

          <p style={{ color: 'var(--wt-text-dim)', margin: '0 0 8px', fontSize: 12 }}>Bloqueio</p>
          {lock ? (
            <button
              onClick={() => setLocked(true)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                background: 'var(--wt-accent)',
                color: 'var(--wt-accent-contrast, #fff)',
                padding: '8px 12px',
                borderRadius: 8,
                textAlign: 'center',
                display: 'block',
              }}
            >
              Trancar agora
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Definir senha (min. 4)"
                style={{
                  flex: 1,
                  background: 'var(--wt-surface-2)',
                  color: 'var(--wt-text)',
                  border: 0,
                  borderRadius: 8,
                  padding: '8px 10px',
                }}
              />
              <button
                onClick={() => void definePasscode()}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  background: 'var(--wt-accent)',
                  color: 'var(--wt-accent-contrast, #fff)',
                  padding: '8px 12px',
                  borderRadius: 8,
                }}
              >
                OK
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
