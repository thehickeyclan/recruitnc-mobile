import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { DEFAULT_PREFS, PushUnavailableError, registerForPush, syncDevice } from "@/lib/push"

const PRIMED_KEY = "recruitnc.alertsPrimed"

/** Let the first screen paint before asking for anything. */
const APPEAR_DELAY_MS = 1200

/**
 * Asks once, on first launch, whether to turn on alerts.
 *
 * iOS grants exactly one system permission prompt for the lifetime of an install — decline it
 * and the only way back is the Settings app. So this asks our own question first and spends the
 * system prompt only on a yes. Someone who taps "Not now" can still turn alerts on from More
 * with the real prompt intact.
 *
 * It leads with the Tournament of Champions because that is the reason to say yes right now:
 * weight classes are being released one at a time between now and September.
 */
export function AlertsPrimer() {
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      void AsyncStorage.getItem(PRIMED_KEY).then((seen) => {
        if (!cancelled && !seen) setVisible(true)
      })
    }, APPEAR_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  // Asked once, whatever the answer — including a decline, and including a simulator that
  // cannot register. Re-prompting someone who said no is how apps get their notifications
  // turned off at the OS level.
  const close = useCallback(async () => {
    setVisible(false)
    await AsyncStorage.setItem(PRIMED_KEY, "1").catch(() => undefined)
  }, [])

  const enable = useCallback(async () => {
    setBusy(true)
    setProblem(null)
    try {
      const token = await registerForPush()
      await syncDevice(token, DEFAULT_PREFS)
      await close()
    } catch (e) {
      // Surface the reason rather than a dead button — "needs a real device" and "you turned
      // notifications off in Settings" are different problems with different fixes.
      setProblem(
        e instanceof PushUnavailableError || e instanceof Error
          ? e.message
          : "Could not turn on alerts.",
      )
    } finally {
      setBusy(false)
    }
  }, [close])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => void close()}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.iconWrap}>
            <Ionicons name="notifications" size={24} color={colors.gold} />
          </View>

          <Text style={styles.title}>Know first</Text>
          <Text style={styles.body}>
            Tournament of Champions weight classes are being released one at a time. Turn on
            alerts and we&apos;ll tell you the moment a field goes live — plus new North Carolina
            commitments as they happen.
          </Text>

          {problem ? <Text style={styles.problem}>{problem}</Text> : null}

          <Pressable style={styles.primary} onPress={() => void enable()} disabled={busy}>
            {busy ? (
              <ActivityIndicator color={colors.ink} size="small" />
            ) : (
              <Text style={styles.primaryText}>Turn on alerts</Text>
            )}
          </Pressable>

          <Pressable style={styles.secondary} onPress={() => void close()} disabled={busy}>
            <Text style={styles.secondaryText}>Not now</Text>
          </Pressable>

          <Text style={styles.footnote}>You can change this any time in More.</Text>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 11, 20, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
  },
  sheet: {
    width: "100%",
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.md,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...type.title, color: colors.text },
  body: { ...type.body, color: colors.textSecondary, lineHeight: 21 },
  problem: { ...type.label, color: colors.red },
  primary: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: "center",
    marginTop: space.xs,
  },
  primaryText: { ...type.label, color: colors.ink, fontWeight: "700" },
  secondary: { paddingVertical: space.sm, alignItems: "center" },
  secondaryText: { ...type.label, color: colors.textMuted },
  footnote: { ...type.caption, color: colors.textMuted, textAlign: "center" },
})
