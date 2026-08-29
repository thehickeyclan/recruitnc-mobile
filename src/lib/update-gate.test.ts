import { describe, expect, it } from "vitest"
import { shouldWaitForUpdate } from "./update-gate"

describe("shouldWaitForUpdate", () => {
  const state = (over: Partial<Parameters<typeof shouldWaitForUpdate>[0]> = {}) => ({
    isEnabled: true,
    isEmbeddedLaunch: true,
    isDevelopment: false,
    ...over,
  })

  it("waits on the launch that is running the bundle baked into the binary", () => {
    expect(shouldWaitForUpdate(state())).toBe(true)
  })

  it("does not wait once an update has been applied", () => {
    expect(shouldWaitForUpdate(state({ isEmbeddedLaunch: false }))).toBe(false)
  })

  it("never waits in development, where there are no updates to fetch", () => {
    expect(shouldWaitForUpdate(state({ isDevelopment: true }))).toBe(false)
    // Even on an embedded launch with updates switched on.
    expect(shouldWaitForUpdate(state({ isDevelopment: true, isEnabled: true }))).toBe(false)
  })

  it("does not wait when updates are switched off entirely", () => {
    expect(shouldWaitForUpdate(state({ isEnabled: false }))).toBe(false)
  })
})
