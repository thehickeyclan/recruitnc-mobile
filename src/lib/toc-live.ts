/**
 * Which of its three lives the tournament is in, which is what the bracket screens call themselves.
 *
 * Before it starts, the bracket is the draw: "Official Brackets", published Friday at five o'clock
 * the week before. While it runs, the same screen is a scoreboard, so it reads "Live Brackets" with
 * a green dot beside it. Afterwards it is the record — "Results & Brackets", no dot and nothing
 * refreshing, because a green dot on a tournament that finished on Saturday is a lie the app keeps
 * telling every day until somebody ships a fix.
 *
 * Going live has two triggers, whichever comes first. The clock, because weigh-ins are Friday
 * 4:00–5:00 PM and a wrestler who misses weight changes the bracket before anyone wrestles. And the
 * first recorded result, because a tournament that starts early should not be described as not
 * started. Being over has one: the clock, an hour after the last mat could plausibly still be
 * running. A recorded result cannot argue with it — after the weekend every weight has results, so
 * a results-based rule would hold the app live forever.
 *
 * Kept in the app rather than asked for, so a row in a tab does not need a network call to know
 * what to call itself. The results screen has the server's own answer and can go live early on it,
 * but cannot stay live on it.
 */
export const TOC_LIVE_FROM = new Date("2026-09-18T17:00:00-04:00")

/** Saturday night, the finals long since wrestled and the floor being swept. */
export const TOC_ENDED = new Date("2026-09-19T22:00:00-04:00")

export type TocPhase = "draw" | "live" | "final"

export function tocPhase(now: Date = new Date(), recordedResults = 0, serverSaysLive = false): TocPhase {
  if (now.getTime() >= TOC_ENDED.getTime()) return "final"
  if (serverSaysLive || recordedResults > 0 || now.getTime() >= TOC_LIVE_FROM.getTime()) return "live"
  return "draw"
}

export function bracketsAreLive(now: Date = new Date(), recordedResults = 0): boolean {
  return tocPhase(now, recordedResults) === "live"
}

/** Whether the tournament is behind us, which is what most of the app's copy now hangs on. */
export function tocIsOver(now: Date = new Date()): boolean {
  return tocPhase(now) === "final"
}

/** What the bracket screen and its entry points are called right now. */
export function bracketsLabel(phase: TocPhase): string {
  if (phase === "live") return "Live Brackets"
  if (phase === "final") return "Results & Brackets"
  return "Official Brackets"
}
