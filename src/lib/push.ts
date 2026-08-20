import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import Constants from "expo-constants"
import { Platform } from "react-native"

const BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL

export type AlertPrefs = {
  commits: boolean
  rankings: boolean
  events: boolean
  toc: boolean
}

/**
 * `toc` defaults on. The weight-class reveal cadence is the reason a lot of these installs
 * happen in the run-up to September, so a device that never opens More still hears about a
 * weight going live.
 */
export const DEFAULT_PREFS: AlertPrefs = { commits: true, rankings: false, events: false, toc: true }

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export class PushUnavailableError extends Error {}

/**
 * Remote push needs a development or production build — Expo Go cannot receive it, so this
 * surfaces a clear reason rather than silently returning no token during development.
 */
export async function registerForPush(): Promise<string> {
  if (!Device.isDevice) {
    throw new PushUnavailableError("Push notifications only work on a physical device, not a simulator.")
  }

  if (Constants.appOwnership === "expo") {
    throw new PushUnavailableError(
      "Push notifications need a development build. They cannot be delivered through Expo Go.",
    )
  }

  const existing = await Notifications.getPermissionsAsync()
  let status = existing.status
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status
  }
  if (status !== "granted") {
    throw new PushUnavailableError("Notifications are turned off. Enable them in iOS Settings to get alerts.")
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined
  if (!projectId) {
    throw new PushUnavailableError("No EAS project id — run `eas init` before push can be issued a token.")
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  return token
}

/**
 * Registration goes through the web app rather than an anon Supabase insert, so the token format
 * is validated server-side and push_devices needs no publicly writable RLS policy.
 */
export async function syncDevice(token: string, prefs: AlertPrefs): Promise<void> {
  const response = await fetch(`${BASE}/api/push/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expoPushToken: token, platform: Platform.OS, prefs }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? "Could not save your alert settings.")
  }
}
