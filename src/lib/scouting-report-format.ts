/**
 * The scouting report's shape and the wording rules the web document uses, for the native screen.
 *
 * The types mirror `ScoutingReport` in the website's lib/scouting-report.ts — only the fields the
 * screen draws. The helpers are ported rather than reinvented because each one encodes a mistake
 * the web report already made once (a date a day early, a one-edition ranking read as flat, a
 * weight "up 115 lbs"). Kept free of react-native imports so they can be tested.
 */

export type BoutReason = "national-ranked" | "toc-field" | "ranked" | "state-champion" | "state-placer"

export type ReportBout = {
  opponent: string
  opponentSchool: string | null
  event: string | null
  date: string | null
  result: string | null
  reason: BoutReason
  stateLabel?: string
  nationalRankLabel?: string
}

export type ReportResultRow = { event: string; year: number; detail: string; date: string | null; weight: string | null }

export type ScoutingReport = {
  athleteId: string
  generatedAt: string
  identity: {
    name: string
    photoUrl: string | null
    highSchool: string | null
    club: string | null
    graduationYear: number | null
    weightClass: string | null
    lastCompetedWeight: string | null
    lastCompetedEvent: string | null
    lastCompetedYear: number | null
    lastCompetedDate: string | null
    collegeWeightClass: string | null
  }
  contact: {
    cell: string | null
    email: string | null
    highlightVideoUrl: string | null
    floProfileUrl: string | null
    trackWrestlingProfileUrl: string | null
  }
  academics: {
    gpa: string | null
    sat: string | null
    act: string | null
    academicInterest: string | null
    academicSummary: string | null
  }
  membership: { ncUnitedTeam: string | null; isBlue: boolean }
  careerRecord: string | null
  results: ReportResultRow[]
  significantWins: ReportBout[]
  significantLosses: ReportBout[]
  seasonStrength: { bouts: number; wins: number; losses: number } | null
  seasonStrengthSeason: string | null
  strengthOfCompetition: {
    rankedWins: { national: number; tocField: number; stateRanked: number; total: number }
    credentialedLosses: number
    seasonsOnFile: number
    grade: {
      score: number
      band: "red" | "orange" | "amber" | "green"
      label: string
      verdict: string
      factors: { key: string; label: string; points: number; detail: string }[]
      nextStep: string | null
    }
  }
  summary: string | null
  recruitingStatus: string | null
  commitment: string | null
  prospectRanking: number | null
  rankingPublished: boolean
  nationalRankings: {
    source: string
    sourceLabel: string
    editions: { rankingMonth: string; rank: number }[]
    current: number
    movement: number | null
  }[]
  starRating: {
    stars: number
    score: number
    provisional: boolean
    components: { key: string; label: string; points: number; max: number; detail: string }[]
  } | null
  accessTier: "intelligence" | "full"
  watermark: string | null
}

/**
 * "14 Sep 2026", or the raw value if it is not a date we can read.
 *
 * A bare "2026-08-23" handed to `new Date` is UTC midnight, still the 22nd everywhere in the US,
 * so the parts are read directly and never cross a timezone. Bout imports also arrive as
 * "1/16/2026", which the web report formats and this must too, or one list mixes both styles.
 */
export function dayLabel(value: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const ymd = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  const mdy = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const [year, month, day] = ymd ? [ymd[1], ymd[2], ymd[3]] : mdy ? [mdy[3], mdy[1], mdy[2]] : []
  const name = month ? months[Number(month) - 1] : undefined
  return name && day ? `${Number(day)} ${name} ${year}` : value
}

/** "Sep 2026" — the outlet's edition, not the day it was imported. */
export function monthLabel(rankingMonth: string): string {
  const [year, month] = rankingMonth.slice(0, 7).split("-")
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const name = months[Number(month) - 1]
  return name ? `${name} ${year}` : rankingMonth
}

/** A single retained edition is not a trend, and says so rather than reading as "went nowhere". */
export function movementLabel(movement: number | null): string {
  if (movement == null) return "One edition"
  if (movement === 0) return "Unchanged"
  const places = Math.abs(movement) === 1 ? "place" : "places"
  return movement > 0 ? `Up ${movement} ${places}` : `Down ${Math.abs(movement)} ${places}`
}

/** "132 lbs · Super 32 Early Entry (VA) · 14 Sep 2026" — a weight means little without where and when. */
export function lastCompetedLine(identity: ScoutingReport["identity"]): string | null {
  if (!identity.lastCompetedWeight) return null
  const when = identity.lastCompetedDate
    ? dayLabel(identity.lastCompetedDate)
    : identity.lastCompetedYear
      ? String(identity.lastCompetedYear)
      : null
  return [`${identity.lastCompetedWeight} lbs`, identity.lastCompetedEvent, when].filter(Boolean).join(" · ")
}

/**
 * A weight range per season — the website's `weightProgression`, ported.
 *
 * Not every weight in order (a wrestler moves around inside a season) and never a first-to-last
 * delta: one bump to 285 at the TOC made a 215-pounder read as "up 115 lbs".
 */
export function weightProgression(rows: ReadonlyArray<ReportResultRow>): string | null {
  const numeric = rows
    .map((r) => ({ year: r.year, value: Number(String(r.weight ?? "").replace(/[^0-9.]/g, "")) }))
    .filter((r) => Number.isFinite(r.value) && r.value > 0 && Number.isFinite(r.year))
  if (numeric.length < 2) return null

  const byYear = new Map<number, number[]>()
  for (const r of numeric) byYear.set(r.year, [...(byYear.get(r.year) ?? []), r.value])

  const years = [...byYear.keys()].sort((a, b) => a - b)
  if (years.length === 1 && byYear.get(years[0]!)!.length < 2) return null
  return years
    .map((year) => {
      const weights = byYear.get(year)!
      const low = Math.min(...weights)
      const high = Math.max(...weights)
      return `${year}: ${low === high ? low : `${low}–${high}`}`
    })
    .join(" · ")
}

/** Standing labels kept apart: a nationally ranked win and an NC-ranked one are different claims. */
export const STANDING_LABEL: Record<BoutReason, string> = {
  "national-ranked": "Nat'l ranked",
  "toc-field": "TOC field",
  ranked: "NC ranked",
  "state-champion": "State champ",
  "state-placer": "State placer",
}

const BOUT_GROUPS: { title: string; reasons: BoutReason[] }[] = [
  { title: "nationally ranked opponents", reasons: ["national-ranked"] },
  { title: "NC-ranked opponents", reasons: ["ranked", "toc-field"] },
  { title: "state champions & placers", reasons: ["state-champion", "state-placer"] },
]

/** Bouts split by the opponent's standing, strongest first; empty groups dropped. */
export function groupBouts(rows: ReadonlyArray<ReportBout>, kind: "win" | "loss"): { heading: string; rows: ReportBout[] }[] {
  return BOUT_GROUPS.map((group) => ({
    heading: `${kind === "win" ? "Wins over" : "Losses to"} ${group.title}`,
    rows: rows.filter((r) => group.reasons.includes(r.reason)),
  })).filter((group) => group.rows.length > 0)
}

/**
 * What an empty bout list says. Stated, never left blank — an omitted fact on this report has
 * been read as a gap to fill before.
 */
export function noBoutsLine(kind: "win" | "loss"): string {
  return kind === "win"
    ? "No wins over nationally ranked, NC-ranked, state champion or state-placing wrestlers on file."
    : "No losses to nationally ranked, NC-ranked, state champion or state-placing wrestlers on file."
}

/** The status chip: a commitment names the school, otherwise the stated status, otherwise "Uncommitted". */
export function statusLine(report: Pick<ScoutingReport, "commitment" | "recruitingStatus">): string {
  return report.commitment ? `Committed · ${report.commitment}` : (report.recruitingStatus ?? "Uncommitted")
}
