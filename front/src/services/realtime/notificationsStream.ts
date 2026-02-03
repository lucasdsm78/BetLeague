import enhancedAuthService from '../authService.enhanced';


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

  constructor(reconnectMs = DEFAULT_RECONNECT_MS) {
    this.reconnectMs = reconnectMs;
  }

  stop() {
    this.retries = 0;
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
    this.stop();
    this.abortController = new AbortController();

    const run = async () => {
      try {
        const token = enhancedAuthService.getCurrentToken();
        if (!token) {
          return;
        }

        const apiBase = normalizeApiBase(process.env.REACT_APP_API_URL || 'http://localhost:8001');

        const res = await fetch(`${apiBase}/realtime/notifications/stream`, {
          method: 'GET',
          headers: {
            'X-Authentication': `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          signal: this.abortController?.signal,
        });

        if (res.status === 401 || res.status === 403) {
          // Auth invalide: stop net, pas de retry agressif (le refresh token flow doit reprendre)
          this.stop();
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
    const base = overrideDelayMs ?? this.reconnectMs;
    const exp = Math.min(MAX_RECONNECT_MS, base * Math.pow(2, this.retries));
    const delay = jitter(exp);
    this.retries = Math.min(this.retries + 1, 10);
    this.reconnectTimer = window.setTimeout(() => {
      // Note: on ne rappelle pas stop() ici, start() s’en charge
      this.start({});
    }, delay);
  }
}
