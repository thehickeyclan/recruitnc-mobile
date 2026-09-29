import { describe, expect, it } from "vitest"
import { handoffUrl } from "./web-handoff-url"

describe("handoffUrl", () => {
  it("carries the token in the fragment, not the query string", () => {
    const url = new URL(handoffUrl("https://app.example.com/", "/view-profile?id=abc", "tok", "user-1"))
    expect(url.pathname).toBe("/auth/app-handoff")
    expect(url.search).toBe("")
    const fragment = new URLSearchParams(url.hash.slice(1))
    expect(fragment.get("t")).toBe("tok")
    expect(fragment.get("u")).toBe("user-1")
    expect(fragment.get("next")).toBe("/view-profile?id=abc")
  })
})
