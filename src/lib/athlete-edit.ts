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
  phone: string
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
  // A server older than the field sends no phone; treat it as blank rather than undefined.
  return { fields: { ...body.fields, phone: body.fields.phone ?? "" }, relationship: body.relationship ?? "self" }
}

/** The wording version the parent agreed to; the server records it with the signature. */
export const PARENT_CONSENT_VERSION = "2026-10-01"

/** A parent's typed signature (first and last name) and, optionally, a cell for the account. */
export type ParentConsent = { signedName: string; cellPhone?: string | null }

/**
 * A claim the server refused, with its machine-readable reason.
 *
 * `parent_signature_required` is the one callers act on: the server decides parent-or-wrestler
 * from the account's role, so even "This is me" can come back asking for a parent's signature.
 */
export class ClaimError extends Error {
  readonly code: string | null
  constructor(message: string, code: string | null) {
    super(message)
    this.name = "ClaimError"
    this.code = code
  }
}

export function needsParentSignature(e: unknown): boolean {
  return e instanceof ClaimError && e.code === "parent_signature_required"
}

/**
 * Whether the signed-in account already has a cell on file, so the consent sheet need not ask.
 *
 * Best effort: any failure (no session, a column the anon role cannot read) answers false and the
 * sheet shows the field. The server never overwrites a cell that is already there.
 */
export async function accountHasCell(): Promise<boolean> {
  try {
    const userId = await currentUserId()
    if (!userId) return false
    const { data, error } = await supabase.from("user_profiles").select("cell_phone").eq("user_id", userId).maybeSingle()
    if (error || !data) return false
    const cell = (data as { cell_phone?: string | null }).cell_phone
    return typeof cell === "string" && cell.replace(/\D/g, "").length >= 10
  } catch {
    return false
  }
}

/**
 * `fill` comes from the create-profile wizard: the server writes it only where the profile is blank.
 * `consent` is required by the server for every parent link; without it a parent claim throws a
 * ClaimError with code `parent_signature_required`.
 */
export async function claimAthleteProfile(
  athleteId: string,
  as: "self" | "parent",
  fill?: { graduationYear?: number | null; highSchool?: string | null },
  consent?: ParentConsent,
): Promise<void> {
  if (!BASE) throw new Error("This build has no EXPO_PUBLIC_WEB_BASE_URL.")
  const signature = consent?.signedName.trim()
    ? {
        signedName: consent.signedName.trim(),
        consentVersion: PARENT_CONSENT_VERSION,
        ...(consent.cellPhone ? { cellPhone: consent.cellPhone } : {}),
      }
    : {}
  const response = await fetch(`${BASE}/api/mobile/v1/athlete/${encodeURIComponent(athleteId)}/claim`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ as, ...(fill ?? {}), ...signature }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string; code?: string } | null
    throw new ClaimError(body?.error ?? "Could not claim that profile.", body?.code ?? null)
  }
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
