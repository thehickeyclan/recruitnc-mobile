import { boutParticipants, type SimulationPicks } from "./bracket-simulation"
import type { BracketDraw } from "./toc-bracket"

/**
 * How each of your picks is holding up once real results start landing.
 *
 * A TOC Madness bracket used to look identical on Saturday night to the way it looked on Tuesday:
 * the screen drew your picks and never learned what actually happened. Points appeared on the
 * leaderboard, but nothing on your own bracket said which of them you got.
 *
 * Four states, because three of them are not the same kind of wrong:
 * - `correct` — the bout is in and you had it.
 * - `wrong` — the bout is in and you did not.
 * - `dead` — the bout has not been wrestled, but the wrestler you picked cannot be in it. Out on
 *   two losses, or the bout's two wrestlers are already known and yours is not one of them.
 * - `pending` — still to come, still possible.
 *
 * Pure so the rules can be tested without a tournament.
 */
export type PickVerdict = "correct" | "wrong" | "dead" | "pending"

/** Out of the tournament: double elimination, so two losses and you are done. */
export function eliminatedAthletes(draw: BracketDraw, results: SimulationPicks): Set<string> {
  const losses = new Map<string, number>()

  for (const bout of draw.bouts) {
    const winner = results[bout.boutNumber]
    if (!winner) continue
    for (const athleteId of boutParticipants(draw, results, bout.boutNumber)) {
      if (athleteId !== winner) losses.set(athleteId, (losses.get(athleteId) ?? 0) + 1)
    }
  }

  return new Set([...losses.entries()].filter(([, count]) => count >= 2).map(([athleteId]) => athleteId))
}

/**
 * A pick that cannot come true yet has not been beaten head to head.
 *
 * Picking someone for a final they can no longer reach is the common case: they lost a semifinal,
 * they are still alive in consolation, so they are not eliminated — but that final now has two
 * known wrestlers and neither is yours.
 */
function cannotReach(draw: BracketDraw, results: SimulationPicks, boutNumber: number, pick: string): boolean {
  const actual = boutParticipants(draw, results, boutNumber)
  return actual.length === 2 && !actual.includes(pick)
}

export function pickVerdicts(
  draw: BracketDraw,
  results: SimulationPicks,
  picks: SimulationPicks,
): Record<number, PickVerdict> {
  const verdicts: Record<number, PickVerdict> = {}
  const gone = eliminatedAthletes(draw, results)

  for (const bout of draw.bouts) {
    const pick = picks[bout.boutNumber]
    if (!pick) continue

    const official = results[bout.boutNumber]
    if (official) {
      verdicts[bout.boutNumber] = official === pick ? "correct" : "wrong"
      continue
    }

    verdicts[bout.boutNumber] =
      gone.has(pick) || cannotReach(draw, results, bout.boutNumber, pick) ? "dead" : "pending"
  }

  return verdicts
}

/** Right, wrong and still alive — the line above a weight's bracket. */
export function verdictTally(verdicts: Record<number, PickVerdict>): {
  correct: number
  wrong: number
  dead: number
  pending: number
} {
  const tally = { correct: 0, wrong: 0, dead: 0, pending: 0 }
  for (const verdict of Object.values(verdicts)) tally[verdict] += 1
  return tally
}
