export {};

describe('logger', () => {
  const originalDebug = process.env.REACT_APP_DEBUG;

  beforeEach(() => {
    jest.resetModules();
    process.env.REACT_APP_DEBUG = 'true';
  });

  afterEach(() => {
    process.env.REACT_APP_DEBUG = originalDebug;
    jest.restoreAllMocks();
  });

  it('redacts sensitive fields and keeps scope in emitted logs', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { createLogger } = await import('./logger');

    const logger = createLogger('security').child('auth');
    logger.warn('login failed', {
      token: 'secret-token',
      password: 'Password123!',
      requestId: 'req-1',
      nested: { authorization: 'Bearer secret', ok: true },
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message, context] = warnSpy.mock.calls[0];
    expect(message).toBe('[security.auth] login failed');
    expect(context).toMatchObject({
      token: '[redacted]',
      password: '[redacted]',
      requestId: 'req-1',
      nested: { authorization: '[redacted]', ok: true },
    });
  });

  it('serializes api-like errors with requestId', async () => {
    const { serializeError } = await import('./logger');

    const error = Object.assign(new Error('Boom'), {
      status: 500,
      code: 'INTERNAL_ERROR',
      requestId: 'req-500',
    });

    expect(serializeError(error)).toMatchObject({
      name: 'Error',
      message: 'Boom',
      status: 500,
      code: 'INTERNAL_ERROR',
      requestId: 'req-500',
    });
  });
});



