import { supabase } from "./supabase"

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

export async function fetchCommits(limit = 300): Promise<{ commits: Commit[]; total: number }> {
  const { data, error, count } = await supabase
    .from("athletes")
    .select(
      "id, name, college, highschool, weightclass, graduationyear, photourl, commitmentdate",
      { count: "exact" },
    )
    .not("college", "is", null)
    .neq("college", "")
    .order("commitmentdate", { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  const rows = data ?? []

  const logos = await fetchCollegeLogos([...new Set(rows.map((r) => r.college).filter(Boolean))])

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
    })),
  }
}
