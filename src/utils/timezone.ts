export function formatTimeInTimezone(isoTime: string, timezone: string): string {
  try {
    const date = new Date(isoTime);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  } catch {
    return isoTime;
  }
}

export function getTimezoneOffset(timezone: string): string {
  const date = new Date();
  const utcTime = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzTime = date.toLocaleString('en-US', { timeZone: timezone });

  const utcDate = new Date(utcTime);
  const tzDate = new Date(tzTime);

  const offset = (utcDate.getTime() - tzDate.getTime()) / (1000 * 60 * 60);
  const sign = offset > 0 ? '+' : '';
  return `UTC${sign}${offset}`;
}

export const commonTimezones = [
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
  'Asia/Tokyo',
];
