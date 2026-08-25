import { describe, expect, it } from "vitest"
import { compareBySurname, surnameKey } from "./toc-field"

describe("surnameKey", () => {
  it("takes the family name", () => {
    expect(surnameKey("Matthew Akins")).toBe("akins")
    expect(surnameKey("Xavier Bernthal")).toBe("bernthal")
  })

  it("looks past a suffix", () => {
    expect(surnameKey("Kristopher Kerr Jr")).toBe("kerr")
    expect(surnameKey("John Smith III")).toBe("smith")
  })

  it("copes with a single name", () => {
    expect(surnameKey("Pinky")).toBe("pinky")
  })

  it("does not strip a suffix that is the whole name", () => {
    expect(surnameKey("Jr")).toBe("jr")
  })
})

describe("compareBySurname", () => {
  it("orders a weight class the way the field publishes it", () => {
    const field = [
      { name: "Carson Raper" },
      { name: "Jaxon Thomas" },
      { name: "Liam Myles" },
      { name: "Matthew Akins" },
      { name: "Xavier Bernthal" },
      { name: "Alexander Moody" },
      { name: "Kristopher Kerr Jr" },
      { name: "Tommy Kishpaugh" },
    ]
    expect([...field].sort(compareBySurname).map((a) => a.name)).toEqual([
      "Matthew Akins",
      "Xavier Bernthal",
      "Kristopher Kerr Jr",
      "Tommy Kishpaugh",
      "Alexander Moody",
      "Liam Myles",
      "Carson Raper",
      "Jaxon Thomas",
    ])
  })

  it("falls back to the full name when surnames match", () => {
    const pair = [{ name: "Zach Miller" }, { name: "Adam Miller" }]
    expect([...pair].sort(compareBySurname).map((a) => a.name)).toEqual(["Adam Miller", "Zach Miller"])
  })
})
