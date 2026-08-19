const BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL

export type DropInPayload = {
  eventId: string
  wrestlerName: string
  wrestlerGraduationYear: string
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

/**
 * Mirrors lib/athlete-graduation-year.ts in the web app. Drop-ins are middle school and high
 * school only, and a valid graduation year is that check — seniors graduate at the end of the
 * current school year, current sixth graders six years later.
 */
export function graduationYearOptions(now: Date = new Date()): number[] {
  const seniors = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear()
  return Array.from({ length: 7 }, (_, i) => seniors + i)
}

