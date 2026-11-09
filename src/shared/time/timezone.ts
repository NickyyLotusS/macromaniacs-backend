export function assertIanaTimezone(value: string): string {
  const timezone = value.trim();
  if (!timezone || timezone.length > 64) {
    throw new Error('timezone must be a valid IANA timezone');
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(0);
  } catch {
    throw new Error('timezone must be a valid IANA timezone');
  }
  return timezone;
}

export function foodDateAt(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: assertIanaTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function normalizeDateColumn(value: string | Date): string {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : value.slice(0, 10);
}
