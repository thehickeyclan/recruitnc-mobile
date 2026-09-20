import { describe, expect, it } from "vitest"
import { countdownLine, daysUntil } from "./toc-countdown"

describe("daysUntil", () => {
  it("counts whole days ahead", () => {
    expect(daysUntil("2026-09-11", new Date(2026, 7, 25, 9, 30))).toBe(17)
  })

  it("is zero on the day itself, whatever the hour", () => {
    expect(daysUntil("2026-09-11", new Date(2026, 8, 11, 23, 59))).toBe(0)
  })

  it("goes negative once the date has passed", () => {
    expect(daysUntil("2026-09-11", new Date(2026, 8, 12, 0, 1))).toBe(-1)
  })

  it("does not drift across a daylight saving change", () => {
    // 1 November 2026 is the US fall-back; an hour-based subtraction reads four and a bit days.
    expect(daysUntil("2026-11-05", new Date(2026, 9, 31, 12, 0))).toBe(5)
  })
})

describe("countdownLine", () => {
  // `over` is passed explicitly throughout: it defaults to the real clock, which is past the 2026
  // tournament, so every countdown branch below is only reachable before the next one.
  it("switches from plural to tomorrow to today", () => {
    expect(countdownLine(17, false)).toBe("17 days until the brackets drop.")
    // The time is named from one day out: "tomorrow" without it sends people looking at breakfast.
    expect(countdownLine(1, false)).toBe("The brackets drop tomorrow at 5:00 PM.")
    expect(countdownLine(0, false)).toBe("The brackets drop today at 5:00 PM.")
  })

  it("stops counting down once the brackets are out", () => {
    expect(countdownLine(-3, false)).toContain("make your picks")
  })

  it("stops selling the pool once the tournament is over", () => {
    expect(countdownLine(-9, true)).toBe("Final results are in — every bracket, bout by bout.")
  })
})
