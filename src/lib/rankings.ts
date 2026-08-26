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
  highSchoolLogoUrl: string | null
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
    .sort((a, b) => a.graduationYear - b.graduationYear)
}


/**
 * "Washington highschool" and "Washington High School" are the same school as "Washington".
 * Logos are keyed on the tidy name, and the rankings feed is typed by hand, so the two only meet
 * after both sides are reduced to the same thing.
 */
function normalizeSchool(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,'&]/g, " ")
    .replace(/\bhigh\s*school\b|\bhighschool\b|\bhs\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** High school marks come from the same table the college marks do. */
async function fetchSchoolLogos(names: string[]): Promise<Record<string, string>> {
  if (names.length === 0) return {}
  const { data } = await supabase
    .from("logo_mappings")
    .select("entity_name, logo_url")
    .eq("entity_type", "highschool")

  const byNormalized = new Map<string, string>()
  for (const row of data ?? []) {
    if (!row.entity_name || !row.logo_url) continue
    byNormalized.set(normalizeSchool(row.entity_name), row.logo_url)
  }

  const out: Record<string, string> = {}
  for (const name of names) {
    const hit = byNormalized.get(normalizeSchool(name))
    if (hit) out[name] = hit
  }
  return out
}

/**
 * Photos live on the athlete, not on the ranking row — `profile_image_url` is null for every
 * published row, so the rankings looked photoless while the pictures sat one join away in the
 * same place the commitments list reads them from.
 */
async function fetchProspectPhotos(athleteIds: string[]): Promise<Record<string, string>> {
  if (athleteIds.length === 0) return {}
  const { data } = await supabase.from("athletes").select("id, photourl").in("id", athleteIds)
  const out: Record<string, string> = {}
  for (const row of data ?? []) if (row.photourl) out[row.id] = row.photourl
  return out
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

  const rows = data ?? []
  const athleteIds = [...new Set(rows.map((r) => (r as { prospect_id?: string | null }).prospect_id).filter(Boolean))] as string[]
  const schools = [...new Set(rows.map((r) => meaningful(r.high_school)).filter(Boolean))] as string[]

  const [photos, schoolLogos] = await Promise.all([
    fetchProspectPhotos(athleteIds),
    fetchSchoolLogos(schools),
  ])

  return rows.map((r) => {
    const athleteId = (r as { prospect_id?: string | null }).prospect_id ?? null
    const highSchool = meaningful(r.high_school)
    return {
      id: r.id,
      athleteId,
      name: r.name ?? "",
      highSchool,
      stateResult: meaningful(r.state_result),
      gpa: typeof r.academic_gpa === "number" ? r.academic_gpa : null,
      rankedWin: /^yes$/i.test(r.ranked_win ?? ""),
      rank: r.prospect_ranking ?? 0,
      photoUrl: r.profile_image_url ?? (athleteId ? photos[athleteId] ?? null : null),
      highSchoolLogoUrl: highSchool ? schoolLogos[highSchool] ?? null : null,
    }
  })
}
