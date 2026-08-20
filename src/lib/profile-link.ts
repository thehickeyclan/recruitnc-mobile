import * as WebBrowser from "expo-web-browser"
import { colors } from "@/theme/tokens"

const BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL

/**
 * Opens an athlete's profile.
 *
 * The app has no profile screen yet, so this goes to the web one — but through
 * `openBrowserAsync`, which presents SFSafariViewController *over* the app rather than handing
 * the person to Safari. The app keeps running underneath, its state survives, and Done returns
 * in one tap. `Linking.openURL` would leave the app entirely, which is the version of this that
 * people never come back from.
 *
 * Chrome is tinted to match so the transition reads as part of the app rather than a hand-off.
 */
export function profileUrl(athleteId: string): string | null {
  const id = String(athleteId ?? "").trim()
  if (!id || !BASE) return null
  return `${BASE}/view-profile?id=${encodeURIComponent(id)}`
}

export function openAthleteProfile(athleteId: string | null | undefined): void {
  if (!athleteId) return
  const url = profileUrl(athleteId)
  if (!url) return

  void WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    toolbarColor: colors.ink,
    controlsColor: colors.gold,
    dismissButtonStyle: "done",
  }).catch(() => undefined)
}
