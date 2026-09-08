import AsyncStorage from "@react-native-async-storage/async-storage"
import Constants from "expo-constants"
import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import { clientHeader } from "@/lib/client-header"

const BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL
const INSTALLATION_KEY = "recruitnc.installationId"

type PushEvent = "app_launch" | "permission_granted" | "permission_denied" | "device_registered" | "registration_failed" | "alerts_enabled" | "alerts_disabled" | "prefs_updated"

async function installationId() {
  const existing = await AsyncStorage.getItem(INSTALLATION_KEY)
  if (existing) return existing
  const created = `ncu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
  await AsyncStorage.setItem(INSTALLATION_KEY, created)
  return created
}

export async function trackPushEvent(eventType: PushEvent, alertsEnabled?: boolean, metadata: Record<string, unknown> = {}) {
  try {
    if (!BASE) return
    const [id, permission] = await Promise.all([installationId(), Notifications.getPermissionsAsync()])
    await fetch(`${BASE}/api/push/telemetry`, {
      method: "POST",
      headers: { ...clientHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        installationId: id,
        eventType,
        platform: Platform.OS,
        permissionStatus: permission.status,
        alertsEnabled,
        appVersion: Constants.nativeAppVersion,
        buildNumber: Constants.nativeBuildVersion,
        metadata,
      }),
    })
  } catch {
    // Observability must never interrupt launch or notification setup.
  }
}

