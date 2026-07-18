const ET_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * The America/New_York calendar date ("YYYY-MM-DD") for a given instant.
 * Mirrors the SQL `(now() at time zone 'America/New_York')::date` used as
 * `day_key` by `claim_daily_bonus()`, so the client-side localStorage guard
 * and the database agree on when "today" rolls over.
 */
export function etDayKey(instant: Date = new Date()): string {
  return ET_DATE.format(instant);
}
