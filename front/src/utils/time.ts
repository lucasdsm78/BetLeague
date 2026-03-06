/**
 * Time utilities (safe + fast)
 *
 * - No external deps
 * - Pure functions
 * - Avoids mutation of Date objects
 */

export const ONE_HOUR_MS = 60 * 60 * 1000;

export function addHours(date: Date, hours: number): Date {
  const t = date.getTime();
  return new Date(t + hours * ONE_HOUR_MS);
}

/**
 * Parse any ISO-like date string safely.
 * Returns null if invalid.
 */
export function safeParseDate(value: string | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Return a display date shifted by +1 hour.
 * If input is invalid, returns empty string.
 */
export function formatMatchDateTimePlusOneHour(
  dateValue: string | Date,
  locale: string = 'fr-FR'
): string {
  const d = safeParseDate(dateValue);
  if (!d) return '';

  const shifted = addHours(d, 1);
  return shifted.toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMatchTimePlusOneHour(
  dateValue: string | Date,
  locale: string = 'fr-FR'
): string {
  const d = safeParseDate(dateValue);
  if (!d) return '';

  const shifted = addHours(d, 1);
  return shifted.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export function formatMatchDayLabelPlusOneHour(
  dateValue: string | Date,
  locale: string = 'fr-FR'
): string {
  const d = safeParseDate(dateValue);
  if (!d) return '';

  const shifted = addHours(d, 1);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (shifted.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (shifted.toDateString() === tomorrow.toDateString()) return 'Demain';

  return shifted.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
}

