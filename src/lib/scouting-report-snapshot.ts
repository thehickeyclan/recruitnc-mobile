// Ported from the website (lib/scouting-report-snapshot.ts) so the app, its PDF and the web report
// show the same snapshot and key facts. Keep the two in step.

import type { ScoutingReport } from "./scouting-report-format"

/**
 * Page one of the scouting report, read in twenty seconds: a row of snapshot figures and a list of
 * key facts. Every value is lifted from a field the report already computes - results, the star
 * rating's own component lines, strength of competition, academics - so nothing here is a second
 * calculation that could disagree with the pages behind it.
 *
 * Labels follow the report's standing rules: never a bare "Ranked" (NC-ranked and nationally
 * ranked are different claims), the NCHSAA State Championships named as such, and a national
 * record always carries its year.
 */

export type SnapshotFigure = { label: string; value: string; sub?: string }

const ORDINAL = /\b(champion)\b|\b(\d{1,2})(st|nd|rd|th)\b/i

/** 1 for "Champion", 4 for "4th", null when the text names no finish. */
export function placeIn(text: string): number | null {
  const m = text.match(ORDINAL)
  if (!m) return null
  return m[1] ? 1 : Number(m[2])
}

function placeWord(place: number): string {
  if (place === 1) return "Champion"
  const suffix = place === 2 ? "nd" : place === 3 ? "rd" : "th"
  return `${place}${suffix}`
}

/** The best finish, newest first on ties, among results whose event matches. */
export function bestFinish(
  results: ScoutingReport["results"],
  event: RegExp,
): { place: number; year: number } | null {
  let best: { place: number; year: number } | null = null
  for (const r of results) {
    if (!event.test(r.event)) continue
    const place = placeIn(r.detail)
    if (place == null) continue
    if (!best || place < best.place || (place === best.place && r.year > best.year)) best = { place, year: r.year }
  }
  return best
}

/** Years he won it, oldest first: three NCHSAA titles are "3x", not the latest one alone. */
export function titleYears(results: ScoutingReport["results"], event: RegExp): number[] {
  return [...new Set(results.filter((r) => event.test(r.event) && placeIn(r.detail) === 1).map((r) => r.year))].sort()
}

const TOC = /tournament of champions/i
const NATIONAL = /^(NHSCA Nationals|Super 32|Journeymen|Beast of the East|Ironman)/i
const NCHSAA = /^NCHSAA State Championships$/i

/** A star-rating part's line by label - "23-8 at national events in 2026". */
export function starPart(report: ScoutingReport, label: string): string | null {
  for (const c of report.starRating?.components ?? []) {
    for (const p of c.parts ?? []) if (p.label === label) return p.detail
  }
  return null
}

/** "23-8 at national events in 2026" -> { record: "23-8", year: "2026" }. */
export function nationalRecord(report: ScoutingReport): { record: string; year: string } | null {
  const line = starPart(report, "National record")
  const m = line?.match(/^(\d+-\d+) at national events in (\d{4})/)
  return m ? { record: m[1], year: m[2] } : null
}

export function snapshotFigures(report: ScoutingReport): SnapshotFigure[] {
  const out: SnapshotFigure[] = []
  const toc = bestFinish(report.results, TOC)
  if (toc) out.push({ label: "TOC", value: placeWord(toc.place), sub: String(toc.year) })
  const state = bestFinish(report.results, NCHSAA)
  const stateTitles = titleYears(report.results, NCHSAA)
  if (stateTitles.length > 1) out.push({ label: "NCHSAA State", value: `${stateTitles.length}x Champion`, sub: stateTitles.join(", ") })
  else if (state) out.push({ label: "NCHSAA State", value: placeWord(state.place), sub: String(state.year) })
  const nat = nationalRecord(report)
  if (nat) out.push({ label: "National record", value: nat.record, sub: nat.year })
  const ranked = report.strengthOfCompetition.rankedWins
  if (ranked.total > 0) {
    const bits = [
      ranked.national ? `${ranked.national} national` : null,
      ranked.stateRanked ? `${ranked.stateRanked} NC-ranked` : null,
      ranked.tocField ? `${ranked.tocField} TOC field` : null,
    ].filter(Boolean)
    out.push({ label: "Wins over ranked", value: String(ranked.total), sub: bits.join(" · ") || undefined })
  }
  if (report.accessTier === "full" && report.academics.gpa) out.push({ label: "GPA", value: report.academics.gpa })
  return out
}

/**
 * The evaluation as a list, ahead of the narrative: what he has done, in the report's own terms.
 */
export function keyFacts(report: ScoutingReport): string[] {
  const facts: string[] = []
  const toc = bestFinish(report.results, TOC)
  if (toc) facts.push(toc.place === 1 ? `Tournament of Champions champion (${toc.year})` : `Tournament of Champions ${placeWord(toc.place)} (${toc.year})`)
  const state = bestFinish(report.results, NCHSAA)
  const stateTitles = titleYears(report.results, NCHSAA)
  if (stateTitles.length > 1) facts.push(`${stateTitles.length}x NCHSAA state champion (${stateTitles.join(", ")})`)
  else if (state) facts.push(state.place === 1 ? `NCHSAA state champion (${state.year})` : `NCHSAA State Championships ${placeWord(state.place)} (${state.year})`)
  const placings = starPart(report, "National placement")
  // Only real placings: the same line carries "4-2 at NHSCA, no place" for a deep run without one.
  if (placings && placeIn(placings) != null && !/no place/i.test(placings)) facts.push(`National placings: ${placings}`)
  else {
    // Unrated classes have no star lines; read the placings from the results instead.
    const fromResults = report.results
      .filter((r) => NATIONAL.test(r.event) && !/\(OF\)/.test(r.event) && (r.style ?? "folkstyle") === "folkstyle")
      .map((r) => ({ r, place: placeIn(r.detail) }))
      .filter((x): x is { r: (typeof report.results)[number]; place: number } => x.place != null && x.place <= 8)
      .sort((a, b) => a.place - b.place || b.r.year - a.r.year)
      .map(({ r, place }) => `${placeWord(place)} at ${r.year} ${r.event}`)
    if (fromResults.length) facts.push(`National placings: ${fromResults.join(" · ")}`)
  }
  const nat = nationalRecord(report)
  if (nat) facts.push(`${nat.record} at national events in ${nat.year}`)
  const ranked = report.strengthOfCompetition.rankedWins
  if (ranked.national) facts.push(`${ranked.national} win${ranked.national === 1 ? "" : "s"} over nationally ranked opponents`)
  if (ranked.stateRanked) facts.push(`${ranked.stateRanked} win${ranked.stateRanked === 1 ? "" : "s"} over NC-ranked opponents`)
  if (report.competition?.styles.length) {
    const names = { folkstyle: "Folkstyle", freestyle: "Freestyle", greco: "Greco-Roman" } as const
    facts.push(`Competes in ${report.competition.styles.map((s) => names[s]).join(" · ")}`)
  }
  if (report.accessTier === "full" && report.academics.gpa) facts.push(`${report.academics.gpa} GPA`)
  return facts
}
