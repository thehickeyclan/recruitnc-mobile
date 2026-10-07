import { supabase } from "@/lib/supabase"
import { clientHeader } from "@/lib/client-header"

/**
 * Coach → prospect messages, through the web app's /api/coach-messages routes (they accept the
 * app's bearer token). The rules live on the server (lib/coach-messages.ts in the web repo):
 * coaches start every conversation, the wrestler and every linked parent see it and may reply,
 * and the family can report a conversation or stop a coach.
 */

const BASE = (process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://app.ncwrestlingunited.com").replace(/\/$/, "")

export type ThreadRole = "coach" | "athlete" | "parent" | "admin"

export type ThreadSummary = {
  id: string
  athleteId: string
  athleteName: string
  coachName: string
  program: string | null
  lastMessageAt: string
  lastMessagePreview: string
  lastSenderRole: string | null
  unread: boolean
  stopped: boolean
  viewerRole: Exclude<ThreadRole, "admin">
  /** The other side wrote last (servers before 7 Oct 2026 omit it). */
  yourTurn?: boolean
}

export type ThreadMessage = { id: string; body: string; senderRole: string; senderName: string; createdAt: string; mine: boolean }

export type ThreadDetail = {
  id: string
  athleteId: string
  athleteName: string
  coachName: string
  program: string | null
  stopped: boolean
  viewerRole: ThreadRole
  canReply: boolean
  messages: ThreadMessage[]
}

async function call<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Sign in to see your messages.")
  const response = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      ...clientHeader(),
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null
  if (!response.ok) throw new Error(body?.error ?? "Something went wrong. Try again.")
  return body as T
}

/** Every conversation this account is in; `athleteId` narrows to one wrestler. */
export async function fetchThreads(athleteId?: string): Promise<ThreadSummary[]> {
  const qs = athleteId ? `?athleteId=${encodeURIComponent(athleteId)}` : ""
  return (await call<{ threads?: ThreadSummary[] }>(`/api/coach-messages${qs}`)).threads ?? []
}

export async function fetchThread(id: string): Promise<ThreadDetail> {
  return (await call<{ thread: ThreadDetail }>(`/api/coach-messages/${encodeURIComponent(id)}`)).thread
}

export async function sendReply(id: string, body: string): Promise<void> {
  await call(`/api/coach-messages/${encodeURIComponent(id)}`, { method: "POST", body: { body } })
}

export async function setStopped(id: string, stopped: boolean): Promise<void> {
  await call(`/api/coach-messages/${encodeURIComponent(id)}/stop`, { method: "POST", body: { stopped } })
}

export async function reportThread(id: string, reason: string): Promise<void> {
  await call(`/api/coach-messages/${encodeURIComponent(id)}/report`, { method: "POST", body: { reason } })
}

export type MessagingSummary = {
  unread: number
  total: number
  /** Coaches and admins always; anyone else only once a coach has written to them. */
  show: boolean
  /** A coach staff have confirmed: may start conversations. */
  canStart: boolean
}

/** Nothing to show when signed out or offline. Servers before 7 Oct 2026 send only `unread`. */
export async function fetchMessagingSummary(): Promise<MessagingSummary> {
  try {
    const d = await call<Partial<MessagingSummary>>("/api/coach-messages/unread")
    const unread = Number(d.unread) || 0
    return { unread, total: Number(d.total) || 0, show: d.show ?? unread > 0, canStart: Boolean(d.canStart) }
  } catch {
    return { unread: 0, total: 0, show: false, canStart: false }
  }
}

/** Zero when signed out or offline - this only drives a badge. */
export async function fetchUnreadCount(): Promise<number> {
  return (await fetchMessagingSummary()).unread
}

export type Eligibility = { show: boolean; canSend?: boolean; threadId?: string | null; message?: string }

/** Whether this account may message this wrestler (a confirmed college coach), and any existing thread. */
export async function fetchEligibility(athleteId: string): Promise<Eligibility> {
  try {
    return await call<Eligibility>(`/api/coach-messages/eligibility?athleteId=${encodeURIComponent(athleteId)}`)
  } catch {
    return { show: false }
  }
}

/** A coach's first message to a wrestler; returns the conversation it opened. */
export async function startConversation(athleteId: string, body: string): Promise<string> {
  const r = await call<{ threadId: string }>("/api/coach-messages", { method: "POST", body: { athleteId, body } })
  return r.threadId
}

/** The name a thread is listed under: the coach for a family, the wrestler for a coach. */
export function threadTitle(t: Pick<ThreadSummary, "viewerRole" | "athleteName" | "coachName">): string {
  return t.viewerRole === "coach" ? t.athleteName || "Wrestler" : t.coachName
}

export function shortDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
