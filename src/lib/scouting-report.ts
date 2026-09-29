import { supabase } from "@/lib/supabase"
import { clientHeader } from "@/lib/client-header"
import type { ScoutingReport } from "@/lib/scouting-report-format"

const BASE = (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://app.ncwrestlingunited.com").replace(/\/$/, "")

/** Building a report runs an LLM summary server-side, which can take a while. */
const REPORT_TIMEOUT_MS = 45_000
const ACCESS_TIMEOUT_MS = 8_000

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { ...clientHeader(), Authorization: `Bearer ${token}` } : null
}

/**
 * Whether to show the scouting report button on this wrestler.
 *
 * Asked of the server, which runs the same test as the website's button — the pre-launch
 * allowlist lives there and must never ship in the app. Signed out, or on any failure, the answer
 * is no: a missing button is the safe way to be wrong.
 */
export async function fetchScoutingAccess(athleteId: string): Promise<boolean> {
  try {
    const headers = await authHeaders()
    if (!headers) return false
    const response = await fetch(`${BASE}/api/mobile/v1/athlete/${encodeURIComponent(athleteId)}/scouting-access`, {
      headers,
      signal: AbortSignal.timeout(ACCESS_TIMEOUT_MS),
    })
    if (!response.ok) return false
    const body = (await response.json().catch(() => null)) as { available?: boolean } | null
    return body?.available === true
  } catch {
    return false
  }
}

/** The report itself — the same JSON the website's report page renders. */
export async function fetchScoutingReport(athleteId: string): Promise<ScoutingReport> {
  const headers = await authHeaders()
  if (!headers) throw new Error("Sign in to view scouting reports.")

  const response = await fetch(`${BASE}/api/athletes/${encodeURIComponent(athleteId)}/scouting-report`, {
    headers,
    signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
  })
  const body = (await response.json().catch(() => null)) as { report?: ScoutingReport; error?: string } | null
  if (!response.ok || !body?.report) throw new Error(body?.error ?? "Could not load the scouting report.")
  return body.report
}
