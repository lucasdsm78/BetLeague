import { formatMatchTime, safeParseDate } from './time';

describe('time utils', () => {
  it('interprets timezone-less backend datetimes as UTC for backward compatibility', () => {
	const parsed = safeParseDate('2026-07-01T18:00:00');

	expect(parsed).not.toBeNull();
	expect(parsed?.toISOString()).toBe('2026-07-01T18:00:00.000Z');
  });

  it('formats a summer UTC kickoff correctly in Europe/Paris without manual offset hacks', () => {
	expect(formatMatchTime('2026-07-01T18:00:00Z', { timeZone: 'Europe/Paris' })).toBe('20:00');
  });

  it('formats a winter UTC kickoff correctly in Europe/Paris', () => {
	expect(formatMatchTime('2026-12-01T19:00:00Z', { timeZone: 'Europe/Paris' })).toBe('20:00');
  });
});

