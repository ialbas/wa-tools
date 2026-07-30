import type { SignalModule } from '@/engine/signals/types';
import { createChatStateSignal } from '@/engine/signals/typing';

/**
 * US4 — Supressão de "gravando áudio…" (chat-state recording).
 *
 * Compartilha o núcleo de chat-state com `typing` (mesmo interno do WhatsApp,
 * método diferente), mas é um `SignalModule` independente: seu hook e seu
 * autoteste vivem isolados, então uma quebra no envio de "recording" não afeta
 * o "typing" nem os demais sinais.
 *
 * INTEGRAÇÃO AO VIVO: alvo provável = `__WT.Store.ChatState.sendChatStateRecording`
 * — confirmar contra web.whatsapp.com.
 */
export const recordingSignal: SignalModule = createChatStateSignal(
  'recording',
  'sendChatStateRecording',
);
