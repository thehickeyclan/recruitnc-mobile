const BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL

export type ChatTurn = { role: "user" | "assistant"; content: string }

export type DawgReply = {
  answer: string
  messageId?: string
}

/**
 * Talks to the same /api/ai/data-dawg-agent the website widget uses, so the app inherits the
 * existing agent, its query logging and its feedback loop rather than forking a second brain.
 */
export async function askDataDawg(message: string, history: ChatTurn[]): Promise<DawgReply> {
  const response = await fetch(`${BASE}/api/ai/data-dawg-agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversationHistory: history.slice(-8),
      project: "recruitnc",
    }),
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
export async function voteOnAnswer(messageId: string, vote: "up" | "down"): Promise<void> {
  await fetch(`${BASE}/api/ai/data-dawg-agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "", feedback: vote, messageId }),
  }).catch(() => undefined)
}
