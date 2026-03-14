import { parseBooleanQueryParam, resolveTicketsFilterMode } from './ticketsMode';

describe('ticketsMode', () => {
  test('parseBooleanQueryParam', () => {
    expect(parseBooleanQueryParam(null)).toBe(false);
    expect(parseBooleanQueryParam('')).toBe(false);
    expect(parseBooleanQueryParam('0')).toBe(false);
    expect(parseBooleanQueryParam('1')).toBe(true);
    expect(parseBooleanQueryParam('true')).toBe(true);
    expect(parseBooleanQueryParam('TrUe')).toBe(true);
    expect(parseBooleanQueryParam('yes')).toBe(true);
    expect(parseBooleanQueryParam('on')).toBe(true);
  });

  test('query param has priority', () => {
    const r = resolveTicketsFilterMode({
      total: 10,
      threshold: 5,
      envForceServer: false,
      locationSearch: '?server_filter=1',
    });
    expect(r).toEqual({ mode: 'server', reason: 'query_param' });
  });

  test('env has priority over threshold', () => {
    const r = resolveTicketsFilterMode({
      total: 999,
      threshold: 5000,
      envForceServer: true,
      locationSearch: '',
    });
    expect(r).toEqual({ mode: 'server', reason: 'env' });
  });

  test('threshold switches to server only when strictly greater', () => {
    expect(resolveTicketsFilterMode({ total: 500, threshold: 500, envForceServer: false, locationSearch: '' }))
      .toEqual({ mode: 'client', reason: 'default' });
    expect(resolveTicketsFilterMode({ total: 501, threshold: 500, envForceServer: false, locationSearch: '' }))
      .toEqual({ mode: 'server', reason: 'threshold' });
  });
});

