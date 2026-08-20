import { describe, expect, it } from "vitest"
import { directionsUrl, distanceMiles, fitCamera } from "./clubs"

describe("distanceMiles", () => {
  it("is zero for the same point", () => {
    const p = { latitude: 35.78, longitude: -78.64 }
    expect(distanceMiles(p, p)).toBeCloseTo(0, 6)
  })

  it("gets Raleigh to Charlotte about right", () => {
    const miles = distanceMiles(
      { latitude: 35.7796, longitude: -78.6382 },
      { latitude: 35.2271, longitude: -80.8431 },
    )
    // ~130 miles as the crow flies.
    expect(miles).toBeGreaterThan(120)
    expect(miles).toBeLessThan(140)
  })

  it("is symmetric", () => {
    const a = { latitude: 35.78, longitude: -78.64 }
    const b = { latitude: 36.07, longitude: -79.79 }
    expect(distanceMiles(a, b)).toBeCloseTo(distanceMiles(b, a), 6)
  })
})

describe("fitCamera", () => {
  it("falls back to the middle of the state when there is nothing to fit", () => {
    const camera = fitCamera([])
    expect(camera.coordinates.latitude).toBeCloseTo(35.5, 1)
    expect(camera.coordinates.longitude).toBeCloseTo(-79.2, 1)
  })

  it("centres between the extremes", () => {
    const camera = fitCamera([
      { latitude: 34, longitude: -80 },
      { latitude: 36, longitude: -78 },
    ] as never)
    expect(camera.coordinates.latitude).toBeCloseTo(35, 6)
    expect(camera.coordinates.longitude).toBeCloseTo(-79, 6)
  })

  it("zooms out for a wide spread and in for a tight one", () => {
    const wide = fitCamera([
      { latitude: 30, longitude: -85 },
      { latitude: 40, longitude: -75 },
    ] as never)
    const tight = fitCamera([
      { latitude: 35.7, longitude: -78.7 },
      { latitude: 35.8, longitude: -78.6 },
    ] as never)
    expect(wide.zoom).toBeLessThan(tight.zoom)
  })
})

describe("directionsUrl", () => {
  it("sends Apple Maps to the coordinates, labelled with the club", () => {
    const url = directionsUrl({ name: "RAW Wrestling", latitude: 35.78, longitude: -78.64 })
    expect(url).toContain("daddr=35.78,-78.64")
    expect(url).toContain("q=RAW%20Wrestling")
  })

  it("escapes a name that would otherwise break the query", () => {
    const url = directionsUrl({ name: "Kids & Cubs", latitude: 1, longitude: 2 })
    expect(url).toContain("q=Kids%20%26%20Cubs")
  })
})
