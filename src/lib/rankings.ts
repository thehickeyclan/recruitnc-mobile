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

export type RankingBoard = {
  key: string
  title: string
  cap: number
  athletes: RankedAthlete[]
}

export type RankingsResult =
  | { state: "ok"; boards: RankingBoard[] }
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
    const response = await fetch(`${BASE.replace(/\/$/, "")}/api/mobile/v1/rankings`, {
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

    const body = (await response.json()) as { boards?: RankingBoard[] }
    const boards = (body.boards ?? []).filter((b) => b && Array.isArray(b.athletes))
    if (boards.length === 0) return { state: "error", message: "No rankings published yet." }
    return { state: "ok", boards }
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
