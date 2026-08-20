import { supabase } from "./supabase"

export type RankedProspect = {
  id: number
  /** athletes.id — null when a ranking row was never linked to a directory profile. */
  athleteId: string | null
  name: string
  highSchool: string | null
  stateResult: string | null
  gpa: number | null
  rankedWin: boolean
  rank: number
  photoUrl: string | null
}

export type RankingClass = {
  graduationYear: number
  publishedAt: string | null
  count: number
}

/**
 * Mirrors lib/public-rankings-cap.ts in the web app. RecruitNC publishes a top 30, and only for
 * the classes listed here — the DB's is_published flag is true for classes 2025 and 2026 too, so
 * trusting it alone puts unpublished rankings on a public surface.
 *
 * Duplicated rather than fetched because neither web endpoint is usable anonymously: /api/rankings
 * returns nothing (it reads a different source) and /api/public-rankings requires auth. If the cap
 * or the published years change, this file has to change with them.
 */
const PUBLIC_RANKINGS_MAX_BY_YEAR: Record<number, number> = {
  2027: 30,
  2028: 30,
}

const PUBLISHED_YEARS = Object.keys(PUBLIC_RANKINGS_MAX_BY_YEAR).map(Number)

function maxRankFor(year: number): number {
  return PUBLIC_RANKINGS_MAX_BY_YEAR[year] ?? 30
}

const meaningful = (v: string | null) =>
  v && v.trim() && !/^(n\/a|tbd|none|no)$/i.test(v.trim()) ? v.trim() : null

/**
 * Rankings are grouped by graduation class, not weight — weight_class reads "TBD" on all but one
 * row, so it is never surfaced. Each class is published as its own edition.
 */
export async function fetchRankingClasses(): Promise<RankingClass[]> {
  const { data, error } = await supabase
    .from("public_rankings")
    .select("graduation_year, published_at")
    .eq("is_published", true)

  if (error) throw new Error(error.message)

  const byYear = new Map<number, RankingClass>()
  for (const row of data ?? []) {
    const year = row.graduation_year
    if (!year || !PUBLISHED_YEARS.includes(year)) continue
    const existing = byYear.get(year)
    if (existing) {
      existing.count += 1
      if (row.published_at && (!existing.publishedAt || row.published_at > existing.publishedAt)) {
        existing.publishedAt = row.published_at
      }
    } else {
      byYear.set(year, { graduationYear: year, publishedAt: row.published_at ?? null, count: 1 })
    }
  }

  return [...byYear.values()]
    .map((c) => ({ ...c, count: Math.min(c.count, maxRankFor(c.graduationYear)) }))
    .sort((a, b) => b.graduationYear - a.graduationYear)
}

export async function fetchRankings(graduationYear: number): Promise<RankedProspect[]> {
  if (!PUBLISHED_YEARS.includes(graduationYear)) return []

  const { data, error } = await supabase
    .from("public_rankings")
    .select("id, prospect_id, name, high_school, state_result, academic_gpa, ranked_win, prospect_ranking, profile_image_url")
    .eq("is_published", true)
    .eq("graduation_year", graduationYear)
    .lte("prospect_ranking", maxRankFor(graduationYear))
    .gte("prospect_ranking", 1)
    .order("prospect_ranking", { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => ({
    id: r.id,
    athleteId: (r as { prospect_id?: string | null }).prospect_id ?? null,
    name: r.name ?? "",
    highSchool: meaningful(r.high_school),
    stateResult: meaningful(r.state_result),
    gpa: typeof r.academic_gpa === "number" ? r.academic_gpa : null,
    rankedWin: /^yes$/i.test(r.ranked_win ?? ""),
    rank: r.prospect_ranking ?? 0,
    photoUrl: r.profile_image_url ?? null,
  }))
}
