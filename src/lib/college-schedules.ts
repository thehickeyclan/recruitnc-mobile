import { supabase } from "./supabase"
import { colors } from "@/theme/tokens"
import type { CalendarEvent } from "./events"

/**
 * College wrestling schedules for the teams a reader follows.
 *
 * Reads are anonymous through Supabase like the rest of the calendar — a college schedule is
 * public information. Writes are not: following a team goes through the web app's API on the
 * service role, because `college_follows` has no publicly writable policy and should not get one.
 * With it, anybody could subscribe somebody else's phone to anything.
 */

const BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL

export type CollegeTeam = {
  id: string
  name: string
  division: string | null
  logoUrl: string | null
}

export type CollegeMeet = {
  id: string
  collegeId: string
  date: string
  startTime: string | null
  opponent: string | null
  eventName: string | null
  homeAway: "home" | "away" | "neutral"
  location: string | null
  streamUrl: string | null
  status: "scheduled" | "postponed" | "cancelled"
}

/** The season "2026-27" runs August to July, the same rule the importer uses. */
export function currentSeason(now: Date = new Date()): string {
  const year = now.getFullYear()
  const startYear = now.getMonth() + 1 >= 8 ? year : year - 1
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`
}

/** Only programs whose schedule is actually collected can be followed. */
export async function fetchCollegeTeams(): Promise<CollegeTeam[]> {
  const { data, error } = await supabase
    .from("colleges")
    .select("id, name, division, logo_url")
    .not("wrestling_schedule_url", "is", null)
    .order("name")

  if (error) throw new Error(error.message)
  return (data ?? []).map((row: Record<string, any>) => ({
    id: row.id,
    name: row.name,
    division: row.division ?? null,
    logoUrl: row.logo_url ?? null,
  }))
}

export async function fetchCollegeMeets(collegeIds: string[], season = currentSeason()): Promise<CollegeMeet[]> {
  // No team followed, no query. Nothing about this feature should cost anything until asked for.
  if (!collegeIds.length) return []

  const { data, error } = await supabase
    .from("college_schedules")
    .select("id, college_id, event_date, start_time, opponent, event_name, home_away, location, stream_url, status")
    .in("college_id", collegeIds)
    .eq("season", season)
    .order("event_date", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row: Record<string, any>) => ({
    id: row.id,
    collegeId: row.college_id,
    date: row.event_date,
    startTime: row.start_time ?? null,
    opponent: row.opponent ?? null,
    eventName: row.event_name ?? null,
    homeAway: row.home_away ?? "home",
    location: row.location ?? null,
    streamUrl: row.stream_url ?? null,
    status: row.status ?? "scheduled",
  }))
}

/**
 * A meet in the shape the calendar already draws.
 *
 * Mapped rather than given its own list so a college dual sits in the month grid on its date,
 * beside the NC events, instead of in a second place a reader has to remember to check.
 */
export function toCalendarEvent(meet: CollegeMeet, teamName: string): CalendarEvent {
  const who = meet.opponent ?? meet.eventName ?? "TBA"
  const fixture = meet.opponent ? `${meet.homeAway === "away" ? "at" : "vs"} ${who}` : who
  const called = meet.status === "cancelled" ? " (cancelled)" : meet.status === "postponed" ? " (postponed)" : ""

  return {
    // Namespaced: a college meet and an `events` row could otherwise share an id.
    id: `college:${meet.id}`,
    title: `${teamName} ${fixture}${called}`,
    category: "college-schedule",
    categoryLabel: "College",
    accent: "#3FB27F",
    startDate: meet.date,
    endDate: null,
    startTime: meet.startTime ? meet.startTime.slice(0, 5) : null,
    endTime: null,
    location: meet.location,
    externalLink: meet.streamUrl,
    acceptsDropIn: false,
  }
}

/** The teams this device follows. Anonymous — the Expo token is the identity. */
export async function fetchFollowedTeams(expoPushToken: string): Promise<string[]> {
  if (!BASE || !expoPushToken) return []
  try {
    const response = await fetch(`${BASE}/api/college-follows?expoPushToken=${encodeURIComponent(expoPushToken)}`)
    if (!response.ok) return []
    const body = (await response.json()) as { following?: Array<{ collegeId?: string }> }
    return (body.following ?? []).map((row) => row.collegeId).filter((id): id is string => Boolean(id))
  } catch {
    // Following is a convenience layered on a working calendar; it must never break the screen.
    return []
  }
}

export async function setFollowingTeam(
  expoPushToken: string,
  collegeId: string,
  following: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!BASE) return { ok: false, error: "No web base URL configured." }
  try {
    const response = await fetch(`${BASE}/api/college-follows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expoPushToken, collegeId, following }),
    })
    if (response.ok) return { ok: true }
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    // 409 means this device has not registered for alerts yet, which is worth saying out loud
    // rather than leaving somebody tapping Follow and watching nothing happen.
    return { ok: false, error: body?.error ?? `Could not save that (${response.status}).` }
  } catch {
    return { ok: false, error: "No connection." }
  }
}
