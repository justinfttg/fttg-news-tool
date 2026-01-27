/**
 * Pure function that generates an array of scheduled dates based on
 * posting frequency, date range, and optional quota cap.
 *
 * No side-effects — does not touch the database.
 */

export type Frequency = 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'custom';

export function calculateSchedule(
  startDate: Date,
  endDate: Date,
  frequency: Frequency,
  customDays?: number,
  quota?: number
): Date[] {
  if (endDate < startDate) {
    return [];
  }

  const dates: Date[] = [];
  const current = new Date(startDate);

  // Normalise to midnight UTC to avoid DST shifts
  current.setUTCHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setUTCHours(23, 59, 59, 999);

  while (current <= end) {
    if (quota !== undefined && dates.length >= quota) {
      break;
    }

    dates.push(new Date(current));
    advance(current, frequency, customDays);
  }

  return dates;
}

function advance(date: Date, frequency: Frequency, customDays?: number): void {
  switch (frequency) {
    case 'daily':
      date.setUTCDate(date.getUTCDate() + 1);
      break;
    case 'weekly':
      date.setUTCDate(date.getUTCDate() + 7);
      break;
    case 'bi-weekly':
      date.setUTCDate(date.getUTCDate() + 14);
      break;
    case 'monthly':
      date.setUTCMonth(date.getUTCMonth() + 1);
      break;
    case 'custom':
      date.setUTCDate(date.getUTCDate() + (customDays || 7));
      break;
  }
}

/**
 * Format a Date to a YYYY-MM-DD string (for the `scheduled_date` column).
 */
export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}
