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

export async function fetchBlueBillingMemberships(): Promise<BlueBillingMembership[]> {
  const response = await fetch(`${BASE}/api/blue/my-memberships`, { headers: await authHeaders() })
  if (!response.ok) throw new Error(await readError(response, "Could not load your Blue subscription."))
  const body = (await response.json()) as { memberships?: BlueBillingMembership[] }
  return body.memberships ?? []
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
