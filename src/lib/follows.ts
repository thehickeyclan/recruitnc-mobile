import { supabase } from "@/lib/supabase"
import { clientHeader } from "@/lib/client-header"

const BASE = (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://app.ncwrestlingunited.com").replace(/\/$/, "")

export type FollowedAthlete = {
  id: string
  name: string
  classYear: number | null
  school: string | null
  weight: string | null
  photoUrl: string | null
  college: string | null
}

async function token(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

/** The wrestlers this account follows. Signed out is an empty list, not an error. */
export async function fetchFollows(): Promise<FollowedAthlete[]> {
  const accessToken = await token()
  if (!accessToken) return []
  const response = await fetch(`${BASE}/api/mobile/v1/follows`, {
    headers: { ...clientHeader(), Authorization: `Bearer ${accessToken}` },
  })
  const body = (await response.json().catch(() => null)) as { athletes?: FollowedAthlete[]; error?: string } | null
  if (!response.ok) throw new Error(body?.error ?? "Could not load who you follow.")
  return body?.athletes ?? []
}

/** Whether this account follows one wrestler — the Follow button's state on load. */
export async function fetchFollowState(athleteId: string): Promise<boolean> {
  const accessToken = await token()
  if (!accessToken) return false
  const response = await fetch(`${BASE}/api/mobile/v1/follows?athleteId=${encodeURIComponent(athleteId)}`, {
    headers: { ...clientHeader(), Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) return false
  const body = (await response.json().catch(() => null)) as { following?: boolean } | null
  return body?.following === true
}

/**
 * Follow or unfollow, returning the state that is now true.
 *
 * The caller flips its own button first and calls this after, so a tap feels instant; a thrown
 * error is the caller's cue to put the button back.
 */
export async function setFollowing(athleteId: string, following: boolean): Promise<boolean> {
  const accessToken = await token()
  if (!accessToken) throw new Error("Sign in to follow wrestlers.")
  const response = await fetch(`${BASE}/api/mobile/v1/follows`, {
    method: following ? "POST" : "DELETE",
    headers: { ...clientHeader(), Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ athleteId }),
  })
  const body = (await response.json().catch(() => null)) as { following?: boolean; error?: string } | null
  if (!response.ok) throw new Error(body?.error ?? "Could not save that.")
  return body?.following ?? following
}
