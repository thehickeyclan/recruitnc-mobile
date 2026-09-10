import { clientHeader } from "@/lib/client-header"
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
  /** e.g. "2026 NHSCA All-American" — the strongest credential most of this list holds. */
  allAmerican: string | null
}

export type RankingClass = {
  graduationYear: number
  /** Stored lowercase in `public_rankings`; "male" or "female". */
  gender: RankingGender
  publishedAt: string | null
  count: number
}

/**
 * Rankings are published per class *and* per gender, and this app used to ignore the second half.
 *
 * `fetchRankings` filtered on graduation year alone, so every row for a class landed in one list.
 * That happened to look right only because nobody had ever written a girls' row into the table —
 * the web publish deliberately withheld them, because the day one was written it would have
 * appeared inside the boys' rankings on every phone.
 */
export type RankingGender = "male" | "female"

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
function genderOf(raw: unknown): RankingGender {
  return String(raw ?? "").trim().toLowerCase() === "female" ? "female" : "male"
}

export async function fetchRankingClasses(): Promise<RankingClass[]> {
  const { data, error } = await supabase
    .from("public_rankings")
    .select("graduation_year, gender, published_at")
    .eq("is_published", true)

  if (error) throw new Error(error.message)

  const byKey = new Map<string, RankingClass>()
  for (const row of data ?? []) {
    const year = row.graduation_year
    if (!year || !PUBLISHED_YEARS.includes(year)) continue
    const gender = genderOf((row as { gender?: unknown }).gender)
    const key = `${year}|${gender}`
    const existing = byKey.get(key)
    if (existing) {
      existing.count += 1
      if (row.published_at && (!existing.publishedAt || row.published_at > existing.publishedAt)) {
        existing.publishedAt = row.published_at
      }
    } else {
      byKey.set(key, { graduationYear: year, gender, publishedAt: row.published_at ?? null, count: 1 })
    }
  }

  return [...byKey.values()]
    .map((c) => ({ ...c, count: Math.min(c.count, maxRankFor(c.graduationYear)) }))
    .sort((a, b) => a.graduationYear - b.graduationYear || a.gender.localeCompare(b.gender))
}


/**
 * "Washington highschool" and "Washington High School" are the same school as "Washington".
 * Logos are keyed on the tidy name, and the rankings feed is typed by hand, so the two only meet
 * after both sides are reduced to the same thing.
 */
function normalizeSchool(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,'&-]/g, " ")
    .replace(/\bhigh\s*school\b|\bhighschool\b|\bhs\b/g, " ")
    // "St. Stephens" is the same school as "Saint Stephens"; both spellings are in the data.
    .replace(/\bst\b/g, "saint")
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


/**
 * All-American status, from the web app's credential engine rather than from a query of our own.
 *
 * This used to read `nhsca_placements` directly, filtered on `athlete_id`. That looked correct and
 * was not: 60 of the 106 All-American rows in that table carry no `athlete_id`, because a 2025
 * import shifted the first word of each wrestler's school onto the end of their name — "Jacob
 * Perry New", school "Bern". Rows like that were never linked, so the query dropped them without
 * erroring. The phone showed 5 All-Americans in the Class of 2028 where the website showed 9, and
 * which four went missing depended on nothing anybody could see from the outside.
 *
 * The web reconciles a name against the school and the seasons a wrestler could plausibly have
 * competed in, so it finds them whether or not the row was ever linked. Rather than port that
 * matcher into this repo — a fourth implementation of one question — the app asks for the answer.
 *
 * There is deliberately no fallback to the old query. A fallback means two answers again, and the
 * wrong one would only ever surface when nobody was watching. If this call fails the badges are
 * simply absent, which is what the broken query already produced for those wrestlers anyway.
 */
const CREDENTIALS_TIMEOUT_MS = 10_000

async function fetchAllAmericans(graduationYear: number): Promise<Record<string, string>> {
  const base = process.env.EXPO_PUBLIC_WEB_BASE_URL
  if (!base) return {}
  try {
    const response = await fetch(`${base}/api/public/rankings-credentials?year=${graduationYear}`, {
      headers: { ...clientHeader(), Accept: "application/json" },
      signal: AbortSignal.timeout(CREDENTIALS_TIMEOUT_MS),
    })
    if (!response.ok) return {}
    const body = (await response.json()) as {
      athletes?: { athleteId?: string; allAmerican?: { label?: string } | null }[]
    }
    const out: Record<string, string> = {}
    for (const row of body.athletes ?? []) {
      // The wording lives on the server, so the phone and the website cannot word it differently.
      if (row.athleteId && row.allAmerican?.label) out[row.athleteId] = row.allAmerican.label
    }
    return out
  } catch {
    return {}
  }
}

export async function fetchRankings(
  graduationYear: number,
  gender: RankingGender = "male",
): Promise<RankedProspect[]> {
  if (!PUBLISHED_YEARS.includes(graduationYear)) return []

  const { data, error } = await supabase
    .from("public_rankings")
    .select("id, prospect_id, name, high_school, state_result, academic_gpa, ranked_win, prospect_ranking, profile_image_url")
    .eq("is_published", true)
    .eq("graduation_year", graduationYear)
    // Stored lowercase; matched case-insensitively so a capitalised row cannot vanish.
    .ilike("gender", gender)
    .lte("prospect_ranking", maxRankFor(graduationYear))
    .gte("prospect_ranking", 1)
    .order("prospect_ranking", { ascending: true })

  if (error) throw new Error(error.message)

  const rows = data ?? []
  const athleteIds = [...new Set(rows.map((r) => (r as { prospect_id?: string | null }).prospect_id).filter(Boolean))] as string[]
  const schools = [...new Set(rows.map((r) => meaningful(r.high_school)).filter(Boolean))] as string[]

  const [photos, schoolLogos, allAmericans] = await Promise.all([
    fetchProspectPhotos(athleteIds),
    fetchSchoolLogos(schools),
    fetchAllAmericans(graduationYear),
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
      allAmerican: athleteId ? allAmericans[athleteId] ?? null : null,
    }
  })
}
