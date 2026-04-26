import { addDays, addMonths, addQuarters, addYears, parseISO, format } from "date-fns";

/**
 * Compute the next occurrence date for a recurring item.
 *
 * AUD-DD-BILL-007 / AUD-DD-BILL-008 — uses date-fns/addMonths,
 * addYears, etc. which clamp to the last valid day of the target
 * month. Raw `Date.setMonth` arithmetic was overflowing on month-end:
 *
 *   Jan 31 + 1 month → Mar 3   (wrong)
 *   Jan 31 + 1 month → Feb 28  (correct, what date-fns produces)
 *   Feb 29 + 1 year  → Mar 1   (wrong)
 *   Feb 29 + 1 year  → Feb 28  (correct)
 *
 * Lives in its own module (instead of inside recurringScheduler.ts)
 * so unit tests can import it without dragging in `db` and forcing
 * `DATABASE_URL` to be set in the test environment.
 *
 * @param currentDate - ISO-format date (YYYY-MM-DD) or full ISO timestamp
 * @param frequency - 'weekly' | 'monthly' | 'quarterly' | 'yearly';
 *                    anything else is treated as monthly
 * @returns the next date in YYYY-MM-DD format
 */
export function computeNextDate(currentDate: string, frequency: string): string {
  const parsed = currentDate.length === 10
    ? parseISO(`${currentDate}T00:00:00.000Z`)
    : parseISO(currentDate);
  let next: Date;
  switch (frequency) {
    case 'weekly':
      next = addDays(parsed, 7);
      break;
    case 'monthly':
      next = addMonths(parsed, 1);
      break;
    case 'quarterly':
      next = addQuarters(parsed, 1);
      break;
    case 'yearly':
      next = addYears(parsed, 1);
      break;
    default:
      next = addMonths(parsed, 1);
  }
  return format(next, 'yyyy-MM-dd');
}
