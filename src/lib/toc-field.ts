import { clientHeader } from "@/lib/client-header"

const BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL

/** The field can be a few hundred KB once several weights are out. */
/**
 * Forty-five seconds, because the honest worst case is about thirty.
 *
 * The field is cached on the server, but a cold rebuild reconciles every wrestler by name and
 * takes roughly thirty seconds. At twenty this gave up first and the screen said "fetch failed",
 * which reads as a broken app rather than a slow one — and it happened to whoever was unlucky
 * enough to be first after a cache lapse, so it looked random.
 *
 * The real fix is on the server (the field is now cached for a day and rebuilt the moment staff
 * announce or release, so cold reads are rare). This is the seatbelt for when one happens anyway.
 */
const REQUEST_TIMEOUT_MS = 45_000

export type TocCredential = {
  kind: "all-american" | "state-champion" | "state-placer" | "state-qualifier"
  label: string
}

export type TocFieldAthlete = {
  athleteId: string
  name: string
  graduationYear: number | null
  club: string | null
  photoUrl: string | null
  collegeCommit: string | null
  results: string[]
  summary: string
  credentials: TocCredential[]
}

export type TocWeightTile = {
  weightClass: number
  announced: boolean
  announcedAt: string | null
  athleteCount: number
}

export type TocAnnouncedWeight = {
  weightClass: number
  announcedAt: string
  athletes: TocFieldAthlete[]
}

export type TocField = {
  tiles: TocWeightTile[]
  weights: TocAnnouncedWeight[]
  releasedCount: number
}

/**
 * The announced Tournament of Champions field.
 *
 * Reads `/api/toc/field`, which takes no parameters and returns only weights already released
 * publicly. The app cannot ask about an unreleased weight because there is nothing to ask with —
 * that is deliberate, and the reason this is one call for everything rather than one per weight.
 */
export async function fetchTocField(signal?: AbortSignal): Promise<TocField> {
  if (!BASE) throw new Error("This build has no EXPO_PUBLIC_WEB_BASE_URL.")

  const response = await fetch(`${BASE}/api/toc/field`, {
    headers: { ...clientHeader(), Accept: "application/json" },
    signal: signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  const data = (await response.json().catch(() => null)) as (TocField & { error?: string }) | null
  if (!response.ok || !data || data.error) {
    throw new Error(data?.error ?? "Could not load the field right now.")
  }

  return {
    tiles: Array.isArray(data.tiles) ? data.tiles : [],
    weights: Array.isArray(data.weights) ? data.weights : [],
    releasedCount: Number(data.releasedCount) || 0,
  }
}

/** Strongest credential first — what a card should lead with. */
export function headlineCredential(athlete: TocFieldAthlete): TocCredential | null {
  return athlete.credentials[0] ?? null
}

/** Name suffixes that are not the family name. */
const NAME_SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"])

/**
 * Sort key for a wrestler's family name — "Kristopher Kerr Jr" sorts under K, not J.
 *
 * The field is published alphabetically by surname, and anywhere else we list a weight it should
 * match, or the same eight names appear in two different orders in the same app.
 */
export function surnameKey(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  while (parts.length > 1 && NAME_SUFFIXES.has(parts[parts.length - 1].toLowerCase())) parts.pop()
  return (parts[parts.length - 1] ?? fullName).toLowerCase()
}

/** Alphabetical by surname, then by full name so identical surnames stay stable. */
export function compareBySurname(a: { name: string }, b: { name: string }): number {
  const keyed = surnameKey(a.name).localeCompare(surnameKey(b.name))
  return keyed !== 0 ? keyed : a.name.localeCompare(b.name)
}
