import { supabase } from "@/lib/supabase"
import { clientHeader } from "@/lib/client-header"

const BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL

export type MembershipCard = {
  athleteId: string
  name: string
  photoUrl: string | null
  graduationYear: number | null
  status: "active" | "paused" | "inactive"
  memberSince: string | null
  dropInEligible: boolean
  dropInAvailableFrom: string | null
  lastDropIn: { checkedInAt: string; clubName: string } | null
  staleWarning: string | null
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return {
    ...clientHeader(),
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/**
 * Membership status comes from the web app, never from the device.
 *
 * The card is shown at a partner club's door to claim free mat time, so what it asserts has to be
 * decided somewhere the holder cannot edit. The screen renders what this returns and computes
 * nothing of its own beyond the clock.
 */
export async function fetchMembershipCards(): Promise<MembershipCard[]> {
  const res = await fetch(`${BASE}/api/blue/membership-card`, { headers: await authHeaders() })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? "Could not load your membership.")
  }
  const data = (await res.json()) as { cards?: MembershipCard[] }
  return data.cards ?? []
}

/** Records a drop-in. Called when a partner club's coach taps the card in front of them. */
export async function recordDropIn(athleteId: string, clubName: string): Promise<void> {
  const res = await fetch(`${BASE}/api/blue/drop-in-checkin`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ athleteId, clubName }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? "Could not record that drop-in.")
  }
}
