import { describe, expect, it } from "vitest"
import { boutParticipants, championOf, sanitizePicks, simulate, updatePick } from "./bracket-simulation"
import type { BracketDraw } from "./toc-bracket"

/**
 * A four-wrestler double-elimination shape: two first-round bouts, a championship final fed by
 * the winners, and a consolation bout fed by the losers. Small enough to reason about, big
 * enough to cover both sides and the cascade.
 */
const draw: BracketDraw = {
  weightClass: 117,
  format: "4-man-de",
  participants: [
    { athleteId: "a", seed: 1, name: "Akins", school: null, photoUrl: null, graduationYear: null },
    { athleteId: "b", seed: 2, name: "Bernthal", school: null, photoUrl: null, graduationYear: null },
    { athleteId: "c", seed: 3, name: "Kerr", school: null, photoUrl: null, graduationYear: null },
    { athleteId: "d", seed: 4, name: "Myles", school: null, photoUrl: null, graduationYear: null },
    { athleteId: "__toc_open_1", seed: 5, name: "Open spot", school: null, photoUrl: null, graduationYear: null, isPlaceholder: true },
  ],
  bouts: [
    { id: "1", boutNumber: 1, roundLabel: "Round 1", side: "winners", top: { kind: "athlete", athleteId: "a" }, bottom: { kind: "athlete", athleteId: "d" }, winnerAthleteId: null, status: "scheduled" },
    { id: "2", boutNumber: 2, roundLabel: "Round 1", side: "winners", top: { kind: "athlete", athleteId: "b" }, bottom: { kind: "athlete", athleteId: "c" }, winnerAthleteId: null, status: "scheduled" },
    { id: "3", boutNumber: 3, roundLabel: "Championship", side: "winners", top: { kind: "feeder", boutNumber: 1, label: "Winner of 1" }, bottom: { kind: "feeder", boutNumber: 2, label: "Winner of 2" }, winnerAthleteId: null, status: "scheduled" },
    { id: "4", boutNumber: 4, roundLabel: "Consolation", side: "losers", top: { kind: "feeder", boutNumber: 1, label: "Loser of 1" }, bottom: { kind: "feeder", boutNumber: 2, label: "Loser of 2" }, winnerAthleteId: null, status: "scheduled" },
  ],
}

describe("boutParticipants", () => {
  it("fills the final from the winners once both are picked", () => {
    const picks = { 1: "a", 2: "b" }
    expect(boutParticipants(draw, picks, 3)).toEqual(["a", "b"])
  })

  it("fills the consolation from the losers — the other side matters too", () => {
    const picks = { 1: "a", 2: "b" }
    expect(boutParticipants(draw, picks, 4)).toEqual(["d", "c"])
  })

  it("leaves a later bout empty until its feeders are decided", () => {
    expect(boutParticipants(draw, { 1: "a" }, 3)).toEqual(["a"])
    expect(boutParticipants(draw, {}, 3)).toEqual([])
  })
})

describe("updatePick", () => {
  it("records a winner", () => {
    expect(updatePick(draw, {}, 1, "a")).toEqual({ 1: "a" })
  })

  it("tapping the same wrestler again clears it, so a tap is its own undo", () => {
    expect(updatePick(draw, { 1: "a" }, 1, "a")).toEqual({})
  })

  it("refuses a wrestler who is not in that bout", () => {
    expect(updatePick(draw, {}, 1, "b")).toEqual({})
  })

  it("drops downstream picks when an earlier result changes", () => {
    // a beats d, b beats c, then a wins the final.
    const picks = { 1: "a", 2: "b", 3: "a" }
    // Change bout 1 so d advances instead: the final pick for a is now impossible.
    const next = updatePick(draw, picks, 1, "d")
    expect(next[1]).toBe("d")
    expect(next[3]).toBeUndefined()
    // And the consolation pick follows the same rule.
    expect(next[4]).toBeUndefined()
  })
})

describe("sanitizePicks", () => {
  it("removes a pick for someone no longer in the bout", () => {
    expect(sanitizePicks(draw, { 1: "a", 3: "b" })).toEqual({ 1: "a" })
  })
})

describe("simulate", () => {
  it("resolves feeders into real wrestlers on both sides", () => {
    const out = simulate(draw, { 1: "a", 2: "b" })
    const final = out.bouts.find((b) => b.boutNumber === 3)!
    const cons = out.bouts.find((b) => b.boutNumber === 4)!
    expect(final.top).toEqual({ kind: "athlete", athleteId: "a" })
    expect(final.bottom).toEqual({ kind: "athlete", athleteId: "b" })
    expect(cons.top).toEqual({ kind: "athlete", athleteId: "d" })
    expect(cons.bottom).toEqual({ kind: "athlete", athleteId: "c" })
  })

  it("marks picked bouts complete and leaves the rest scheduled", () => {
    const out = simulate(draw, { 1: "a" })
    expect(out.bouts.find((b) => b.boutNumber === 1)!.status).toBe("complete")
    expect(out.bouts.find((b) => b.boutNumber === 3)!.status).toBe("scheduled")
  })

  it("does not mutate the draw it was given", () => {
    simulate(draw, { 1: "a", 2: "b" })
    expect(draw.bouts.find((b) => b.boutNumber === 3)!.top).toEqual({
      kind: "feeder",
      boutNumber: 1,
      label: "Winner of 1",
    })
  })
})

describe("championOf", () => {
  it("names the champion once the final is picked", () => {
    expect(championOf(draw, { 1: "a", 2: "b", 3: "b" })).toBe("b")
  })

  it("is null until the final is decided", () => {
    expect(championOf(draw, { 1: "a", 2: "b" })).toBeNull()
  })
})

describe("placeholders", () => {
  const bye: BracketDraw = {
    ...draw,
    bouts: [
      { id: "1", boutNumber: 1, roundLabel: "Round 1", side: "winners", top: { kind: "athlete", athleteId: "a" }, bottom: { kind: "athlete", athleteId: "__toc_open_1" }, winnerAthleteId: null, status: "scheduled" },
      { id: "3", boutNumber: 3, roundLabel: "Championship", side: "winners", top: { kind: "feeder", boutNumber: 1, label: "Winner of 1" }, bottom: { kind: "empty", label: "TBD" }, winnerAthleteId: null, status: "scheduled" },
      { id: "4", boutNumber: 4, roundLabel: "Consolation", side: "losers", top: { kind: "feeder", boutNumber: 1, label: "Loser of 1" }, bottom: { kind: "empty", label: "TBD" }, winnerAthleteId: null, status: "scheduled" },
    ],
  }

  it("advances a wrestler through an open spot without asking for a pick", () => {
    expect(boutParticipants(bye, {}, 3)).toEqual(["a"])
  })

  it("sends nobody to consolation from a bye — there is no loser", () => {
    expect(boutParticipants(bye, {}, 4)).toEqual([])
  })
})

/**
 * The shape a nine-man weight makes around the pigtail. Bout 1 is the top seed with a bye, so it
 * has no loser at all; bout 16 pairs that absent loser with the pigtail loser and passes him
 * through; bout 21 is where he should turn up.
 */
const nineMan: BracketDraw = {
  weightClass: 133,
  format: "8-man-de",
  participants: [
    { athleteId: "s1", seed: 1, name: "Top", school: null, photoUrl: null, graduationYear: null },
    { athleteId: "s8", seed: 8, name: "Mathon", school: null, photoUrl: null, graduationYear: null },
    { athleteId: "s9", seed: 9, name: "Cross", school: null, photoUrl: null, graduationYear: null },
  ],
  bouts: [
    { id: "1", boutNumber: 1, roundLabel: "Preliminary", side: "winners", top: { kind: "athlete", athleteId: "s1" }, bottom: { kind: "empty" }, winnerAthleteId: null, status: "scheduled" },
    { id: "2", boutNumber: 2, roundLabel: "Preliminary", side: "winners", top: { kind: "athlete", athleteId: "s9" }, bottom: { kind: "athlete", athleteId: "s8" }, winnerAthleteId: null, status: "scheduled" },
    { id: "16", boutNumber: 16, roundLabel: "Consolation R1", side: "losers", top: { kind: "feeder", boutNumber: 1, label: "Loser Bout 1" }, bottom: { kind: "feeder", boutNumber: 2, label: "Loser Bout 2" }, winnerAthleteId: null, status: "scheduled" },
    { id: "21", boutNumber: 21, roundLabel: "Consolation R2", side: "losers", top: { kind: "feeder", boutNumber: 12, label: "Loser Bout 12" }, bottom: { kind: "feeder", boutNumber: 16, label: "Winner Bout 16" }, winnerAthleteId: null, status: "scheduled" },
  ],
}

describe("nine-man consolation", () => {
  it("drops the pigtail loser into consolation as soon as the pigtail is picked", () => {
    expect(boutParticipants(nineMan, { 2: "s8" }, 21)).toContain("s9")
  })

  it("keeps the pigtail winner out of consolation", () => {
    expect(boutParticipants(nineMan, { 2: "s8" }, 21)).not.toContain("s8")
  })

  it("leaves consolation empty until the pigtail is picked", () => {
    expect(boutParticipants(nineMan, {}, 21)).toEqual([])
  })
})
