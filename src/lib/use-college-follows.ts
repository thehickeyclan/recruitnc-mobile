import { useCallback, useEffect, useMemo, useState } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { registerForPush } from "@/lib/push"
import {
  fetchCollegeMeets,
  fetchCollegeTeams,
  setFollowingTeam,
  toCalendarEvent,
  type CollegeTeam,
} from "@/lib/college-schedules"
import type { CalendarEvent } from "@/lib/events"

/**
 * The college teams this device follows.
 *
 * The local list is what draws the calendar, and the server copy is only for reminders. Keeping
 * them apart matters: a reader who has never turned on notifications can still follow NC State
 * and see its season, and following must never be the thing that raises a permission prompt.
 * Asking the OS for push because somebody wanted a filter is how people say no to both.
 */

const FOLLOWS_KEY = "recruitnc.collegeFollows"
const PREFS_KEY = "recruitnc.alertPrefs"

async function alertsAreOn(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY)
    return raw ? Boolean(JSON.parse(raw)?.enabled) : false
  } catch {
    return false
  }
}

export function useCollegeFollows() {
  const [teams, setTeams] = useState<CollegeTeam[]>([])
  const [followed, setFollowed] = useState<string[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchCollegeTeams().catch(() => [] as CollegeTeam[]), AsyncStorage.getItem(FOLLOWS_KEY)])
      .then(([found, raw]) => {
        if (cancelled) return
        setTeams(found)
        const saved = raw ? (JSON.parse(raw) as string[]) : []
        // Drop a team that has since gone from the list, so a stale id cannot query forever.
        setFollowed(saved.filter((id) => found.some((t) => t.id === id)))
        setReady(true)
      })
      .catch(() => !cancelled && setReady(true))
    return () => {
      cancelled = true
    }
  }, [])

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])

  useEffect(() => {
    let cancelled = false
    if (!followed.length) {
      setEvents([])
      return
    }
    fetchCollegeMeets(followed)
      .then((meets) => {
        if (cancelled) return
        setEvents(meets.map((meet) => toCalendarEvent(meet, teamById.get(meet.collegeId)?.name ?? "College")))
      })
      .catch(() => !cancelled && setEvents([]))
    return () => {
      cancelled = true
    }
  }, [followed, teamById])

  const toggle = useCallback(
    async (collegeId: string) => {
      const following = !followed.includes(collegeId)
      const next = following ? [...followed, collegeId] : followed.filter((id) => id !== collegeId)

      // Local first, so the calendar reacts even with no signal and no notifications.
      setFollowed(next)
      try {
        await AsyncStorage.setItem(FOLLOWS_KEY, JSON.stringify(next))
      } catch {
        // A follow that cannot be remembered still works for this session.
      }

      if (!(await alertsAreOn())) {
        setNotice(
          following
            ? "Added to your calendar. Turn on alerts in More to get a reminder the day before."
            : null,
        )
        return
      }

      try {
        // Permission is already granted at this point, so this re-reads the token rather than
        // prompting for it.
        const token = await registerForPush()
        const result = await setFollowingTeam(token, collegeId, following)
        setNotice(result.ok ? null : result.error ?? "Saved on this phone, but reminders could not be set.")
      } catch {
        setNotice("Saved on this phone, but reminders could not be set.")
      }
    },
    [followed],
  )

  return { teams, followed, events, ready, notice, setNotice, toggle }
}
