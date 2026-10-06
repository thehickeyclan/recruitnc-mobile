import { supabase } from "@/lib/supabase"
import { clientHeader } from "@/lib/client-header"

const BASE = (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://app.ncwrestlingunited.com").replace(/\/$/, "")

export type NewProfile = {
  relationship: "self" | "parent"
  /** A parent's typed name - their signature on the consent, as when claiming. */
  signedName?: string
  firstName: string
  lastName: string
  gender: "Male" | "Female"
  graduationYear: number
  highSchool: string
  weightClass: string
  club?: string
  /** Optional; the server range-checks and drops anything out of range. */
  academicGpa?: string
  academicSat?: string
  academicAct?: string
  academicInterest?: string
}

export type CreateResult =
  | { kind: "created"; athleteId: string; athleteName: string }
  /** The site already has someone by that name, class and school - ask before making a second. */
  | { kind: "existing"; athleteId: string; athleteName: string; highSchool: string; graduationYear: number }

/** Boys' and girls' NCHSAA weight classes. */
export const WEIGHTS = {
  Male: ["106", "113", "120", "126", "132", "138", "144", "150", "157", "165", "175", "190", "215", "285"],
  Female: ["100", "107", "114", "120", "126", "132", "138", "145", "152", "165", "185", "235"],
} as const

/** High school classes only - there are no middle-school profiles. */
export function graduationYears(now: Date = new Date()): number[] {
  // From July a class has graduated, so the youngest high-school class moves on too.
  const senior = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear()
  return [senior, senior + 1, senior + 2, senior + 3]
}

export async function createProfile(input: NewProfile, forceCreate = false): Promise<CreateResult> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Sign in first.")

  const response = await fetch(`${BASE}/api/profile/create-athlete`, {
    method: "POST",
    headers: { ...clientHeader(), "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...input, wrestlingClub: input.club ?? null, forceCreate }),
    signal: AbortSignal.timeout(30_000),
  })
  const body = (await response.json().catch(() => null)) as
    | {
        success?: boolean
        existing?: boolean
        athleteId?: string
        athleteName?: string
        highschool?: string
        graduationYear?: number
        error?: string
        details?: string
      }
    | null
  if (!response.ok || !body?.success || !body.athleteId) {
    throw new Error(body?.error ?? "Could not create the profile. Try again.")
  }
  if (body.existing) {
    return {
      kind: "existing",
      athleteId: body.athleteId,
      athleteName: body.athleteName ?? `${input.firstName} ${input.lastName}`,
      highSchool: body.highschool ?? input.highSchool,
      graduationYear: body.graduationYear ?? input.graduationYear,
    }
  }
  return { kind: "created", athleteId: body.athleteId, athleteName: body.athleteName ?? `${input.firstName} ${input.lastName}` }
}
