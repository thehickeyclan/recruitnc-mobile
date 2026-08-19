const BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL

export type DropInPayload = {
  eventId: string
  wrestlerName: string
  wrestlerDob: string
  wrestlerWeight?: string
  parentName: string
  parentEmail: string
  parentPhone?: string
  notes?: string
  waiverAccepted: boolean
}

/**
 * Posts to the web app's checkout route rather than talking to Stripe directly. That route owns
 * capacity checks against max_drop_ins, waiver versioning, DOB/age validation and the drop_in_requests
 * record — reimplementing any of it here would let the two paths drift.
 */
export async function createDropInCheckout(payload: DropInPayload): Promise<string> {
  const response = await fetch(`${BASE}/api/calendar/stripe/create-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  const data = (await response.json().catch(() => null)) as
    | { checkoutUrl?: string; error?: string }
    | null

  if (!response.ok || !data?.checkoutUrl) {
    throw new Error(data?.error ?? "Could not start checkout. Please try again.")
  }
  return data.checkoutUrl
}

/** Server enforces 5–18; checked here too so the user isn't sent to Stripe only to bounce. */
export function ageFromDob(input: string): number | null {
  const m = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, mm, dd, yyyy] = m
  const dob = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  if (Number.isNaN(dob.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const before = now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
  if (before) age -= 1
  return age
}

