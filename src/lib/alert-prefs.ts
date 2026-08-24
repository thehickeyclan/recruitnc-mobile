import { useCallback, useEffect, useState } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { DEFAULT_PREFS, PushUnavailableError, registerForPush, syncDevice, type AlertPrefs } from "@/lib/push"

/**
 * Alert preferences, shared by every screen that shows a toggle.
 *
 * Extracted the moment a second screen needed them: two components owning the same AsyncStorage
 * key is how one of them ends up writing a shape the other cannot read. The device is the source
 * of truth locally; the server is told whenever alerts are on.
 */

const PREFS_KEY = "recruitnc.alertPrefs"

export type AlertPrefsState = {
  prefs: AlertPrefs
  enabled: boolean
  busy: boolean
  notice: string | null
  setNotice: (value: string | null) => void
  /** Turn alerts on for this device, asking the OS for permission. */
  enable: () => Promise<void>
  /** Flip one alert. Saves locally either way; only syncs when alerts are on. */
  toggle: (key: keyof AlertPrefs, value: boolean) => Promise<void>
}

export function useAlertPrefs(): AlertPrefsState {
  const [prefs, setPrefs] = useState<AlertPrefs>(DEFAULT_PREFS)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void AsyncStorage.getItem(PREFS_KEY).then((raw) => {
      if (!raw) return
      try {
        const saved = JSON.parse(raw) as { prefs: AlertPrefs; enabled: boolean }
        setPrefs(saved.prefs ?? DEFAULT_PREFS)
        setEnabled(Boolean(saved.enabled))
      } catch {
        // A corrupt blob should not stop the screen rendering — defaults are correct enough.
      }
    })
  }, [])

  const persist = useCallback(async (next: AlertPrefs, on: boolean) => {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ prefs: next, enabled: on }))
  }, [])

  const enable = useCallback(async () => {
    setBusy(true)
    setNotice(null)
    try {
      const token = await registerForPush()
      await syncDevice(token, prefs)
      setEnabled(true)
      await persist(prefs, true)
      setNotice("Alerts are on for this device.")
    } catch (e) {
      setEnabled(false)
      setNotice(
        e instanceof PushUnavailableError || e instanceof Error ? e.message : "Could not turn on alerts.",
      )
    } finally {
      setBusy(false)
    }
  }, [prefs, persist])

  const toggle = useCallback(
    async (key: keyof AlertPrefs, value: boolean) => {
      const next = { ...prefs, [key]: value }
      setPrefs(next)
      await persist(next, enabled)
      if (!enabled) return
      try {
        const token = await registerForPush()
        await syncDevice(token, next)
      } catch {
        setNotice("Saved on this device, but we could not reach the server to update it.")
      }
    },
    [prefs, enabled, persist],
  )

  return { prefs, enabled, busy, notice, setNotice, enable, toggle }
}
