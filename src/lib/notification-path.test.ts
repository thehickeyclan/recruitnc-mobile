import { describe, expect, it } from "vitest"
import { notificationPath } from "./notification-path"

describe("notificationPath", () => {
  it("follows the path the bracket release alert carries", () => {
    expect(notificationPath({ kind: "toc-brackets", path: "/toc-bracket" })).toBe("/toc-bracket")
  })

  it("follows a family-link alert's path (opened as a signed-in web page)", () => {
    const path = "/family-link/3f2b9c1e-8d4a-4b6f-9e2a-1c5d7f0a9b3e/9f86d081884c7d659a2feaa0c55ad015"
    expect(notificationPath({ kind: "family-link", path })).toBe(path)
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
