/** When the official brackets are released in the app. Friday 11 September, 5:00 PM. */
export const SEEDS_ANNOUNCED = "2026-09-11"

/**
 * Whole days from today until an ISO date, in local time. Negative once the date has passed.
 *
 * Both sides are flattened to a UTC midnight before subtracting, so the answer is a count of
 * calendar days rather than of elapsed hours — otherwise a daylight saving change shifts the
 * countdown by one and the screen tells somebody the wrong number of days.
 */
export function daysUntil(iso: string, now = new Date()): number {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const [year, month, day] = iso.split("-").map(Number)
  return Math.round((Date.UTC(year, month - 1, day) - today) / 86_400_000)
}

/** How the wait is described above the fold. */
export function countdownLine(days: number): string {
  if (days > 1) return `${days} days until the brackets drop.`
  if (days === 1) return "The brackets drop tomorrow at 5:00 PM."
  if (days === 0) return "The brackets drop today at 5:00 PM."
  return "The brackets are out — make your picks."
}
