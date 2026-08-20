const BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL

if (!BASE) {
  // supabase.ts throws on its own missing vars for the same reason. Without this the app builds
  // a request to "undefined/api/..." and every question fails with "Network request failed",
  // which tells nobody anything. Fail where the cause is legible.
  throw new Error("Missing EXPO_PUBLIC_WEB_BASE_URL")
}

/** The route's own ceiling is 120s. Give up first, so the UI is never stuck with no recourse. */
const REQUEST_TIMEOUT_MS = 100_000

/** Analytics label. The website sends "recruitnc-web"; keep the two surfaces distinguishable. */
const PROJECT = "recruitnc-ios"

export type ChatTurn = { role: "user" | "assistant"; content: string }

export type DawgReply = {
  answer: string
  messageId?: string
}

function requestHeaders(accessToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  return headers
}

/**
 * Talks to the same /api/ai/data-dawg-agent the website widget uses, so the app inherits the
 * existing agent, its query logging and its feedback loop rather than forking a second brain.
 *
 * `accessToken` is the Supabase session token when the user is signed in. Without it every
 * question from the app logged with a null user — the route falls back to SSR cookies, which a
 * native app does not have — so app usage could not be attributed and votes had nobody attached.
 */
export async function askDataDawg(
  message: string,
  history: ChatTurn[],
  opts: { accessToken?: string | null; signal?: AbortSignal } = {},
): Promise<DawgReply> {
  const response = await fetch(`${BASE}/api/ai/data-dawg-agent`, {
    method: "POST",
    headers: requestHeaders(opts.accessToken),
    body: JSON.stringify({
      message,
      conversationHistory: history.slice(-8),
      project: PROJECT,
    }),
    signal: opts.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  const data = (await response.json().catch(() => null)) as
    | { answer?: string; messageId?: string; error?: string }
    | null

  // The agent can answer with a non-2xx status; only treat it as failure when no answer came back.
  if (!data?.answer?.trim()) {
    throw new Error(data?.error ?? "Data Dawg could not answer that. Try rephrasing.")
  }

  return { answer: data.answer, messageId: data.messageId }
}

/** Mirrors the website's thumb vote so app feedback lands in the same review queue. */
export async function voteOnAnswer(
  messageId: string,
  vote: "up" | "down",
  accessToken?: string | null,
): Promise<void> {
  await fetch(`${BASE}/api/ai/data-dawg-agent`, {
    method: "POST",
    headers: requestHeaders(accessToken),
    body: JSON.stringify({ message: "", feedback: vote, messageId, project: PROJECT }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch(() => undefined)
}
