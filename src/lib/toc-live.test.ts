import { describe, expect, it } from "vitest"
import { bracketsAreLive, bracketsLabel, TOC_LIVE_FROM } from "./toc-live"

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
    expect(bracketsAreLive(minutesAfter(60 * 30), 42)).toBe(true)
  })
})

describe("bracketsLabel", () => {
  it("names the screen for what it is", () => {
    expect(bracketsLabel(false)).toBe("Official Brackets")
    expect(bracketsLabel(true)).toBe("Live Brackets")
  })
})
