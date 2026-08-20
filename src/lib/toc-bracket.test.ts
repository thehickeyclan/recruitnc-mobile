import { describe, expect, it } from "vitest"
import { boutsByRound, connectorSegments, moveInOrder, slotLabel, slotSeed, type BracketDraw } from "./toc-bracket"

const draw: BracketDraw = {
  weightClass: 117,
  format: "8-man-de",
  participants: [
    { athleteId: "a", seed: 1, name: "Matthew Akins", school: null, photoUrl: null, graduationYear: 2028 },
    { athleteId: "b", seed: 2, name: "Xavier Bernthal", school: null, photoUrl: null, graduationYear: 2029 },
    { athleteId: "z", seed: 8, name: "Open spot", school: null, photoUrl: null, graduationYear: null, isPlaceholder: true },
  ],
  bouts: [
    { id: "3", boutNumber: 3, roundLabel: "Winners semifinals", side: "winners", top: { kind: "feeder", boutNumber: 1, label: "Winner of 1" }, bottom: { kind: "empty", label: "TBD" }, winnerAthleteId: null, status: "scheduled" },
    { id: "1", boutNumber: 1, roundLabel: "Round 1", side: "winners", top: { kind: "athlete", athleteId: "a" }, bottom: { kind: "athlete", athleteId: "z" }, winnerAthleteId: null, status: "scheduled" },
    { id: "2", boutNumber: 2, roundLabel: "Round 1", side: "winners", top: { kind: "athlete", athleteId: "b" }, bottom: { kind: "empty", label: "TBD" }, winnerAthleteId: null, status: "scheduled" },
  ],
}

describe("boutsByRound", () => {
  it("orders rounds by when they happen, not by name", () => {
    const rounds = boutsByRound(draw)
    expect(rounds.map((r) => r.round)).toEqual(["Round 1", "Winners semifinals"])
  })

  it("keeps bouts within a round in bout order", () => {
    const [first] = boutsByRound(draw)
    expect(first.bouts.map((b) => b.boutNumber)).toEqual([1, 2])
  })
})

describe("slotLabel", () => {
  it("names a wrestler", () => {
    expect(slotLabel(draw, { kind: "athlete", athleteId: "a" })).toBe("Matthew Akins")
  })

  it("says where a feeder's occupant comes from", () => {
    expect(slotLabel(draw, { kind: "feeder", boutNumber: 1, label: "Winner of 1" })).toBe("Winner of 1")
  })

  it("does not crash on an id that is not in the draw", () => {
    expect(slotLabel(draw, { kind: "athlete", athleteId: "ghost" })).toBe("—")
  })
})

describe("slotSeed", () => {
  it("gives the seed for a real wrestler", () => {
    expect(slotSeed(draw, { kind: "athlete", athleteId: "b" })).toBe(2)
  })

  it("gives none for an open spot, so a placeholder is not shown as seeded", () => {
    expect(slotSeed(draw, { kind: "athlete", athleteId: "z" })).toBeNull()
  })

  it("gives none for a feeder", () => {
    expect(slotSeed(draw, { kind: "feeder", boutNumber: 1, label: "Winner of 1" })).toBeNull()
  })
})

describe("moveInOrder", () => {
  it("moves an item up", () => {
    expect(moveInOrder(["a", "b", "c"], 2, 1)).toEqual(["a", "c", "b"])
  })

  it("moves an item down", () => {
    expect(moveInOrder(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"])
  })

  it("leaves the order alone when the move goes nowhere", () => {
    const items = ["a", "b", "c"]
    expect(moveInOrder(items, 1, 1)).toBe(items)
    expect(moveInOrder(items, 0, -1)).toBe(items)
    expect(moveInOrder(items, 2, 3)).toBe(items)
  })

  it("does not mutate the input", () => {
    const items = ["a", "b", "c"]
    moveInOrder(items, 0, 2)
    expect(items).toEqual(["a", "b", "c"])
  })
})

describe("connectorSegments", () => {
  it("turns an elbow into three rectangles", () => {
    const segs = connectorSegments("M 10 20 H 30 V 60 H 50", 1)
    expect(segs).toEqual([
      { left: 10, top: 20, width: 20, height: 1 },
      { left: 30, top: 20, width: 1, height: 40 },
      { left: 30, top: 60, width: 20, height: 1 },
    ])
  })

  it("handles an elbow that goes upward", () => {
    const segs = connectorSegments("M 10 60 H 30 V 20 H 50", 1)
    expect(segs[1]).toEqual({ left: 30, top: 20, width: 1, height: 40 })
  })

  it("drops a zero-length leg rather than drawing a dot", () => {
    // Same centre line: the vertical leg has no height.
    const segs = connectorSegments("M 10 20 H 30 V 20 H 50", 1)
    expect(segs.some((s) => s.width === 1 && s.height === 0)).toBe(false)
  })

  it("returns nothing for a path it cannot read", () => {
    expect(connectorSegments("nonsense")).toEqual([])
  })
})
