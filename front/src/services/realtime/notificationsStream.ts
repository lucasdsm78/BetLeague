import enhancedAuthService from '../authService.enhanced';
import { createLogger } from '../../utils/logger';

const logger = createLogger('notificationsStream');


type StreamMessage =
  | { type: 'notification.created'; notification: Record<string, unknown> }
  | { type: string; [k: string]: unknown };

export type NotificationsStreamHandlers = {
  onConnected?: () => void;
  onMessage?: (msg: StreamMessage) => void;
  onError?: (err: unknown) => void;
};

const DEFAULT_RECONNECT_MS = 2500;
const MAX_RECONNECT_MS = 30_000;

const normalizeApiBase = (rawBase: string): string => {
  const b = rawBase.replace(/\/$/, '');
  return b.endsWith('/api') ? b : `${b}/api`;
};

const jitter = (ms: number) => {
  const j = Math.floor(Math.random() * 250);
  return ms + j;
};

export class NotificationsStream {
  private abortController: AbortController | null = null;
  private reconnectTimer: number | null = null;
  private reconnectMs: number;
  private retries = 0;
  private handlers: NotificationsStreamHandlers | null = null;

  constructor(reconnectMs = DEFAULT_RECONNECT_MS) {
    this.reconnectMs = reconnectMs;
  }

  stop() {
    this.retries = 0;
    this.handlers = null;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  start(handlers: NotificationsStreamHandlers) {
    // Stocke les handlers pour les reconnexions
    this.handlers = handlers;
    // Stop sans effacer handlers (on veut les conserver)
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.abortController = new AbortController();

    const run = async () => {
      try {
        const token = enhancedAuthService.getCurrentToken();
        if (!token) {
          logger.debug('no token, skip start');
          return;
        }

        const apiBase = normalizeApiBase(process.env.REACT_APP_API_URL || 'http://localhost:8001');

        logger.debug('connecting', { url: `${apiBase}/realtime/notifications/stream` });

        const res = await fetch(`${apiBase}/realtime/notifications/stream`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          signal: this.abortController?.signal,
        });

        logger.debug('http response', { status: res.status });

        if (res.status === 401 || res.status === 403) {
          // Auth invalide: stop net, pas de retry agressif (le refresh token flow doit reprendre)
          // Stop définitivement (handlers conservés au besoin, mais pas d'auto-reconnect)
          this.abortController?.abort();
          this.abortController = null;
          this.reconnectTimer && window.clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
          this.retries = 0;
          handlers.onError?.(new Error(`Stream auth ${res.status}`));
          return;
        }

        if (res.status === 429) {
          const retryAfter = Number(res.headers.get('Retry-After') || '0');
          handlers.onError?.(new Error('Stream rate-limited'));
          this.scheduleReconnect(Math.max(1000, retryAfter * 1000));
          return;
        }

        if (!res.ok || !res.body) throw new Error(`Stream HTTP ${res.status}`);

        // reset backoff dès que c'est OK
        this.retries = 0;

        handlers.onConnected?.();

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');

        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // découpe SSE par bloc \n\n
          let idx;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const rawEvent = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);

            const dataLine = rawEvent
              .split('\n')
              .find((l) => l.startsWith('data: '));
            const eventLine = rawEvent
              .split('\n')
              .find((l) => l.startsWith('event: '));

            const eventName = eventLine?.slice('event: '.length) ?? 'message';
            if (eventName === 'connected') continue;

            if (!dataLine) continue;

            const jsonStr = dataLine.slice('data: '.length);
            try {
              const msg = JSON.parse(jsonStr) as StreamMessage;
              handlers.onMessage?.(msg);
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch (err) {
        logger.debug('stream error', { error: err });
        handlers.onError?.(err);
      } finally {
        // auto-reconnect (best effort)
        if (!this.abortController?.signal.aborted) {
          this.scheduleReconnect();
        }
      }
    };

    void run();
  }

  private scheduleReconnect(overrideDelayMs?: number) {
    const handlers = this.handlers;
    if (!handlers) return;

    const base = overrideDelayMs ?? this.reconnectMs;
    const exp = Math.min(MAX_RECONNECT_MS, base * Math.pow(2, this.retries));
    const delay = jitter(exp);
    this.retries = Math.min(this.retries + 1, 10);
    this.reconnectTimer = window.setTimeout(() => {
      // Note: on ne rappelle pas stop() ici, start() s’en charge
      this.start(handlers);
    }, delay);
  }
}
