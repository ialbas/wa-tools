/**
 * Isolamento de namespace (FR-015): o WA-JS é compilado sob este global próprio,
 * NUNCA `window.WPP`. Evita colisão com o WhatsApp e com outras extensões que usem
 * a mesma técnica. (O concorrente vazou `WPPConfig` — aqui nada vaza sob nome padrão.)
 */
export const WT_NAMESPACE = '__WT' as const;

declare global {
  interface Window {
    [WT_NAMESPACE]?: unknown;
  }
}

/** Resolve o handle do WA-JS isolado no MAIN world (undefined até estar pronto). */
export function resolveEngineNamespace(win: Window = window): unknown {
  return win[WT_NAMESPACE];
}

export function isEngineReady(win: Window = window): boolean {
  return resolveEngineNamespace(win) != null;
}
