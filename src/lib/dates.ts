// The gym's wall clock. The /regrade cutoff is "calendar days since the set
// went up", so day boundaries must be the gym's, not the server's UTC.
export const GYM_TZ = 'Europe/London'

// Today as YYYY-MM-DD in the gym timezone. en-CA formats as ISO date.
export const todayInGym = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TZ }).format(now)

// Whole calendar days from `from` to `to`, both YYYY-MM-DD.
export const daysBetween = (from: string, to: string): number => {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

// Human display, e.g. "1 Jun 2026".
export const formatDate = (date: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
