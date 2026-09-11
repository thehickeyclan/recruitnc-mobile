import { describe, expect, it } from "vitest"
import { notificationPath } from "./notification-path"

describe("notificationPath", () => {
  it("follows the path the bracket release alert carries", () => {
    expect(notificationPath({ kind: "toc-brackets", path: "/toc-bracket" })).toBe("/toc-bracket")
  })

  it("ignores an alert with no path", () => {
    expect(notificationPath({ kind: "commit" })).toBeNull()
    expect(notificationPath(undefined)).toBeNull()
  })

  it("never follows anything that is not an in-app path", () => {
    expect(notificationPath({ path: "https://example.com" })).toBeNull()
    expect(notificationPath({ path: "//example.com" })).toBeNull()
    expect(notificationPath({ path: "recruitnc://toc-bracket" })).toBeNull()
    expect(notificationPath({ path: "/toc-bracket?next=https://x" })).toBeNull()
  })
})
