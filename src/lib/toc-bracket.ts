const BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL

const REQUEST_TIMEOUT_MS = 20_000

export type BracketSlot =
  | { kind: "athlete"; athleteId: string }
  | { kind: "feeder"; boutNumber: number; label: string }
  | { kind: "empty"; label: string }

export type BracketParticipant = {
  athleteId: string
  seed: number
  name: string
  school: string | null
  photoUrl: string | null
  graduationYear: number | null
  isPlaceholder?: boolean
}

export type BracketBout = {
  id: string
  boutNumber: number
  roundLabel: string
  side: "winners" | "losers" | "placement"
  top: BracketSlot
  bottom: BracketSlot
  winnerAthleteId: string | null
  status: "scheduled" | "complete"
}

export type BracketDraw = {
  weightClass: number
  format: string
  participants: BracketParticipant[]
  bouts: BracketBout[]
}

export type BracketPreview = {
  draw: BracketDraw
  /** False until TOC publishes real brackets — the screen must not imply this is official. */
  official: boolean
  weightClass: number
  fieldSize: number
}

/**
 * Turns an ordering of an announced weight into a real double-elimination draw.
 *
 * The server owns the bracket maths — this posts an order and renders what comes back, so the
 * app and the website can never disagree about who meets whom.
 */
export async function buildBracketPreview(
  weightClass: number,
  athleteIds: string[],
  signal?: AbortSignal,
): Promise<BracketPreview> {
  if (!BASE) throw new Error("This build has no EXPO_PUBLIC_WEB_BASE_URL.")

  const response = await fetch(`${BASE}/api/toc/brackets/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ weightClass, athleteIds }),
    signal: signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  const data = (await response.json().catch(() => null)) as (BracketPreview & { error?: string }) | null
  if (!response.ok || !data || data.error) {
    throw new Error(data?.error ?? "Could not build that bracket.")
  }
  return data
}

/** Bouts grouped in the order the rounds actually happen, for a phone-shaped read. */
export function boutsByRound(draw: BracketDraw): Array<{ round: string; bouts: BracketBout[] }> {
  const order: string[] = []
  const grouped = new Map<string, BracketBout[]>()

  for (const bout of [...draw.bouts].sort((a, b) => a.boutNumber - b.boutNumber)) {
    if (!grouped.has(bout.roundLabel)) {
      grouped.set(bout.roundLabel, [])
      order.push(bout.roundLabel)
    }
    grouped.get(bout.roundLabel)!.push(bout)
  }

  return order.map((round) => ({ round, bouts: grouped.get(round)! }))
}

/** Display name for one side of a bout — a wrestler, or where its occupant comes from. */
export function slotLabel(draw: BracketDraw, slot: BracketSlot): string {
  if (slot.kind === "athlete") {
    const p = draw.participants.find((x) => x.athleteId === slot.athleteId)
    return p?.name ?? "—"
  }
  return slot.label
}

export function slotSeed(draw: BracketDraw, slot: BracketSlot): number | null {
  if (slot.kind !== "athlete") return null
  const p = draw.participants.find((x) => x.athleteId === slot.athleteId)
  return p && !p.isPlaceholder ? p.seed : null
}

/** Move an item within an order. Returns a new array; out-of-range moves are no-ops. */
export function moveInOrder<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
