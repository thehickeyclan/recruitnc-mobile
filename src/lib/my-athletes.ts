import { supabase } from "@/lib/supabase"
import { clientHeader } from "@/lib/client-header"

const BASE = (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://app.ncwrestlingunited.com").replace(/\/$/, "")

export type LinkedAthlete = { id: string; name: string; classYear: number | null; school: string | null; relationship: "self" | "parent" }
export type AthleteMatch = { id: string; name: string; classYear: number | null; school: string | null; linked: boolean }

/** The wrestlers this account is linked to and, with a query, matches to link. */
export async function fetchMyAthletes(query = ""): Promise<{ linked: LinkedAthlete[]; results: AthleteMatch[] }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Sign in to link your wrestler.")
  const qs = query.trim().length >= 2 ? `?q=${encodeURIComponent(query.trim())}` : ""
  const response = await fetch(`${BASE}/api/mobile/v1/my-athletes${qs}`, {
    headers: { ...clientHeader(), Authorization: `Bearer ${token}` },
  })
  const body = (await response.json().catch(() => null)) as
    | { linked?: LinkedAthlete[]; results?: AthleteMatch[]; error?: string }
    | null
  if (!response.ok) throw new Error(body?.error ?? "Could not load your wrestlers.")
  return { linked: body?.linked ?? [], results: body?.results ?? [] }
}
