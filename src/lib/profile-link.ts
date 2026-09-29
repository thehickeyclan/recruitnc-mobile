import * as WebBrowser from "expo-web-browser"
import { colors } from "@/theme/tokens"
import { supabase } from "@/lib/supabase"
import { clientHeader } from "@/lib/client-header"
import { handoffUrl } from "@/lib/web-handoff-url"

const BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL

/** Long enough for a slow cell connection, short enough that a tap never feels dead. */
const HANDOFF_TIMEOUT_MS = 4000

/**
 * Opens an athlete's profile.
 *
 * The match log, highlights, academics and the scouting report still live on the web, so this
 * goes there — but through `openBrowserAsync`, which presents SFSafariViewController *over* the
 * app rather than handing the person to Safari. The app keeps running underneath, its state
 * survives, and Done returns in one tap. `Linking.openURL` would leave the app entirely, which is
 * the version of this that people never come back from.
 *
 * Chrome is tinted to match so the transition reads as part of the app rather than a hand-off.
 */
export function profileUrl(athleteId: string): string | null {
  const path = profilePath(athleteId)
  if (!path || !BASE) return null
  return `${BASE}${path}`
}

function profilePath(athleteId: string): string | null {
  const id = String(athleteId ?? "").trim()
  return id ? `/view-profile?id=${encodeURIComponent(id)}` : null
}

/**
 * The same page, arriving signed in.
 *
 * The Safari sheet has its own cookie jar, so without this a signed-in coach reaches the profile
 * signed out and the scouting report button — which the page shows only to coaches it knows —
 * is simply not there. The server mints a one-time sign-in for this account and the web page
 * spends it (see /api/mobile/v1/web-handoff on the website).
 *
 * Signed out, or if the handoff fails for any reason, this is the plain page: exactly what
 * opened before, never a dead tap.
 */
async function signedInUrl(path: string): Promise<string | null> {
  if (!BASE) return null
  const plain = `${BASE}${path}`
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return plain

    const response = await fetch(`${BASE.replace(/\/$/, "")}/api/mobile/v1/web-handoff`, {
      method: "POST",
      headers: { ...clientHeader(), Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(HANDOFF_TIMEOUT_MS),
    })
    if (!response.ok) return plain
    const body = (await response.json()) as { tokenHash?: string; userId?: string }
    if (!body.tokenHash || !body.userId) return plain
    return handoffUrl(BASE, path, body.tokenHash, body.userId)
  } catch {
    return plain
  }
}

export function openAthleteProfile(athleteId: string | null | undefined): void {
  const path = athleteId ? profilePath(athleteId) : null
  if (!path) return

  void signedInUrl(path).then((url) => {
    if (!url) return
    return WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      toolbarColor: colors.ink,
      controlsColor: colors.gold,
      dismissButtonStyle: "done",
    })
  }).catch(() => undefined)
}
