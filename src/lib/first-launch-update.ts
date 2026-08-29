import { useEffect, useState } from "react"
import * as Updates from "expo-updates"
import { shouldWaitForUpdate } from "@/lib/update-gate"

/**
 * Applies a pending update before a brand-new install shows anything.
 *
 * The binary carries the JavaScript it was compiled with, and the app is set to launch instantly
 * and fetch newer code in the background — which means the first launch after a download shows
 * whatever was current on build day, and the real app only appears when somebody happens to open
 * it a second time. Build 15 went to the App Store on 25 August; by the 29th a first launch was
 * missing the TOC tab, the ticket link and the whole leaderboard rework.
 *
 * So on that one launch — the embedded one, the first after install or after an app update — the
 * splash stays up while the newer bundle is fetched, then the app restarts into it. Every other
 * launch is untouched and still instant.
 *
 * It gives up after a few seconds. A slow network must cost somebody a stale first screen, never
 * an app that will not start.
 */

export const MAX_WAIT_MS = 6000

export function useFirstLaunchUpdate(): boolean {
  const [ready, setReady] = useState(
    () =>
      !shouldWaitForUpdate({
        isEnabled: Updates.isEnabled,
        isEmbeddedLaunch: Updates.isEmbeddedLaunch,
        isDevelopment: __DEV__,
      }),
  )

  useEffect(() => {
    if (ready) return
    let done = false
    const finish = () => {
      if (done) return
      done = true
      setReady(true)
    }

    // Whatever happens below, the app starts.
    const timer = setTimeout(finish, MAX_WAIT_MS)

    void (async () => {
      try {
        const check = await Updates.checkForUpdateAsync()
        if (!check.isAvailable) return finish()
        await Updates.fetchUpdateAsync()
        clearTimeout(timer)
        // Restarts into the new bundle, so nothing after this runs.
        await Updates.reloadAsync()
      } catch {
        finish()
      }
    })()

    return () => {
      done = true
      clearTimeout(timer)
    }
  }, [ready])

  return ready
}
