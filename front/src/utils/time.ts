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

export type TimeZoneName = Intl.DateTimeFormatOptions['timeZone'];

/**
 * Format a match datetime with a global +1h offset (business requirement).
 */
export function formatMatchDateTime(
  dateValue: string | Date,
  options?: {
    locale?: string;
    timeZone?: TimeZoneName;
  }
): string {
  const d = safeParseDate(dateValue);
  if (!d) return '';

  const { locale = 'fr-FR', timeZone } = options ?? {};
  const shifted = addHours(d, 1);

  return shifted.toLocaleString(locale, {
    ...(timeZone ? { timeZone } : {}),
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMatchTime(
  dateValue: string | Date,
  options?: {
    locale?: string;
    timeZone?: TimeZoneName;
  }
): string {
  const d = safeParseDate(dateValue);
  if (!d) return '';

  const { locale = 'fr-FR', timeZone } = options ?? {};
  const shifted = addHours(d, 1);

  return shifted.toLocaleTimeString(locale, {
    ...(timeZone ? { timeZone } : {}),
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMatchDayLabel(
  dateValue: string | Date,
  options?: {
    locale?: string;
    timeZone?: TimeZoneName;
  }
): string {
  const d = safeParseDate(dateValue);
  if (!d) return '';

  const { locale = 'fr-FR', timeZone } = options ?? {};
  const shifted = addHours(d, 1);

  // Compare day keys in the chosen timezone (or local timezone when undefined)
  const fmt = new Intl.DateTimeFormat(locale, {
    ...(timeZone ? { timeZone } : {}),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const dayKey = fmt.format(shifted);

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const todayKey = fmt.format(today);
  const tomorrowKey = fmt.format(tomorrow);

  if (dayKey === todayKey) return "Aujourd'hui";
  if (dayKey === tomorrowKey) return 'Demain';

  return shifted.toLocaleDateString(locale, {
    ...(timeZone ? { timeZone } : {}),
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function getEpochMs(dateValue: string | Date): number | null {
  const d = safeParseDate(dateValue);
  return d ? d.getTime() : null;
}

/** @deprecated Compat: alias */
export function formatMatchDateTimePlusOneHour(dateValue: string | Date, locale: string = 'fr-FR'): string {
  return formatMatchDateTime(dateValue, { locale });
}

/** @deprecated Compat: alias */
export function formatMatchTimePlusOneHour(dateValue: string | Date, locale: string = 'fr-FR'): string {
  return formatMatchTime(dateValue, { locale });
}

/** @deprecated Compat: alias */
export function formatMatchDayLabelPlusOneHour(dateValue: string | Date, locale: string = 'fr-FR'): string {
  return formatMatchDayLabel(dateValue, { locale });
}
