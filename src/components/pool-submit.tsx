import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { router } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { useSession } from "@/lib/auth"
import { fetchPoolState, submitEntry, type PoolWindow } from "@/lib/toc-pool"
import {
  FINAL_METHODS,
  FINAL_METHOD_LABELS,
  methodNeedsScore,
  parseFinalMethod,
  validateFinalPrediction,
  type FinalMethod,
} from "@/lib/final-prediction"

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
  const [loadError, setLoadError] = useState<string | null>(null)

  // The tiebreaker: how this weight's final ends. Two entrants level on points are separated by
  // who called it, so this is required to submit rather than an optional flourish.
  const [method, setMethod] = useState<FinalMethod | null>(null)
  const [winnerScore, setWinnerScore] = useState("")
  const [loserScore, setLoserScore] = useState("")

  const load = useCallback(async () => {
    if (!session) {
      setLoaded(true)
      return
    }
    try {
      const state = await fetchPoolState()
      setWindow(state.window)
      setLoadError(null)
      const mine = state.entries.find((e) => e.weight_class === weightClass)
      setSubmittedAt(mine?.submitted ? (mine.submitted_at ?? "") : null)
      setMethod(parseFinalMethod(mine?.final_method))
      setWinnerScore(mine?.final_winner_score?.toString() ?? "")
      setLoserScore(mine?.final_loser_score?.toString() ?? "")
    } catch (e) {
      // A pool that cannot be reached must not read as a pool that is open. Failing to the open
      // state offered a submit button the server would refuse, which is worse than saying so.
      setWindow(null)
      setLoadError(e instanceof Error ? e.message : "Could not reach the pool.")
    } finally {
      setLoaded(true)
    }
  }, [session, weightClass])

  useEffect(() => {
    void load()
  }, [load])

  const submit = useCallback(async () => {
    // Validated here with the same rules the server uses, so a contradiction like "major, 3-1"
    // is caught while the entrant is still looking at it rather than as a failed request.
    const prediction = validateFinalPrediction({ method, winnerScore, loserScore })
    if (!prediction.ok) {
      Alert.alert("Check the tiebreaker", prediction.error)
      return
    }
    setBusy(true)
    try {
      const result = await submitEntry(weightClass, picks, prediction.value)
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
  }, [weightClass, picks, method, winnerScore, loserScore])

  if (sessionLoading || !loaded) return null

  const privacyNote = (
    <Text style={styles.privacy}>
      Your bracket stays private. NC United never shares or publishes anybody's picks — the
      leaderboard shows a name and points, never who you picked, during the tournament or after
      it. You can choose the name you appear under; without one it is your first name and last
      initial. The only way your bracket goes anywhere is if you send the picture yourself.
    </Text>
  )

  const leaderboard = (
    <View style={styles.linkRow}>
      <Pressable style={styles.leaderboardLink} onPress={() => router.push("/toc-leaderboard")} hitSlop={6}>
        <Ionicons name="podium" size={14} color={colors.gold} />
        <Text style={styles.leaderboardText}>Leaderboard</Text>
      </Pressable>
      <Pressable style={styles.leaderboardLink} onPress={() => router.push("/toc-pool-name")} hitSlop={6}>
        <Ionicons name="create-outline" size={14} color={colors.gold} />
        <Text style={styles.leaderboardText}>Your name</Text>
      </Pressable>
    </View>
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
        {privacyNote}
        {leaderboard}
      </View>
    )
  }

  const submitted = submittedAt != null

  if (!window) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Pool unavailable</Text>
        <Text style={styles.detail}>
          {loadError ?? "Could not reach the pool."} Your picks are saved on this phone either way.
        </Text>
        {privacyNote}
        {leaderboard}
      </View>
    )
  }

  if (!window.open) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{submitted ? "Your entry is locked in" : "Entries are not open yet"}</Text>
        <Text style={styles.detail}>
          {window.reason ?? `The pool opens ${dayLabel(window.opensAt)}.`}
        </Text>
        {privacyNote}
        {leaderboard}
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{submitted ? "Submitted" : "Enter the pool"}</Text>
      <Text style={styles.detail}>
        {submitted
          ? `Your ${weightClass} lbs bracket is in. You can change it until ${dayLabel(window.deadline)}.`
          : complete
            ? `One entry per weight. You can change it until ${dayLabel(window.deadline)}.`
            : "Pick every bout, then submit."}
      </Text>

      {/* The tiebreaker. Shown while the pool is open, because it is required to submit and
          discovering that at the moment you tap submit is a bad way to find out. */}
      <View style={styles.tiebreak}>
        <Text style={styles.tiebreakTitle}>Tiebreaker — how does the final end?</Text>
        <View style={styles.methods}>
          {FINAL_METHODS.map((m) => (
            <Pressable
              key={m}
              style={[styles.method, method === m && styles.methodActive]}
              onPress={() => setMethod(m)}
            >
              <Text style={[styles.methodText, method === m && styles.methodTextActive]}>
                {FINAL_METHOD_LABELS[m]}
              </Text>
            </Pressable>
          ))}
        </View>

        {method && methodNeedsScore(method) ? (
          <View style={styles.scores}>
            <View>
              <Text style={styles.scoreLabel}>Winner</Text>
              <TextInput
                value={winnerScore}
                onChangeText={(t) => setWinnerScore(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                maxLength={2}
                style={styles.scoreInput}
                placeholderTextColor={colors.textMuted}
                placeholder="0"
              />
            </View>
            <Text style={styles.dash}>–</Text>
            <View>
              <Text style={styles.scoreLabel}>Loser</Text>
              <TextInput
                value={loserScore}
                onChangeText={(t) => setLoserScore(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                maxLength={2}
                style={styles.scoreInput}
                placeholderTextColor={colors.textMuted}
                placeholder="0"
              />
            </View>
            <Text style={styles.scoreHint}>
              {method === "MAJ" ? "A major is a margin of 8–14." : "A decision is a margin of 1–7."}
            </Text>
          </View>
        ) : null}
      </View>

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
              {submitted ? "Update my entry" : `Enter ${weightClass} lbs in the pool`}
            </Text>
          </>
        )}
      </Pressable>

      {privacyNote}

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
  linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.lg },
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

  tiebreak: { marginTop: space.sm, gap: space.sm },
  tiebreakTitle: { ...type.label, color: colors.text, fontWeight: "700" },
  methods: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  method: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  methodActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  methodText: { ...type.label, color: colors.textSecondary, fontWeight: "700" },
  methodTextActive: { color: colors.ink },
  scores: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, flexWrap: "wrap" },
  scoreLabel: { ...type.caption, color: colors.textMuted, marginBottom: 4 },
  scoreInput: {
    width: 64,
    height: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    backgroundColor: colors.ink,
    color: colors.text,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
  },
  dash: { ...type.title, color: colors.textMuted, paddingBottom: 10 },
  scoreHint: { ...type.caption, color: colors.textMuted, flex: 1, fontWeight: "500", letterSpacing: 0 },

  privacy: {
    ...type.caption,
    color: colors.textMuted,
    fontWeight: "500",
    letterSpacing: 0,
    lineHeight: 15,
    textAlign: "center",
    paddingTop: space.xs,
  },
  leaderboardLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: space.xs,
  },
  leaderboardText: { ...type.label, color: colors.gold, fontWeight: "700" },
})
