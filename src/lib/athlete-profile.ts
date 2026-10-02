import { clientHeader } from "@/lib/client-header"

/**
 * A wrestler's profile.
 *
 * Read from the web app rather than from Supabase directly, even though the phone's anon key can
 * reach the `athletes` table: that row carries a cell number, an email, a GPA and a date of birth,
 * and most of these wrestlers are minors. `/api/mobile/v1/athlete/[id]` projects onto a hand-written
 * allowlist, so the phone cannot receive a field nobody decided to send it.
 *
 * The same endpoint also builds the tournament rows with the web's own builder, which is why Fargo
 * splits into Freestyle and Greco here exactly as it does on the website.
 */

const BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL
const REQUEST_TIMEOUT_MS = 20_000

export type ProfileTournamentBout = {
  round: string | null
  opponentName: string | null
  opponentClub: string | null
  win: boolean | null
  isBye: boolean | null
  winType: string | null
  score: string | null
  /** v2: the opponent's accolade ("2026 FL 1A State Champion"), same rules as the website. */
  accolade?: string | null
}

export type ProfileTournamentRow = {
  id: string
  event: string
  /** The team a wrestler competed for, on duals rows. */
  team: string | null
  isDuals: boolean
  year: number
  weight: string | null
  placement: string | null
  record: string | null
  bouts: ProfileTournamentBout[]
}

export type AthleteProfile = {
  id: string
  name: string
  photoUrl: string | null
  highSchool: string | null
  club: string | null
  graduationYear: number | null
  /** Published classes only. An unpublished class has no number to show. */
  prospectRanking: number | null
  weight: {
    display: string | null
    lastCompeted: { weight: string | number | null; year: number | null; event: string | null } | null
  }
  commitment: { college: string; status: string | null; date: string | null } | null
  credentials: { label: string; detail: string; year: number }[]
  stateResults: { year: number; place: number | null; classification: string | null; weightClass: string | null }[]
  toc: ProfileTournamentRow[]
  national: ProfileTournamentRow[]
  /**
   * v2 (1 Oct 2026, the redesigned profile). Absent from an older server, in which case the
   * screen falls back to the v1 sections - see hasV2.
   */
  banner?: { credentials: BannerCredential[]; competition: Competition }
  stateRows?: ProfileTournamentRow[]
  tocRows?: ProfileTournamentRow[]
  folkstyle?: ProfileTournamentRow[]
  olympic?: ProfileTournamentRow[]
}

export type BannerCredential = {
  title: string
  detail: string
  label: string
  tier: "national" | "toc" | "state" | "olympic-state"
}

export type Competition = {
  scope: "national" | "in-state"
  nationalEvents: string[]
  styles: Array<"folkstyle" | "freestyle" | "greco">
}

export const STYLE_LABEL: Record<Competition["styles"][number], string> = {
  folkstyle: "Folkstyle",
  freestyle: "Freestyle",
  greco: "Greco-Roman",
}

/** Whether the server sent the redesigned profile's sections. */
export function hasV2(athlete: AthleteProfile): boolean {
  return Boolean(athlete.banner && athlete.folkstyle && athlete.olympic)
}

/** "Aaron" over "ELLISON"; a suffix stays with the surname ("Smith Jr."). */
export function splitName(name: string): { first: string; last: string } {
  const words = name.trim().split(/\s+/)
  const suffix = words.length > 2 && /^(jr\.?|sr\.?|ii|iii|iv)$/i.test(words[words.length - 1]) ? 2 : 1
  return { first: words.slice(0, -suffix).join(" "), last: words.slice(-suffix).join(" ") }
}

/** Duals rows have a team and no placement; they print after the individual events. */
export function splitDuals(rows: ProfileTournamentRow[]): { individual: ProfileTournamentRow[]; duals: ProfileTournamentRow[] } {
  return { individual: rows.filter((r) => !r.isDuals), duals: rows.filter((r) => r.isDuals) }
}

export async function fetchAthleteProfile(athleteId: string, signal?: AbortSignal): Promise<AthleteProfile> {
  if (!BASE) throw new Error("This build has no EXPO_PUBLIC_WEB_BASE_URL.")

  const response = await fetch(`${BASE}/api/mobile/v1/athlete/${encodeURIComponent(athleteId)}`, {
    headers: clientHeader(),
    signal: signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const body = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string; athlete?: AthleteProfile }
    | null

  if (!response.ok || !body?.ok || !body.athlete) {
    throw new Error(body?.error ?? "Could not load that profile.")
  }

  const athlete = body.athlete
  return {
    ...athlete,
    credentials: Array.isArray(athlete.credentials) ? athlete.credentials : [],
    stateResults: Array.isArray(athlete.stateResults) ? athlete.stateResults : [],
    toc: Array.isArray(athlete.toc) ? athlete.toc : [],
    national: Array.isArray(athlete.national) ? athlete.national : [],
  }
}

/** "Class of 2027 · Wheatmore · RAW" — whichever of those we actually know. */
export function profileMetaLine(athlete: AthleteProfile): string {
  return [
    athlete.graduationYear ? `Class of ${athlete.graduationYear}` : null,
    athlete.highSchool,
    athlete.club,
  ]
    .filter(Boolean)
    .join(" · ")
}

/**
 * The weight line, and the honest version of it.
 *
 * A listed weight goes stale the moment somebody moves up, so where the last tournament disagrees
 * with the profile the screen says both rather than picking one.
 */
export function weightLines(athlete: AthleteProfile): { headline: string | null; note: string | null } {
  const headline = athlete.weight.display ? `${athlete.weight.display} lbs` : null
  const last = athlete.weight.lastCompeted
  if (!last?.weight || String(last.weight) === String(athlete.weight.display ?? "")) {
    return { headline, note: null }
  }
  const where = [last.event, last.year].filter(Boolean).join(" ")
  return { headline, note: `Last competed at ${last.weight} lbs${where ? ` · ${where}` : ""}` }
}

/** "2nd · 1-1" — the finish first, because that is what anyone is looking for. */
export function rowSummary(row: ProfileTournamentRow): string | null {
  return [row.placement, row.record, row.weight ? `${row.weight} lbs` : null].filter(Boolean).join(" · ") || null
}
