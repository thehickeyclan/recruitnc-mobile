import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { useSession } from "@/lib/auth"
import { fetchPoolState, submitEntry, type PoolWindow } from "@/lib/toc-pool"

/**
 * Entering one weight class in the pool.
 *
 * The window is the server's call, not a date this file knows: it asks, and renders whatever it
 * is told. That matters because the deadline is the one thing here that must not be wrong — a
 * button the server would refuse is worse than no button.
 *
 * Everything before the pool opens is still worth saying, so this shows the date rather than
 * hiding until the eleventh and leaving people to wonder whether they missed it.
 */

/** "2026-09-11T12:00:00-04:00" → "11 September" */
function dayLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "soon"
  return date.toLocaleDateString("en-US", { day: "numeric", month: "long" })
}

export function PoolSubmit({
  weightClass,
  picks,
  complete,
}: {
  weightClass: number
  picks: Record<number, string>
  complete: boolean
}) {
  const { session, loading: sessionLoading } = useSession()
  const [window, setWindow] = useState<PoolWindow | null>(null)
  const [submittedAt, setSubmittedAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!session) {
      setLoaded(true)
      return
    }
    try {
      const state = await fetchPoolState()
      setWindow(state.window)
      const mine = state.entries.find((e) => e.weight_class === weightClass)
      setSubmittedAt(mine?.submitted ? (mine.submitted_at ?? "") : null)
    } catch {
      // A pool that cannot be reached should not break the bracket underneath it.
      setWindow(null)
    } finally {
      setLoaded(true)
    }
  }, [session, weightClass])

  useEffect(() => {
    void load()
  }, [load])

  const submit = useCallback(async () => {
    setBusy(true)
    try {
      const result = await submitEntry(weightClass, picks)
      setSubmittedAt(new Date().toISOString())
      // The server validates picks against the official draw. A short count means some could
      // never have scored, and saying "submitted" alone would be a comfortable lie.
      if (result.picksAccepted < result.boutsInDraw) {
        Alert.alert(
          "Bracket submitted",
          `${result.picksAccepted} of ${result.boutsInDraw} bouts were accepted. Reopen this weight and fill in the rest before the deadline.`,
        )
      } else {
        Alert.alert("Bracket submitted", `Your ${weightClass} lbs bracket is in the pool.`)
      }
    } catch (e) {
      Alert.alert("Not submitted", e instanceof Error ? e.message : "Could not submit your bracket.")
    } finally {
      setBusy(false)
    }
  }, [weightClass, picks])

  if (sessionLoading || !loaded) return null

  const leaderboard = (
    <Pressable style={styles.leaderboardLink} onPress={() => router.push("/toc-leaderboard")} hitSlop={6}>
      <Ionicons name="podium" size={14} color={colors.gold} />
      <Text style={styles.leaderboardText}>Leaderboard</Text>
    </Pressable>
  )

  if (!session) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Enter the pool</Text>
        <Text style={styles.detail}>
          Sign in to submit this bracket once the official seeds are released. Playing with it needs
          no account.
        </Text>
        <Pressable style={styles.secondary} onPress={() => router.push("/sign-in")}>
          <Text style={styles.secondaryText}>Sign in or create an account</Text>
        </Pressable>
        {leaderboard}
      </View>
    )
  }

  const submitted = submittedAt != null

  if (window && !window.open) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{submitted ? "Your entry is locked in" : "Entries are not open yet"}</Text>
        <Text style={styles.detail}>
          {window.reason ?? `The pool opens ${dayLabel(window.opensAt)}.`}
        </Text>
        {leaderboard}
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{submitted ? "Submitted" : "Enter the pool"}</Text>
      <Text style={styles.detail}>
        {submitted
          ? `Your ${weightClass} lbs bracket is in. You can change it until ${window ? dayLabel(window.deadline) : "the deadline"}.`
          : complete
            ? `One entry per weight. You can change it until ${window ? dayLabel(window.deadline) : "the deadline"}.`
            : "Pick every bout, then submit."}
      </Text>

      <Pressable
        style={[styles.primary, (!complete || busy) && styles.primaryDisabled]}
        onPress={() => void submit()}
        disabled={!complete || busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.ink} size="small" />
        ) : (
          <>
            <Ionicons name={submitted ? "refresh" : "checkmark-circle"} size={16} color={colors.ink} />
            <Text style={styles.primaryText}>
              {submitted ? "Update my entry" : `Submit ${weightClass} lbs`}
            </Text>
          </>
        )}
      </Pressable>

      {leaderboard}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.lg,
    marginTop: space.lg,
    gap: space.sm,
  },
  title: { ...type.heading, color: colors.text },
  detail: { ...type.label, color: colors.textSecondary, fontWeight: "500", lineHeight: 19 },

  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.xs,
  },
  primaryDisabled: { opacity: 0.4 },
  primaryText: { ...type.label, color: colors.ink, fontWeight: "800" },

  secondary: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.xs,
  },
  secondaryText: { ...type.label, color: colors.gold, fontWeight: "700" },

  leaderboardLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: space.xs,
  },
  leaderboardText: { ...type.label, color: colors.gold, fontWeight: "700" },
})
