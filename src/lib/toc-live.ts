/**
 * Whether the tournament is under way, which is what the bracket screens call themselves.
 *
 * Before it, the bracket is the draw: "Official Brackets", published Friday at five o'clock the
 * week before. After it, the same screen is a scoreboard, so it reads "Live Brackets" with a green
 * dot beside it.
 *
 * Two triggers, whichever comes first. The clock, because weigh-ins are Friday 4:00–5:00 PM and a
 * wrestler who misses weight changes the bracket before anyone wrestles. And the first recorded
 * result, because a tournament that starts early should not be described as not started.
 *
 * Kept in the app rather than asked for, so a row in a tab does not need a network call to know
 * what to call itself. The results screen has the server's own answer and takes the stronger of
 * the two.
 */
export const TOC_LIVE_FROM = new Date("2026-09-18T17:00:00-04:00")

export function bracketsAreLive(now: Date = new Date(), recordedResults = 0): boolean {
  return recordedResults > 0 || now.getTime() >= TOC_LIVE_FROM.getTime()
}

/** What the bracket screen and its entry points are called right now. */
export function bracketsLabel(live: boolean): string {
  return live ? "Live Brackets" : "Official Brackets"
}
