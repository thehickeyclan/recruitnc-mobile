import { supabase } from "./supabase"
import { colors } from "@/theme/tokens"

export type CalendarEvent = {
  id: string
  title: string
  category: string
  categoryLabel: string
  accent: string
  startDate: string
  endDate: string | null
  startTime: string | null
  endTime: string | null
  location: string | null
  externalLink: string | null
  acceptsDropIn: boolean
}

/** Mirrors eventCategories in the web app's lib/nc-united-calendar/calendar-config.ts. */
const CATEGORY: Record<string, { label: string; accent: string }> = {
  "blue-practice": { label: "Blue Team Practice", accent: "#4A7FC1" },
  "gold-practice": { label: "Gold Team Practice", accent: colors.gold },
  "training-camp": { label: "Training Camp", accent: "#3FB27F" },
  "ncu-dual-tournament": { label: "NCU Dual Tournament", accent: colors.red },
  "national-tournament": { label: "National Tournament", accent: colors.red },
  podcast: { label: "Podcast", accent: "#9B7BD4" },
  "important-date": { label: "Important Date", accent: "#E08A3C" },
  "college-open": { label: "College Open", accent: "#4A7FC1" },
  "ncaa-recruiting": { label: "NCAA Recruiting", accent: "#3FB27F" },
}

/** Drop-in checkout is offered for team practices only — same rule as app/calendar/page.tsx. */
function acceptsDropIn(category: string, maxDropIns: number | null): boolean {
  return (category === "blue-practice" || category === "gold-practice") && (maxDropIns ?? 0) > 0
}

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

export function formatTime(time: string | null): string | null {
  if (!time) return null
  const [h, m] = time.split(":")
  const hour = Number.parseInt(h, 10)
  if (Number.isNaN(hour)) return null
  const ampm = hour >= 12 ? "PM" : "AM"
  return `${hour % 12 || 12}:${m} ${ampm}`
}

export async function fetchUpcomingEvents(): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id, title, category, start_date, end_date, start_time, end_time, location, external_link, max_drop_ins")
    .gte("start_date", todayIso())
    .order("start_date", { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? [])
    .filter((e) => e.start_date)
    .map((e) => {
      const meta = CATEGORY[e.category] ?? { label: e.category ?? "Event", accent: colors.textMuted }
      return {
        id: e.id,
        title: e.title ?? "Untitled event",
        category: e.category ?? "",
        categoryLabel: meta.label,
        accent: meta.accent,
        startDate: e.start_date,
        endDate: e.end_date ?? null,
        startTime: e.start_time ?? null,
        endTime: e.end_time ?? null,
        location: e.location?.replace(/\s*·\s*$/, "").trim() || null,
        externalLink: e.external_link ?? null,
        acceptsDropIn: acceptsDropIn(e.category ?? "", e.max_drop_ins ?? null),
      }
    })
}
