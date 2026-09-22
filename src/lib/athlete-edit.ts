import { clientHeader } from "@/lib/client-header"
import { supabase } from "@/lib/supabase"

/**
 * Claiming and editing a wrestler's profile.
 *
 * Both go to `/api/mobile/v1/athlete/[id]`, which validates every value and decides who is
 * allowed to write — the phone does no authorisation of its own beyond hiding buttons, because a
 * hidden button is a courtesy and not a rule.
 */

const BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL
const REQUEST_TIMEOUT_MS = 20_000

export type AthleteEditFields = {
  gpa: string
  sat: string
  act: string
  intendedMajor: string
  collegeWeightClass: string
  weightClass: string
  highlightVideoUrl: string
  bio: string
  instagram: string
}

/** Signed in or not, and who they are — the screen needs both to decide what to offer. */
async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Sign in to make changes.")
  return { ...clientHeader(), "Content-Type": "application/json", Authorization: `Bearer ${token}` }
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

/**
 * What is already on the profile, for whoever may change it.
 *
 * Returns null when this person may not edit — a 403 is the normal answer for anyone looking at
 * somebody else's wrestler, not an error worth showing.
 */
export async function loadAthleteEdits(
  athleteId: string,
): Promise<{ fields: AthleteEditFields; relationship: "self" | "parent" } | null> {
  if (!BASE) throw new Error("This build has no EXPO_PUBLIC_WEB_BASE_URL.")
  let headers: Record<string, string>
  try {
    headers = await authHeaders()
  } catch {
    return null
  }
  const response = await fetch(`${BASE}/api/mobile/v1/athlete/${encodeURIComponent(athleteId)}/edit`, {
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (response.status === 401 || response.status === 403) return null
  const body = (await response.json().catch(() => null)) as
    | { ok?: boolean; fields?: AthleteEditFields; relationship?: "self" | "parent" }
    | null
  if (!response.ok || !body?.ok || !body.fields) return null
  return { fields: body.fields, relationship: body.relationship ?? "self" }
}

export async function claimAthleteProfile(athleteId: string, as: "self" | "parent"): Promise<void> {
  if (!BASE) throw new Error("This build has no EXPO_PUBLIC_WEB_BASE_URL.")
  const response = await fetch(`${BASE}/api/mobile/v1/athlete/${encodeURIComponent(athleteId)}/claim`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ as }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(await readError(response, "Could not claim that profile."))
}

/**
 * Save the fields that changed.
 *
 * Only what the athlete actually touched is sent: the endpoint leaves absent fields alone and
 * clears the ones it is given empty, so sending the whole form would wipe anything the screen
 * does not show.
 */
export async function saveAthleteEdits(
  athleteId: string,
  changed: Partial<AthleteEditFields>,
): Promise<string[]> {
  if (!BASE) throw new Error("This build has no EXPO_PUBLIC_WEB_BASE_URL.")
  const response = await fetch(`${BASE}/api/mobile/v1/athlete/${encodeURIComponent(athleteId)}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(changed),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; changed?: string[] } | null
  if (!response.ok || !body?.ok) throw new Error(body?.error ?? "Could not save those changes.")
  return body.changed ?? []
}

/** Only the fields whose value the athlete actually changed. */
export function changedFields(
  before: AthleteEditFields,
  after: AthleteEditFields,
): Partial<AthleteEditFields> {
  const out: Partial<AthleteEditFields> = {}
  for (const key of Object.keys(after) as (keyof AthleteEditFields)[]) {
    if (before[key].trim() !== after[key].trim()) out[key] = after[key].trim()
  }
  return out
}
