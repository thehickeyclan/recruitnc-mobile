import { useEffect } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Notifications from "expo-notifications"

import { supabase } from "@/lib/supabase"
import { registerForPush, syncDevice, withAlertDefaults, type AlertPrefs } from "@/lib/push"

/** The key `lib/alert-prefs.ts` stores alert settings under. */
const PREFS_KEY = "recruitnc.alertPrefs"

/**
 * Keep this phone's alert registration tied to whoever is signed in.
 *
 * College-interest alerts go to a wrestler's family, so the server needs to know which account a
 * phone belongs to. Re-registering on launch links every phone already signed in the first time
 * the app opens after this update - nobody has to touch a setting - and signing in or out after
 * that relinks or unlinks it. Only when alerts are already on: this never raises the permission
 * prompt, which belongs to the moment someone asks for alerts.
 */
async function resync(signedOut: boolean): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as { prefs?: Partial<AlertPrefs>; enabled?: boolean }
    if (!saved.enabled) return
    const permission = await Notifications.getPermissionsAsync()
    if (permission.status !== "granted") return
    const token = await registerForPush()
    await syncDevice(token, withAlertDefaults(saved.prefs), { signedOut })
  } catch {
    // Best effort: the next launch or sign-in tries again.
  }
}

export function usePushAccountSync(): void {
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" && session) void resync(false)
      else if (event === "SIGNED_IN") void resync(false)
      else if (event === "SIGNED_OUT") void resync(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])
}
