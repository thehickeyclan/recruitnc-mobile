import { useEffect } from "react"
import { AppState } from "react-native"
import * as Notifications from "expo-notifications"

import { fetchUnreadCount } from "@/lib/coach-messages"
import { useSession } from "@/lib/auth"

/**
 * The number on the app icon: coach conversations with something unread.
 *
 * A message alert sets it while the app is closed (the server puts the recipient's count on the
 * push). This keeps it honest afterwards - recounted whenever the app comes to the foreground and
 * after a conversation is read - so a badge never outlives the messages it was counting. Signed
 * out, it is cleared. Never throws: a badge is not worth an error.
 */
export async function syncAppBadge(signedIn: boolean): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(signedIn ? await fetchUnreadCount() : 0)
  } catch {
    // Badge permission off, or offline: leave the icon as it is.
  }
}

export function useAppBadge(): void {
  const { signedIn } = useSession()
  useEffect(() => {
    void syncAppBadge(signedIn)
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncAppBadge(signedIn)
    })
    return () => sub.remove()
  }, [signedIn])
}
