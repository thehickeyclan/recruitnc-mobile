import { supabase } from "./supabase"
import type { FinalPrediction } from "./final-prediction"
import { clientHeader } from "@/lib/client-header"

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
  final_method: string | null
  final_winner_score: number | null
  final_loser_score: number | null
}

export type LeaderboardRow = {
  rank: number
  name: string
  /** Set on the row belonging to whoever is reading. */
  isYou?: boolean
  points: number
  correct: number
  weightsEntered: number
  finalsCalled?: number
}

async function authHeaders(signedOutMessage = "Sign in to enter the pool."): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error(signedOutMessage)
  return { ...clientHeader(), Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
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
  finalPrediction: FinalPrediction,
): Promise<{ picksAccepted: number; boutsInDraw: number }> {
  const response = await fetch(`${requireBase()}/api/toc/pool/entry`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ weightClass, picks, submitted: true, finalPrediction }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; picksAccepted?: number; boutsInDraw?: number; error?: string }
    | null
  if (!response.ok || !data?.ok) throw new Error(data?.error ?? "Could not submit your bracket.")
  return { picksAccepted: data.picksAccepted ?? 0, boutsInDraw: data.boutsInDraw ?? 0 }
}

/**
 * Standings. Signed in only — most entrants are minors and the board carries their names — and
 * the server never returns anyone's picks.
 */
export async function fetchLeaderboard(): Promise<{
  standings: LeaderboardRow[]
  entrants: number
  boutsDecided: number
}> {
  const response = await fetch(`${requireBase()}/api/toc/pool/leaderboard`, {
    headers: await authHeaders("Sign in to see the leaderboard."),
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

/** The leaderboard name this account has chosen, and what it falls back to without one. */
export async function fetchDisplayName(): Promise<{ displayName: string | null; fallback: string }> {
  const response = await fetch(`${requireBase()}/api/toc/pool/display-name`, {
    headers: await authHeaders("Sign in to set a leaderboard name."),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const data = (await response.json().catch(() => null)) as
    | { displayName?: string | null; fallback?: string; error?: string }
    | null
  if (!response.ok || !data) throw new Error(data?.error ?? "Could not load your leaderboard name.")
  return { displayName: data.displayName ?? null, fallback: data.fallback ?? "Entrant" }
}

/** Sets it, or clears it back to a first name and last initial when given an empty string. */
export async function saveDisplayName(displayName: string): Promise<string | null> {
  const response = await fetch(`${requireBase()}/api/toc/pool/display-name`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ displayName }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const data = (await response.json().catch(() => null)) as
    | { displayName?: string | null; error?: string }
    | null
  if (!response.ok || !data) throw new Error(data?.error ?? "Could not save that name.")
  return data.displayName ?? null
}
