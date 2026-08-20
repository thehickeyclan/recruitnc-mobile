import type { BracketBout, BracketDraw, BracketSlot } from "./toc-bracket"

/**
 * Bout number → the athlete the user says wins it.
 *
 * Ported from the website's `lib/toc/bracket-simulation.ts` rather than called over the wire:
 * advancing a wrestler has to feel instant, and a network round trip per tap does not. The
 * logic is pure, so the two copies agree as long as they stay in step — the tests below pin
 * the behaviour that matters, including the consolation side.
 */
export type SimulationPicks = Record<number, string>

function isPlaceholder(draw: BracketDraw, athleteId: string): boolean {
  const p = draw.participants.find((row) => row.athleteId === athleteId)
  return !p || p.isPlaceholder === true || p.athleteId.startsWith("__toc_open_")
}

function realAthleteId(draw: BracketDraw, slot: BracketSlot): string | null {
  if (slot.kind !== "athlete") return null
  return isPlaceholder(draw, slot.athleteId) ? null : slot.athleteId
}

function resolveSlotAthleteId(
  draw: BracketDraw,
  picks: SimulationPicks,
  slot: BracketSlot,
  resolving: Set<number>,
): string | null {
  if (slot.kind === "athlete") return realAthleteId(draw, slot)
  if (slot.kind === "empty") return null

  const source = draw.bouts.find((bout) => bout.boutNumber === slot.boutNumber)
  if (!source || resolving.has(source.boutNumber)) return null

  const sourceAthletes = boutParticipants(
    draw,
    picks,
    source.boutNumber,
    new Set(resolving).add(source.boutNumber),
  )
  const winner = picks[source.boutNumber]

  // A bout with one real wrestler is a bye: they advance on the championship side, and there
  // is no loser to drop to consolation.
  if (sourceAthletes.length === 1) {
    return /^loser\b/i.test(slot.label) ? null : sourceAthletes[0]
  }
  if (!winner || !sourceAthletes.includes(winner)) return null
  if (/^loser\b/i.test(slot.label)) return sourceAthletes.find((id) => id !== winner) ?? null
  return winner
}

/** Who is actually in a bout, given the picks made so far. */
export function boutParticipants(
  draw: BracketDraw,
  picks: SimulationPicks,
  boutNumber: number,
  resolving = new Set<number>(),
): string[] {
  const bout = draw.bouts.find((row) => row.boutNumber === boutNumber)
  if (!bout) return []
  return [
    resolveSlotAthleteId(draw, picks, bout.top, resolving),
    resolveSlotAthleteId(draw, picks, bout.bottom, resolving),
  ].filter((id): id is string => Boolean(id))
}

/**
 * Drops picks that no longer make sense.
 *
 * Changing an early result can send a different wrestler down a path, which makes later picks
 * impossible — those are removed rather than left pointing at someone who is not in the bout.
 */
export function sanitizePicks(draw: BracketDraw, picks: SimulationPicks): SimulationPicks {
  const next = { ...picks }
  for (const bout of [...draw.bouts].sort((a, b) => a.boutNumber - b.boutNumber)) {
    const selected = next[bout.boutNumber]
    if (selected && !boutParticipants(draw, next, bout.boutNumber).includes(selected)) {
      delete next[bout.boutNumber]
    }
  }
  return next
}

/** Tapping the wrestler already picked clears the pick, so a tap is its own undo. */
export function updatePick(
  draw: BracketDraw,
  picks: SimulationPicks,
  boutNumber: number,
  athleteId: string | null,
): SimulationPicks {
  const next = { ...picks }
  if (athleteId == null || next[boutNumber] === athleteId) delete next[boutNumber]
  else if (boutParticipants(draw, next, boutNumber).includes(athleteId)) next[boutNumber] = athleteId
  return sanitizePicks(draw, next)
}

/** The draw with every pick applied — slots filled in, winners marked, both sides. */
export function simulate(draw: BracketDraw, picks: SimulationPicks): BracketDraw {
  const valid = sanitizePicks(draw, picks)
  const bouts: BracketBout[] = draw.bouts.map((bout) => ({
    ...bout,
    top: resolvedSlot(draw, valid, bout.top),
    bottom: resolvedSlot(draw, valid, bout.bottom),
    winnerAthleteId: valid[bout.boutNumber] ?? null,
    status: valid[bout.boutNumber] ? "complete" : "scheduled",
  }))
  return { ...draw, bouts }
}

function resolvedSlot(draw: BracketDraw, picks: SimulationPicks, slot: BracketSlot): BracketSlot {
  const athleteId = resolveSlotAthleteId(draw, picks, slot, new Set())
  return athleteId ? { kind: "athlete", athleteId } : slot
}

/** How far through the bracket someone is — for a "12 of 12 picked" style progress line. */
export function pickProgress(draw: BracketDraw, picks: SimulationPicks): { picked: number; total: number } {
  const valid = sanitizePicks(draw, picks)
  const decidable = draw.bouts.filter((b) => boutParticipants(draw, valid, b.boutNumber).length === 2)
  return { picked: Object.keys(valid).length, total: Math.max(decidable.length, Object.keys(valid).length) }
}

/** The wrestler your picks make champion, once the final is decided. */
export function championOf(draw: BracketDraw, picks: SimulationPicks): string | null {
  const valid = sanitizePicks(draw, picks)
  const final = [...draw.bouts]
    .filter((b) => /championship/i.test(b.roundLabel))
    .sort((a, b) => b.boutNumber - a.boutNumber)[0]
  return final ? (valid[final.boutNumber] ?? null) : null
}
