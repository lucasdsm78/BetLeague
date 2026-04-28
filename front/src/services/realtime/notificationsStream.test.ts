import { NotificationsStream } from './notificationsStream';
import enhancedAuthService from '../authService.enhanced';

jest.mock('../authService.enhanced', () => ({
  __esModule: true,
  default: {
    getCurrentToken: jest.fn(),
  },
}));

const flushAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('NotificationsStream', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0);
    (enhancedAuthService.getCurrentToken as jest.Mock).mockReturnValue('token-123');
    process.env.REACT_APP_API_URL = 'https://api.betleague.app';
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  it('reconnects after a rate-limited stream response using Retry-After', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(null, {
        status: 429,
        headers: { 'Retry-After': '2' },
      }),
    );
    // @ts-ignore
    global.fetch = fetchMock;

    const stream = new NotificationsStream();
    const onError = jest.fn();

    stream.start({ onError });
    await flushAsyncWork();

    expect(onError).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(2100);
    await flushAsyncWork();

    expect(fetchMock).toHaveBeenCalledTimes(2);

    stream.stop();
  });

  it('restarts the stream when the browser comes back online', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      {
        status: 200,
        ok: true,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: {
          getReader: () => ({
            read: () => new Promise(() => {}),
          }),
        },
      },
    );
    // @ts-ignore
    global.fetch = fetchMock;

    const stream = new NotificationsStream();
    const internal = stream as unknown as {
      handlers: object | null;
      abortController: AbortController | null;
      reconnectTimer: number | null;
      onlineListener: () => void;
    };

    internal.handlers = {};
    internal.abortController = null;
    internal.reconnectTimer = null;

    internal.onlineListener();
    await flushAsyncWork();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    stream.stop();
  });
});



