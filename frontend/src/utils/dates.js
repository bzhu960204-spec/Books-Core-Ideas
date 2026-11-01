// The day of an ISO date or date-time ("2026-11-01T11:18:01.579" → "2026-11-01").
// Review and explanation edit times are date-times since DB-06; the UI shows the day.
export function isoDay(value) {
  return typeof value === 'string' ? value.slice(0, 10) : '';
}
