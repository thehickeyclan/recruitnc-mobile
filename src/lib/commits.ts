import { supabase } from "./supabase"

/** Short labels — "NCAA Division I" is far too wide for a filter chip. */
const DIVISION_LABEL: Record<string, string> = {
  "NCAA Division I": "DI",
  "NCAA Division II": "DII",
  "NCAA Division III": "DIII",
  "NCAA Division I (FCS Football)": "DI",
  NAIA: "NAIA",
  NJCAA: "NJCAA",
  Club: "Club",
  Other: "Other",
}

export type Commit = {
  id: string
  name: string
  college: string
  highschool: string | null
  weightclass: string | null
  graduationyear: number | null
  photourl: string | null
  commitmentdate: string | null
  collegeLogoUrl: string | null
  division: string | null
}

/** "University of North Carolina at Pembroke" → "north carolina pembroke" */
function normalizeCollege(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,&']/g, " ")
    .replace(/\b(university|college|the|of|at|and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Marks come from logo_mappings. Match exact name first, then the suffix-stripped form —
 * the athletes table stores "Appalachian State" while logo_mappings holds "Appalachian State
 * University", so an exact-only match silently drops logos for a good share of colleges.
 */
async function fetchCollegeLogos(colleges: string[]): Promise<Record<string, string>> {
  if (colleges.length === 0) return {}

  const { data, error } = await supabase
    .from("logo_mappings")
    .select("entity_name, logo_url")
    .eq("entity_type", "college")

  if (error || !data) return {}

  const exact: Record<string, string> = {}
  const loose: Record<string, string> = {}
  for (const row of data) {
    if (!row.entity_name || !row.logo_url) continue
    exact[row.entity_name.trim().toLowerCase()] = row.logo_url
    const key = normalizeCollege(row.entity_name)
    // Shortest matching name wins so "Ohio" doesn't get overwritten by "Ohio State".
    if (key && (!loose[key] || row.entity_name.length < loose[key].length)) loose[key] = row.logo_url
  }

  const out: Record<string, string> = {}
  for (const college of colleges) {
    const hit = exact[college.trim().toLowerCase()] ?? loose[normalizeCollege(college)]
    if (hit) out[college] = hit
  }
  return out
}

/** Division lives on the college, not the athlete, so it is resolved through college_id. */
async function fetchDivisions(collegeIds: string[]): Promise<Record<string, string>> {
  if (collegeIds.length === 0) return {}
  const { data, error } = await supabase.from("colleges").select("id, division").in("id", collegeIds)
  if (error || !data) return {}
  const out: Record<string, string> = {}
  for (const row of data) {
    if (row.id && row.division) out[row.id] = DIVISION_LABEL[row.division] ?? row.division
  }
  return out
}

export async function fetchCommits(limit = 300): Promise<{ commits: Commit[]; total: number }> {
  const { data, error, count } = await supabase
    .from("athletes")
    .select(
      "id, name, college, college_id, highschool, weightclass, graduationyear, photourl, commitmentdate",
      { count: "exact" },
    )
    .not("college", "is", null)
    .neq("college", "")
    .order("commitmentdate", { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  const rows = data ?? []

  const [logos, divisions] = await Promise.all([
    fetchCollegeLogos([...new Set(rows.map((r) => r.college).filter(Boolean))]),
    fetchDivisions([...new Set(rows.map((r) => r.college_id).filter(Boolean))] as string[]),
  ])

  return {
    total: count ?? rows.length,
    commits: rows.map((r) => ({
      id: r.id,
      name: r.name ?? "",
      college: r.college ?? "",
      highschool: r.highschool ?? null,
      weightclass: r.weightclass ?? null,
      graduationyear: r.graduationyear ?? null,
      photourl: r.photourl ?? null,
      commitmentdate: r.commitmentdate ?? null,
      collegeLogoUrl: logos[r.college] ?? null,
      division: r.college_id ? divisions[r.college_id] ?? null : null,
    })),
  }
}
