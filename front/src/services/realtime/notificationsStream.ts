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

const normalizeApiBase = (rawBase: string): string => {
  const b = rawBase.replace(/\/$/, '');
  return b.endsWith('/api') ? b : `${b}/api`;
};

export class NotificationsStream {
  private abortController: AbortController | null = null;
  private reconnectTimer: number | null = null;
  private reconnectMs: number;

  constructor(reconnectMs = DEFAULT_RECONNECT_MS) {
    this.reconnectMs = reconnectMs;
  }

  stop() {
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

        if (!res.ok || !res.body) throw new Error(`Stream HTTP ${res.status}`);

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
          this.reconnectTimer = window.setTimeout(() => this.start(handlers), this.reconnectMs);
        }
      }
    };

    void run();
  }
}
