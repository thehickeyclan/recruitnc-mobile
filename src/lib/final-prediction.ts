/**
 * The finals tiebreaker: how does the championship match end?
 *
 * Ported from the website's `lib/toc/final-prediction.ts`. The server validates every submission
 * with its own copy, so this one exists to keep the app from offering a prediction the server
 * would reject — the two must agree, and the tests below are the same tests.
 *
 * Points alone tie constantly — early in the tournament almost everyone has the favourites, and
 * two entrants can finish a weight dead level. This asks for the one thing that separates people
 * who actually watch wrestling: not who wins, but how.
 *
 * A method on its own is the guess; a score is only asked for when the method has a score worth
 * guessing. A fall and a tech fall are their own answers.
 */

/** Matches the vocabulary already used for Fargo and duals results, so a method means one thing. */
export const FINAL_METHODS = ["FALL", "TF", "MAJ", "DEC"] as const
export type FinalMethod = (typeof FINAL_METHODS)[number]

export const FINAL_METHOD_LABELS: Record<FinalMethod, string> = {
  FALL: "Pin",
  TF: "Tech fall",
  MAJ: "Major decision",
  DEC: "Decision",
}

/** Only these two are decided by a score the entrant could sensibly name. */
export function methodNeedsScore(method: FinalMethod): boolean {
  return method === "MAJ" || method === "DEC"
}

/**
 * The margins that define each method, so a prediction cannot contradict itself.
 * A decision is a margin of one to seven; a major is eight to fourteen; fifteen is a tech fall.
 */
const MARGIN_RULES: Record<"MAJ" | "DEC", { min: number; max: number }> = {
  DEC: { min: 1, max: 7 },
  MAJ: { min: 8, max: 14 },
}

export type FinalPrediction = {
  method: FinalMethod
  winnerScore: number | null
  loserScore: number | null
}

export type FinalPredictionInput = {
  method?: unknown
  winnerScore?: unknown
  loserScore?: unknown
}

export function parseFinalMethod(raw: unknown): FinalMethod | null {
  const s = String(raw ?? "").trim().toUpperCase().replace(/\./g, "")
  if (!s) return null
  if (/^(FALL|PIN)$/.test(s)) return "FALL"
  if (/^(TF|TECH(\s*FALL)?)$/.test(s)) return "TF"
  if (/^(MAJ|MAJOR(\s*DECISION)?)$/.test(s)) return "MAJ"
  if (/^(DEC|DECISION)$/.test(s)) return "DEC"
  return null
}

/**
 * Validates a prediction, rejecting one that disagrees with itself — "major, 3-1" is not a major,
 * and storing it would produce a tiebreaker nobody could defend when it decided the pool.
 */
export function validateFinalPrediction(
  input: FinalPredictionInput,
): { ok: true; value: FinalPrediction } | { ok: false; error: string } {
  const method = parseFinalMethod(input.method)
  if (!method) return { ok: false, error: "Pick how the final ends." }

  if (!methodNeedsScore(method)) {
    return { ok: true, value: { method, winnerScore: null, loserScore: null } }
  }

  const winnerScore = Number(input.winnerScore)
  const loserScore = Number(input.loserScore)
  if (!Number.isInteger(winnerScore) || !Number.isInteger(loserScore)) {
    return { ok: false, error: "Enter both scores." }
  }
  if (winnerScore < 0 || loserScore < 0) return { ok: false, error: "Scores cannot be negative." }
  if (winnerScore <= loserScore) return { ok: false, error: "The winner's score has to be the higher one." }

  const margin = winnerScore - loserScore
  const rule = method === "MAJ" ? MARGIN_RULES.MAJ : MARGIN_RULES.DEC
  if (margin < rule.min || margin > rule.max) {
    const name = FINAL_METHOD_LABELS[method].toLowerCase()
    return {
      ok: false,
      error: `A ${name} is a margin of ${rule.min}–${rule.max}. That score is a margin of ${margin}.`,
    }
  }

  return { ok: true, value: { method, winnerScore, loserScore } }
}

export type FinalPredictionAccuracy = {
  /** Did they call the method? The first and heaviest question. */
  methodCorrect: boolean
  /** How far off the score was, when a score was asked for and the method was right. */
  scoreError: number | null
}

/** How close one prediction came. `null` actual means the final has not been wrestled yet. */
export function gradeFinalPrediction(
  prediction: FinalPrediction | null,
  actual: FinalPrediction | null,
): FinalPredictionAccuracy {
  if (!prediction || !actual) return { methodCorrect: false, scoreError: null }
  if (prediction.method !== actual.method) return { methodCorrect: false, scoreError: null }
  if (!methodNeedsScore(actual.method)) return { methodCorrect: true, scoreError: null }
  if (
    prediction.winnerScore == null ||
    prediction.loserScore == null ||
    actual.winnerScore == null ||
    actual.loserScore == null
  ) {
    return { methodCorrect: true, scoreError: null }
  }
  return {
    methodCorrect: true,
    scoreError:
      Math.abs(prediction.winnerScore - actual.winnerScore) +
      Math.abs(prediction.loserScore - actual.loserScore),
  }
}

export type TiebreakTotals = {
  /** Finals whose method the entrant called correctly. More is better. */
  methodsCorrect: number
  /** Summed score error across those. Lower is better. */
  scoreError: number
}

export function sumTiebreak(accuracies: FinalPredictionAccuracy[]): TiebreakTotals {
  let methodsCorrect = 0
  let scoreError = 0
  for (const a of accuracies) {
    if (!a.methodCorrect) continue
    methodsCorrect += 1
    scoreError += a.scoreError ?? 0
  }
  return { methodsCorrect, scoreError }
}

/** Sort comparator: more methods called, then closer scores. Negative means `a` places higher. */
export function compareTiebreak(a: TiebreakTotals, b: TiebreakTotals): number {
  if (a.methodsCorrect !== b.methodsCorrect) return b.methodsCorrect - a.methodsCorrect
  return a.scoreError - b.scoreError
}

/** "7-3" / "Pin" — how a prediction reads back to the person who made it. */
export function formatFinalPrediction(prediction: FinalPrediction | null): string {
  if (!prediction) return "—"
  const label = FINAL_METHOD_LABELS[prediction.method]
  if (!methodNeedsScore(prediction.method)) return label
  if (prediction.winnerScore == null || prediction.loserScore == null) return label
  return `${label} ${prediction.winnerScore}-${prediction.loserScore}`
}
