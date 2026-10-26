import { supabase } from "@/lib/supabase"
import { clientHeader } from "@/lib/client-header"

/**
 * Reporting a commitment from the app (Matt, 26 October 2026: "you should def have a native submit
 * a commitment on the iPhone app").
 *
 * Posts to the same endpoint as the website's form, so a report from either reaches Matt the same
 * way: a text with a link, one tap to approve, and the profile, the Commits tab and the alert all
 * follow. Nothing goes live from the phone.
 */
const BASE = (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://app.ncwrestlingunited.com").replace(/\/$/, "")
const TIMEOUT_MS = 20_000

export type ReporterRole = "athlete" | "parent" | "college-coach" | "hs-coach" | "other"
export const REPORTER_ROLES: Array<{ role: ReporterRole; label: string }> = [
  { role: "athlete", label: "I'm the wrestler" },
  { role: "parent", label: "Parent or family" },
  { role: "college-coach", label: "College coach" },
  { role: "hs-coach", label: "High school or club coach" },
  { role: "other", label: "Someone else" },
]

/** The classes a new profile can be made for; matches the website (lib/commitments/intake.ts). */
export const PROFILE_CLASS_YEARS = [2027, 2028, 2029, 2030] as const

export type WrestlerHit = {
  id: string
  name: string
  graduationYear: number | null
  highSchool: string | null
  club: string | null
  college: string | null
}

export type College = { id: string; name: string; division: string | null }

export async function searchWrestlers(q: string): Promise<WrestlerHit[]> {
  if (q.trim().length < 2) return []
  try {
    const res = await fetch(`${BASE}/api/commitments/athlete-search?q=${encodeURIComponent(q.trim())}`, {
      headers: clientHeader(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const body = (await res.json().catch(() => null)) as { athletes?: WrestlerHit[] } | null
    return (body?.athletes ?? []).map((a) => ({ ...a, club: a.club ?? null, college: a.college ?? null }))
  } catch {
    return []
  }
}

/** Every college we hold, for the picker. Public, like the Commits tab's division lookup. */
export async function loadColleges(): Promise<College[]> {
  const { data } = await supabase.from("colleges").select("id, name, division").order("name")
  return (data ?? []).map((c) => ({ id: String(c.id), name: String(c.name), division: c.division ?? null }))
}

export type CommitmentReport = {
  athleteId: string | null
  athleteName: string | null
  highSchool: string | null
  graduationYear: number | null
  gender: "Male" | "Female" | null
  collegeId: string | null
  collegeName: string | null
  commitmentDate: string
  announcementUrl: string | null
  submitterName: string
  submitterRole: ReporterRole
  submitterContact: string
}

export async function sendCommitmentReport(report: CommitmentReport): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  try {
    const res = await fetch(`${BASE}/api/submit-commitment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...clientHeader(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(report),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const body = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null
    return res.ok && body?.success ? { ok: true } : { ok: false, error: body?.error ?? "That did not go through. Please try again." }
  } catch {
    return { ok: false, error: "No connection. Please try again." }
  }
}

/** The signed-in account's email, to fill in "how to reach you". */
export async function signedInEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.email ?? null
}

/** An email, or a phone number with at least ten digits - what the server accepts. */
export function isContact(v: string): boolean {
  const s = v.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) || s.replace(/\D/g, "").length >= 10
}

/** YYYY-MM-DD in North Carolina, `daysAgo` days back. */
export function ncDay(daysAgo = 0, now: Date = new Date()): string {
  return new Date(now.getTime() - daysAgo * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/New_York" })
}
