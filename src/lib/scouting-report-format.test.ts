import { describe, expect, it } from "vitest"
import {
  dayLabel,
  groupBouts,
  lastCompetedLine,
  monthLabel,
  movementLabel,
  noBoutsLine,
  statusLine,
  weightProgression,
  type ReportBout,
} from "./scouting-report-format"

describe("dayLabel", () => {
  it("reads the calendar date without crossing a timezone", () => {
    expect(dayLabel("2026-08-23")).toBe("23 Aug 2026")
  })

  it("reads the month/day/year form bout imports use", () => {
    expect(dayLabel("1/16/2026")).toBe("16 Jan 2026")
  })

  it("leaves a value it cannot read alone", () => {
    expect(dayLabel("Spring 2026")).toBe("Spring 2026")
  })
})

describe("monthLabel and movementLabel", () => {
  it("names the edition month", () => {
    expect(monthLabel("2026-09-01")).toBe("Sep 2026")
  })

  it("does not call a single edition a trend", () => {
    expect(movementLabel(null)).toBe("One edition")
    expect(movementLabel(0)).toBe("Unchanged")
    expect(movementLabel(1)).toBe("Up 1 place")
    expect(movementLabel(-3)).toBe("Down 3 places")
  })
})

describe("lastCompetedLine", () => {
  const identity = {
    name: "A",
    photoUrl: null,
    highSchool: null,
    club: null,
    graduationYear: 2028,
    weightClass: "132",
    lastCompetedWeight: "138",
    lastCompetedEvent: "Super 32",
    lastCompetedYear: 2026,
    lastCompetedDate: null,
    collegeWeightClass: null,
  }

  it("falls back to the year when the day is not recorded", () => {
    expect(lastCompetedLine(identity)).toBe("138 lbs · Super 32 · 2026")
  })

  it("is nothing when no weight is on file", () => {
    expect(lastCompetedLine({ ...identity, lastCompetedWeight: null })).toBeNull()
  })
})

describe("weightProgression", () => {
  const row = (year: number, weight: string | null) => ({ event: "E", year, detail: "", date: null, weight })

  it("gives a range per season, never a first-to-last delta", () => {
    expect(weightProgression([row(2025, "215"), row(2025, "220"), row(2026, "285")])).toBe(
      "2025: 215–220 · 2026: 285",
    )
  })

  it("is nothing on a single weight", () => {
    expect(weightProgression([row(2026, "132")])).toBeNull()
  })
})

describe("groupBouts", () => {
  const bout = (reason: ReportBout["reason"]): ReportBout => ({
    opponent: "X",
    opponentSchool: null,
    event: null,
    date: null,
    result: null,
    reason,
  })

  it("keeps national, NC and state standings apart, strongest first", () => {
    const groups = groupBouts([bout("state-placer"), bout("national-ranked"), bout("toc-field")], "win")
    expect(groups.map((g) => g.heading)).toEqual([
      "Wins over nationally ranked opponents",
      "Wins over NC-ranked opponents",
      "Wins over state champions & placers",
    ])
  })

  it("states an empty list rather than leaving it blank", () => {
    expect(groupBouts([], "loss")).toEqual([])
    expect(noBoutsLine("loss")).toMatch(/^No losses/)
  })
})

describe("statusLine", () => {
  it("names the commitment, then the stated status, then uncommitted", () => {
    expect(statusLine({ commitment: "NC State", recruitingStatus: "Open" })).toBe("Committed · NC State")
    expect(statusLine({ commitment: null, recruitingStatus: "Open" })).toBe("Open")
    expect(statusLine({ commitment: null, recruitingStatus: null })).toBe("Uncommitted")
  })
})
