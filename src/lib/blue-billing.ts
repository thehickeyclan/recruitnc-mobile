import { clientHeader } from "@/lib/client-header"
import { supabase } from "@/lib/supabase"

const BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL

export type BlueBillingMembership = {
  id: string
  athleteName: string
  status: string
  endedAt: string | null
  stripeCustomerId: string | null
  nextBillingAt: string | null
  lastPaymentAt: string | null
  amountFormatted: string | null
  cancelAtPeriodEnd: boolean
  /** Set while a subscription is paused: the date billing starts again. */
  resumeAt: string | null
  startedAt: string | null
  cardBrand: string | null
  cardLast4: string | null
  planName: string | null
  source: "live" | "cached" | "unavailable"
  recentInvoices: { id: string; date: string; amountFormatted: string; status: string }[]
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Sign in to manage your Blue subscription.")
  return {
    ...clientHeader(),
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

/**
 * A WrestlingIQ subscription — the original Blue cohort, billed outside this app.
 *
 * Read-only. There is no write path to WrestlingIQ, so the screen shows what we last imported
 * and points the parent at wrestlingiq.com rather than offering a button that cannot work.
 */
export type BlueWiqSubscription = {
  id: string
  athleteName: string
  status: string
  current: boolean
  comped: boolean
  memberSince: string | null
  nextDueAt: string | null
  activeUntil: string | null
  amountFormatted: string | null
  discountCode: string | null
}

export type BlueBillingState = {
  memberships: BlueBillingMembership[]
  wiqSubscriptions: BlueWiqSubscription[]
}

export async function fetchBlueBilling(): Promise<BlueBillingState> {
  const response = await fetch(`${BASE}/api/blue/my-memberships`, { headers: await authHeaders() })
  if (!response.ok) throw new Error(await readError(response, "Could not load your Blue subscription."))
  const body = (await response.json()) as Partial<BlueBillingState>
  return { memberships: body.memberships ?? [], wiqSubscriptions: body.wiqSubscriptions ?? [] }
}

/** Kept for callers that only want the Stripe side. */
export async function fetchBlueBillingMemberships(): Promise<BlueBillingMembership[]> {
  return (await fetchBlueBilling()).memberships
}

export async function createBlueBillingPortal(customerId: string): Promise<string> {
  const response = await fetch(`${BASE}/api/blue/billing-portal`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ customerId }),
  })
  if (!response.ok) throw new Error(await readError(response, "Could not open secure billing."))
  const body = (await response.json()) as { url?: string }
  if (!body.url) throw new Error("Stripe did not return a billing link.")
  return body.url
}

export async function cancelBlueBillingMembership(membershipId: string): Promise<string> {
  const response = await fetch(`${BASE}/api/blue/membership/${encodeURIComponent(membershipId)}`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ action: "cancel", atPeriodEnd: true }),
  })
  if (!response.ok) throw new Error(await readError(response, "Could not cancel the subscription."))
  const body = (await response.json()) as { message?: string }
  return body.message ?? "Subscription will cancel at the end of the billing period."
}

/**
 * One call for every membership action the web already supports.
 *
 * The app shipped with cancel and nothing else, which gave a family the destructive option and
 * withheld the reversible one — a parent facing an injury or a thin month could end their
 * membership from their phone but not pause it. Pause is the retention tool; offering only
 * cancel was backwards.
 */
async function membershipAction(
  membershipId: string,
  body: Record<string, unknown>,
  fallbackError: string,
): Promise<string> {
  const response = await fetch(`${BASE}/api/blue/membership/${encodeURIComponent(membershipId)}`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await readError(response, fallbackError))
  const payload = (await response.json()) as { message?: string }
  return payload.message ?? "Done."
}

/** Pause billing until `resumeAt` (an ISO date). */
export async function pauseBlueBillingMembership(membershipId: string, resumeAt: string): Promise<string> {
  return membershipAction(membershipId, { action: "pause", resumeAt }, "Could not pause the subscription.")
}

export async function resumeBlueBillingMembership(membershipId: string): Promise<string> {
  return membershipAction(membershipId, { action: "resume" }, "Could not resume the subscription.")
}

/** After a failed payment: ask Stripe to charge the card on file again. */
export async function retryBlueBillingPayment(membershipId: string): Promise<string> {
  return membershipAction(membershipId, { action: "retry-payment" }, "Could not retry the payment.")
}
