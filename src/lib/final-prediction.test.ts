import { describe, expect, it } from "vitest"
import {
  compareTiebreak,
  formatFinalPrediction,
  gradeFinalPrediction,
  parseFinalMethod,
  sumTiebreak,
  validateFinalPrediction,
} from "./final-prediction"

describe("parseFinalMethod", () => {
  it("takes the words people actually type", () => {
    expect(parseFinalMethod("pin")).toBe("FALL")
    expect(parseFinalMethod("Fall")).toBe("FALL")
    expect(parseFinalMethod("tech fall")).toBe("TF")
    expect(parseFinalMethod("Maj.")).toBe("MAJ")
    expect(parseFinalMethod("decision")).toBe("DEC")
  })

  it("rejects anything else rather than guessing", () => {
    expect(parseFinalMethod("forfeit")).toBeNull()
    expect(parseFinalMethod("")).toBeNull()
  })
})

describe("validateFinalPrediction", () => {
  it("asks for no score on a pin or a tech fall", () => {
    const pin = validateFinalPrediction({ method: "FALL" })
    expect(pin).toEqual({ ok: true, value: { method: "FALL", winnerScore: null, loserScore: null } })
    expect(validateFinalPrediction({ method: "TF" }).ok).toBe(true)
  })

  it("takes a decision inside its margin", () => {
    const r = validateFinalPrediction({ method: "DEC", winnerScore: 7, loserScore: 3 })
    expect(r).toEqual({ ok: true, value: { method: "DEC", winnerScore: 7, loserScore: 3 } })
  })

  it("refuses a score that contradicts the method", () => {
    // A margin of 2 is a decision, whatever the entrant selected.
    const r = validateFinalPrediction({ method: "MAJ", winnerScore: 3, loserScore: 1 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain("margin of 8–14")
  })

  it("refuses a decision that is really a major", () => {
    expect(validateFinalPrediction({ method: "DEC", winnerScore: 12, loserScore: 1 }).ok).toBe(false)
  })

  it("refuses a winner who scored fewer points than the loser", () => {
    expect(validateFinalPrediction({ method: "DEC", winnerScore: 2, loserScore: 5 }).ok).toBe(false)
  })

  it("needs both numbers when the method has a score", () => {
    expect(validateFinalPrediction({ method: "DEC", winnerScore: 7 }).ok).toBe(false)
  })
})

describe("gradeFinalPrediction", () => {
  const actualDec = { method: "DEC" as const, winnerScore: 7, loserScore: 3 }

  it("gives nothing for the wrong method", () => {
    expect(gradeFinalPrediction({ method: "FALL", winnerScore: null, loserScore: null }, actualDec)).toEqual({
      methodCorrect: false,
      scoreError: null,
    })
  })

  it("scores the method, then how far off the score was", () => {
    expect(gradeFinalPrediction({ method: "DEC", winnerScore: 6, loserScore: 4 }, actualDec)).toEqual({
      methodCorrect: true,
      scoreError: 2,
    })
  })

  it("is a clean hit when the score is exact", () => {
    expect(gradeFinalPrediction({ method: "DEC", winnerScore: 7, loserScore: 3 }, actualDec)).toEqual({
      methodCorrect: true,
      scoreError: 0,
    })
  })

  it("has no score to compare on a pin", () => {
    const pin = { method: "FALL" as const, winnerScore: null, loserScore: null }
    expect(gradeFinalPrediction(pin, pin)).toEqual({ methodCorrect: true, scoreError: null })
  })

  it("grades nothing before the final is wrestled", () => {
    expect(gradeFinalPrediction({ method: "DEC", winnerScore: 7, loserScore: 3 }, null).methodCorrect).toBe(false)
  })
})

describe("compareTiebreak", () => {
  it("puts the entrant who called more finals ahead", () => {
    expect(compareTiebreak({ methodsCorrect: 3, scoreError: 20 }, { methodsCorrect: 2, scoreError: 0 })).toBeLessThan(0)
  })

  it("breaks a level count on the closer scores", () => {
    expect(compareTiebreak({ methodsCorrect: 2, scoreError: 1 }, { methodsCorrect: 2, scoreError: 6 })).toBeLessThan(0)
  })

  it("leaves two identical records tied", () => {
    expect(compareTiebreak({ methodsCorrect: 2, scoreError: 4 }, { methodsCorrect: 2, scoreError: 4 })).toBe(0)
  })
})

describe("sumTiebreak", () => {
  it("counts only the finals whose method was right", () => {
    expect(
      sumTiebreak([
        { methodCorrect: true, scoreError: 2 },
        { methodCorrect: false, scoreError: null },
        { methodCorrect: true, scoreError: null },
      ]),
    ).toEqual({ methodsCorrect: 2, scoreError: 2 })
  })
})

describe("formatFinalPrediction", () => {
  it("reads back the way it was entered", () => {
    expect(formatFinalPrediction({ method: "DEC", winnerScore: 7, loserScore: 3 })).toBe("Decision 7-3")
    expect(formatFinalPrediction({ method: "FALL", winnerScore: null, loserScore: null })).toBe("Pin")
    expect(formatFinalPrediction(null)).toBe("—")
  })
})
