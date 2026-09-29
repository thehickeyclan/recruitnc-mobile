import { describe, expect, it } from "vitest"
import { escapeHtml, pdfFileName, reportHtml } from "./scouting-report-html"
import type { ScoutingReport } from "./scouting-report-format"

function report(overrides: Partial<ScoutingReport> = {}): ScoutingReport {
  return {
    athleteId: "2608f74c-1262-44dd-9097-c990ed3c0166",
    generatedAt: "2026-09-29T16:00:00.000Z",
    identity: {
      name: "Carson Worrick",
      photoUrl: null,
      highSchool: "Davie",
      club: "Combat",
      graduationYear: 2027,
      weightClass: "165",
      lastCompetedWeight: "165",
      lastCompetedEvent: "Tournament of Champions",
      lastCompetedYear: 2026,
      lastCompetedDate: "2026-09-18",
      collegeWeightClass: null,
    },
    contact: { cell: null, email: null, highlightVideoUrl: null, floProfileUrl: null, trackWrestlingProfileUrl: null },
    academics: { gpa: null, sat: null, act: null, academicInterest: null, academicSummary: null },
    membership: { ncUnitedTeam: null, isBlue: false },
    careerRecord: null,
    results: [],
    significantWins: [],
    significantLosses: [],
    seasonStrength: null,
    seasonStrengthSeason: null,
    strengthOfCompetition: {
      rankedWins: { national: 0, tocField: 0, stateRanked: 0, total: 0 },
      credentialedLosses: 0,
      seasonsOnFile: 1,
      grade: { score: 0, band: "red", label: "Untested", verdict: "", factors: [], nextStep: null },
    },
    summary: null,
    recruitingStatus: null,
    commitment: "Binghamton",
    prospectRanking: 1,
    rankingPublished: true,
    nationalRankings: [],
    starRating: null,
    accessTier: "intelligence",
    watermark: null,
    ...overrides,
  }
}

describe("escapeHtml", () => {
  it("neutralises markup in imported names", () => {
    expect(escapeHtml(`Mitchell Co & Ashe Co <b>"Tri"</b>`)).toBe(
      "Mitchell Co &amp; Ashe Co &lt;b&gt;&quot;Tri&quot;&lt;/b&gt;",
    )
  })
})

describe("pdfFileName", () => {
  it("names the file after the wrestler, without characters a file system refuses", () => {
    expect(pdfFileName("Carson Worrick")).toBe("Carson Worrick Scouting Report.pdf")
    expect(pdfFileName('A/B: "C"')).toBe("A B C Scouting Report.pdf")
  })
})

describe("reportHtml", () => {
  it("carries the subject, the ranking chip and the commitment", () => {
    const html = reportHtml(report())
    expect(html).toContain("Carson Worrick")
    expect(html).toContain("NC #1 · Class of 2027")
    expect(html).toContain("Committed · Binghamton")
  })

  it("states every empty section rather than leaving it blank", () => {
    const html = reportHtml(report())
    expect(html).toContain("No tournament results on file.")
    expect(html).toContain("No wins over nationally ranked")
    expect(html).toContain("No losses to nationally ranked")
  })

  it("never puts contact details or academics in an intelligence-tier copy", () => {
    const html = reportHtml(
      report({
        contact: { cell: "555-0100", email: "kid@example.com", highlightVideoUrl: null, floProfileUrl: null, trackWrestlingProfileUrl: null },
        academics: { gpa: "3.9", sat: null, act: null, academicInterest: null, academicSummary: null },
      }),
    )
    // The server already withholds these at this tier; the document must not depend on that alone
    // for its wording.
    expect(html).toContain("Academic records are released to verified college coaching staff.")
    expect(html).not.toContain("3.9")
    expect(html).not.toContain("555-0100")
    expect(html).not.toContain("kid@example.com")
  })

  it("escapes a hostile event name", () => {
    const html = reportHtml(
      report({ results: [{ event: "<script>x</script>", year: 2026, detail: "1st", date: null, weight: null }] }),
    )
    expect(html).not.toContain("<script>x")
    expect(html).toContain("&lt;script&gt;")
  })

  it("prints the recipient watermark on a full-tier copy", () => {
    const html = reportHtml(report({ accessTier: "full", watermark: "Prepared for J. Coach, State U" }))
    expect(html).toContain("Prepared for J. Coach, State U. Contains contact information")
  })
})
