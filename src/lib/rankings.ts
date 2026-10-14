import { clientHeader } from "@/lib/client-header"
import { supabase } from "@/lib/supabase"

/**
 * The published boards, fetched for the phone.
 *
 * This deliberately does not read the rankings out of Supabase. The tab used to do exactly
 * that — `public_rankings` with the anon key — and the anon key ships inside every copy of the
 * app, so the paywall was decorative and nothing kept the table in step with what the website
 * published. `/api/mobile/v1/rankings` runs the same entitlement check as the web and returns
 * the same loaders' output, so there is one copy of both the data and the rule.
 *
 * Three outcomes the screen has to tell apart: signed out, signed in without access, and a
 * board. Collapsing the middle one into "empty" is how a paying member gets shown nothing and
 * concludes the app is broken.
 */

const BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL
const REQUEST_TIMEOUT_MS = 20_000

export type RankingCredential = {
  kind: string
  label: string
  detail: string
}

export type RankedAthlete = {
  athleteId: string
  rank: number
  name: string
  photoUrl: string | null
  highSchool: string | null
  club: string | null
  weightClass: string | null
  graduationYear: number | null
  collegeCommit: string | null
  credentials: RankingCredential[]
}

export type RankingGender = "Male" | "Female"

export type RankingBoard = {
  key: string
  /** Absent on boards from servers older than the women's release: those are the men's. */
  gender?: RankingGender
  title: string
  cap: number
  /** ISO time the board was published. Newer servers only. */
  publishedAt?: string | null
  athletes: RankedAthlete[]
}

export type RankingsResult =
  | { state: "ok"; boards: RankingBoard[]; defaultGender: RankingGender }
  | { state: "signed-out" }
  | { state: "locked"; message: string }
  | { state: "error"; message: string }

export async function fetchRankings(): Promise<RankingsResult> {
  if (!BASE) return { state: "error", message: "This build has no EXPO_PUBLIC_WEB_BASE_URL." }

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { state: "signed-out" }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${BASE.replace(/\/$/, "")}/api/mobile/v1/rankings?women=1`, {
      headers: { ...clientHeader(), Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })

    if (response.status === 401) return { state: "signed-out" }

    if (response.status === 403) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      return {
        state: "locked",
        message: body?.error ?? "Rankings are included with NC United Blue, or by subscription.",
      }
    }

    if (!response.ok) {
      return { state: "error", message: `Could not load rankings (${response.status}).` }
    }

    const body = (await response.json()) as { boards?: RankingBoard[]; defaultGender?: string }
    const boards = (body.boards ?? []).filter((b) => b && Array.isArray(b.athletes))
    if (boards.length === 0) return { state: "error", message: "No rankings published yet." }
    return { state: "ok", boards, defaultGender: body.defaultGender === "Female" ? "Female" : "Male" }
  } catch (caught) {
    // A timeout and a dead network read the same to somebody holding a phone.
    const aborted = caught instanceof Error && caught.name === "AbortError"
    return {
      state: "error",
      message: aborted ? "That took too long. Check your connection and try again." : "Could not load rankings.",
    }
  } finally {
    clearTimeout(timer)
  }
}

/** Whose board this is. A board with no gender came from a server that only had the men's. */
export function boardGender(board: Pick<RankingBoard, "gender">): RankingGender {
  return board.gender === "Female" ? "Female" : "Male"
}

/**
 * Which list a rankings alert means, or null when it does not say.
 *
 * The women's release alert opens /rankings, the one rankings path every installed build has,
 * and carries `gender` so a build that knows about the women's boards opens on them.
 */
export function alertRankingGender(data: unknown): RankingGender | null {
  const d = data as { kind?: unknown; gender?: unknown } | null | undefined
  if (d?.kind !== "rankings") return null
  return /female|women|girls/i.test(String(d.gender ?? "")) ? "Female" : null
}

/** "Published September 27, 2026", in Eastern time, or null when the server did not say. */
export function publishedLabel(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `Published ${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" })}`
}
