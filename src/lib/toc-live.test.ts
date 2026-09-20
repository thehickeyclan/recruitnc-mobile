import { describe, expect, it } from "vitest"
import { bracketsAreLive, bracketsLabel, tocIsOver, tocPhase, TOC_ENDED, TOC_LIVE_FROM } from "./toc-live"

const minutesBefore = (n: number) => new Date(TOC_LIVE_FROM.getTime() - n * 60_000)
const minutesAfter = (n: number) => new Date(TOC_LIVE_FROM.getTime() + n * 60_000)

describe("bracketsAreLive", () => {
  it("is the draw until weigh-ins are done", () => {
    expect(bracketsAreLive(minutesBefore(60))).toBe(false)
    expect(bracketsAreLive(minutesBefore(1))).toBe(false)
  })

  it("goes live once weigh-ins close, before any bout is recorded", () => {
    expect(bracketsAreLive(TOC_LIVE_FROM)).toBe(true)
    expect(bracketsAreLive(minutesAfter(1))).toBe(true)
  })

  it("goes live early if the mats start ahead of the clock", () => {
    expect(bracketsAreLive(minutesBefore(90), 1)).toBe(true)
  })

  it("stays live for the rest of the weekend", () => {
    expect(bracketsAreLive(minutesAfter(60 * 24), 42)).toBe(true)
  })

  it("is not live once the tournament is over, however many results there are", () => {
    // The whole point of the second boundary: every weight has results afterwards, so results on
    // their own must not be able to hold the app live.
    expect(bracketsAreLive(TOC_ENDED, 176)).toBe(false)
    expect(bracketsAreLive(new Date(TOC_ENDED.getTime() + 86_400_000), 176)).toBe(false)
  })
})

describe("tocPhase", () => {
  it("walks draw → live → final", () => {
    expect(tocPhase(minutesBefore(1))).toBe("draw")
    expect(tocPhase(minutesAfter(1))).toBe("live")
    expect(tocPhase(new Date(TOC_ENDED.getTime() + 1))).toBe("final")
  })

  it("lets the server start it early but not keep it running", () => {
    expect(tocPhase(minutesBefore(120), 0, true)).toBe("live")
    expect(tocPhase(new Date(TOC_ENDED.getTime() + 60_000), 0, true)).toBe("final")
  })
})

describe("tocIsOver", () => {
  it("turns over at the end of Saturday night", () => {
    expect(tocIsOver(new Date(TOC_ENDED.getTime() - 60_000))).toBe(false)
    expect(tocIsOver(TOC_ENDED)).toBe(true)
  })
})

describe("bracketsLabel", () => {
  it("names the screen for what it is", () => {
    expect(bracketsLabel("draw")).toBe("Official Brackets")
    expect(bracketsLabel("live")).toBe("Live Brackets")
    expect(bracketsLabel("final")).toBe("Results & Brackets")
  })
})
