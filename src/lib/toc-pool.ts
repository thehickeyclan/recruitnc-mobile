import { supabase } from "./supabase"

/**
 * The bracket pool — submitting an entry, and reading the standings.
 *
 * The server owns the rules: when the pool opens, when it locks, and which picks are worth
 * storing. This asks and reports rather than deciding, so the app cannot drift into offering a
 * submit button the server would refuse.
 */

const BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL
const REQUEST_TIMEOUT_MS = 15_000

export type PoolWindow = {
  opensAt: string
  deadline: string
  open: boolean
  reason?: string
}

export type PoolEntry = {
  weight_class: number
  picks: Record<string, string>
  submitted: boolean
  submitted_at: string | null
}

export type LeaderboardRow = {
  rank: number
  name: string
  points: number
  correct: number
  weightsEntered: number
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Sign in to enter the pool.")
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
}

function requireBase(): string {
  if (!BASE) throw new Error("This build has no EXPO_PUBLIC_WEB_BASE_URL.")
  return BASE
}

/** Your entries and the state of the window. Throws when signed out. */
export async function fetchPoolState(): Promise<{ entries: PoolEntry[]; window: PoolWindow }> {
  const response = await fetch(`${requireBase()}/api/toc/pool/entry`, {
    headers: await authHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const data = (await response.json().catch(() => null)) as
    | { entries?: PoolEntry[]; window?: PoolWindow; error?: string }
    | null
  if (!response.ok || !data?.window) throw new Error(data?.error ?? "Could not load the pool.")
  return { entries: data.entries ?? [], window: data.window }
}

/**
 * Submits one weight class.
 *
 * Returns how many picks the server actually kept. It validates against the official draw, so a
 * count lower than what was sent means some picks could never have scored — worth surfacing
 * rather than reporting a clean success.
 */
export async function submitEntry(
  weightClass: number,
  picks: Record<number, string>,
): Promise<{ picksAccepted: number; boutsInDraw: number }> {
  const response = await fetch(`${requireBase()}/api/toc/pool/entry`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ weightClass, picks, submitted: true }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; picksAccepted?: number; boutsInDraw?: number; error?: string }
    | null
  if (!response.ok || !data?.ok) throw new Error(data?.error ?? "Could not submit your bracket.")
  return { picksAccepted: data.picksAccepted ?? 0, boutsInDraw: data.boutsInDraw ?? 0 }
}

/** Standings. Public — no sign-in, and the server never returns anyone's picks. */
export async function fetchLeaderboard(): Promise<{
  standings: LeaderboardRow[]
  entrants: number
  boutsDecided: number
}> {
  const response = await fetch(`${requireBase()}/api/toc/pool/leaderboard`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const data = (await response.json().catch(() => null)) as {
    standings?: LeaderboardRow[]
    entrants?: number
    boutsDecided?: number
    error?: string
  } | null
  if (!response.ok || !data) throw new Error(data?.error ?? "Could not load the leaderboard.")
  return {
    standings: data.standings ?? [],
    entrants: data.entrants ?? 0,
    boutsDecided: data.boutsDecided ?? 0,
  }
}

/** How the window reads above a submit button. */
export function windowLabel(window: PoolWindow | null): string {
  if (!window) return ""
  if (window.open) return "Entries are open"
  return window.reason ?? "Entries are closed"
}
