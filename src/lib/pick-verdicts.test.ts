import { describe, expect, it } from "vitest"
import { eliminatedAthletes, pickVerdicts, verdictTally } from "./pick-verdicts"
import type { BracketDraw } from "./toc-bracket"

/**
 * A four-man double-elimination shape: two semifinals, a final off the winners, a consolation off
 * the losers, and a third-place bout. Small enough to reason about, big enough to have the case
 * that matters — a wrestler who loses a semifinal is still in the tournament but can never reach
 * the final.
 */
const draw: BracketDraw = {
  weightClass: 117,
  format: "4-man-de",
  participants: [
    { athleteId: "a", seed: 1, name: "Ada", school: null, photoUrl: null, graduationYear: null },
    { athleteId: "b", seed: 4, name: "Bo", school: null, photoUrl: null, graduationYear: null },
    { athleteId: "c", seed: 3, name: "Cy", school: null, photoUrl: null, graduationYear: null },
    { athleteId: "d", seed: 2, name: "Dee", school: null, photoUrl: null, graduationYear: null },
  ],
  bouts: [
    {
      id: "b1", boutNumber: 1, roundLabel: "Semifinals", side: "winners", status: "scheduled", winnerAthleteId: null,
      top: { kind: "athlete", athleteId: "a" }, bottom: { kind: "athlete", athleteId: "b" },
    },
    {
      id: "b2", boutNumber: 2, roundLabel: "Semifinals", side: "winners", status: "scheduled", winnerAthleteId: null,
      top: { kind: "athlete", athleteId: "c" }, bottom: { kind: "athlete", athleteId: "d" },
    },
    {
      id: "b3", boutNumber: 3, roundLabel: "Championship", side: "placement", status: "scheduled", winnerAthleteId: null,
      top: { kind: "feeder", boutNumber: 1, label: "Winner Bout 1" },
      bottom: { kind: "feeder", boutNumber: 2, label: "Winner Bout 2" },
    },
    {
      id: "b4", boutNumber: 4, roundLabel: "3rd place", side: "placement", status: "scheduled", winnerAthleteId: null,
      top: { kind: "feeder", boutNumber: 1, label: "Loser Bout 1" },
      bottom: { kind: "feeder", boutNumber: 2, label: "Loser Bout 2" },
    },
  ],
}

describe("pickVerdicts", () => {
  it("marks a pick right or wrong once the bout is in", () => {
    const verdicts = pickVerdicts(draw, { 1: "a" }, { 1: "a", 2: "d" })
    expect(verdicts[1]).toBe("correct")
    // Bout 2 has not been wrestled, so it is still open.
    expect(verdicts[2]).toBe("pending")

    expect(pickVerdicts(draw, { 1: "a" }, { 1: "b" })[1]).toBe("wrong")
  })

  it("leaves bouts nobody picked out of the tally entirely", () => {
    expect(pickVerdicts(draw, { 1: "a" }, {})).toEqual({})
  })

  it("kills a pick whose wrestler can no longer reach that bout", () => {
    // Ada and Dee won their semifinals, so the final is Ada v Dee. Anyone who picked Bo to win it
    // is out of luck, even though Bo is still alive in the consolation round.
    const verdicts = pickVerdicts(draw, { 1: "a", 2: "d" }, { 3: "b" })
    expect(verdicts[3]).toBe("dead")
  })

  it("keeps a pick alive while their bout is still reachable", () => {
    // Only the first semifinal is in: the final's other half is undecided, so picking Ada stands.
    expect(pickVerdicts(draw, { 1: "a" }, { 3: "a" })[3]).toBe("pending")
  })

  it("kills every remaining pick on a wrestler who has lost twice", () => {
    // Bo lost the semifinal and the consolation: two losses, out.
    const results = { 1: "a", 2: "d", 4: "c" }
    expect([...eliminatedAthletes(draw, results)]).toContain("b")
    expect(pickVerdicts(draw, results, { 3: "b" })[3]).toBe("dead")
  })

  it("does not eliminate a wrestler on one loss", () => {
    expect([...eliminatedAthletes(draw, { 1: "a" })]).not.toContain("b")
  })
})

describe("verdictTally", () => {
  it("counts each kind for the line above the bracket", () => {
    expect(verdictTally({ 1: "correct", 2: "correct", 3: "wrong", 4: "dead" })).toEqual({
      correct: 2,
      wrong: 1,
      dead: 1,
      pending: 0,
    })
  })
})
