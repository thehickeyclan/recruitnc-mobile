import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { fetchDisplayName, saveDisplayName } from "@/lib/toc-pool"

/**
 * The name you appear under on the leaderboard.
 *
 * Without one the board shows a first name and a last initial, which cannot tell seventeen
 * Michaels apart and puts part of a child's real name on a page. Choosing solves both at once,
 * so this screen leads with the choice and keeps the fallback as the quiet option.
 *
 * Every rule that can refuse a name lives on the server — a check here would only be a nicer
 * error, never the decision.
 */
export default function TocPoolNameScreen() {
  const [name, setName] = useState("")
  const [fallback, setFallback] = useState("Entrant")
  const [saved, setSaved] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchDisplayName()
      setSaved(data.displayName)
      setName(data.displayName ?? "")
      setFallback(data.fallback)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your leaderboard name.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const save = useCallback(async (value: string) => {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const result = await saveDisplayName(value)
      setSaved(result)
      setName(result ?? "")
      setDone(result ? `You will show as ${result}.` : `You will show as ${fallback}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that name.")
    } finally {
      setBusy(false)
    }
  }, [fallback])

  const trimmed = name.trim()
  const unchanged = trimmed === (saved ?? "")

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>TOURNAMENT OF CHAMPIONS</Text>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>
        <Text style={styles.title}>Your leaderboard name</Text>
      </View>

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {/* "App R." already ends in a full stop, so a sentence-final one gives "App R..". Add it
              only when the fallback does not end the sentence itself. */}
          <Text style={styles.intro}>
            Pick what you appear as on the standings. Leave it empty and you show as{" "}
            <Text style={styles.strong}>{fallback}</Text>
            {fallback.endsWith(".") ? "" : "."}
          </Text>

          <TextInput
            value={name}
            onChangeText={(value) => { setName(value); setDone(null) }}
            placeholder={fallback}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            style={styles.input}
          />
          <Text style={styles.hint}>
            3 to 20 characters. Letters, numbers, spaces, hyphens and underscores. It has to be
            one nobody else has taken, and it cannot be the name of a wrestler in the field.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {done ? <Text style={styles.done}>{done}</Text> : null}

          <Pressable
            style={[styles.primary, (busy || unchanged || trimmed.length === 0) && styles.disabled]}
            onPress={() => void save(trimmed)}
            disabled={busy || unchanged || trimmed.length === 0}
          >
            {busy ? (
              <ActivityIndicator color={colors.ink} size="small" />
            ) : (
              <Text style={styles.primaryText}>Save this name</Text>
            )}
          </Pressable>

          {saved ? (
            <Pressable style={styles.secondary} onPress={() => void save("")} disabled={busy}>
              <Text style={styles.secondaryText}>Use {fallback} instead</Text>
            </Pressable>
          ) : null}

          <Text style={styles.privacy}>
            The standings show this name and your points. They never show who you picked, and NC
            United never shares or publishes anybody's bracket.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  eyebrow: { ...type.caption, color: colors.gold, marginBottom: space.xs },
  title: { ...type.display, color: colors.text },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.md },
  intro: { ...type.body, color: colors.textSecondary, lineHeight: 21 },
  strong: { color: colors.text, fontWeight: "700" },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: colors.text,
    ...type.body,
  },
  hint: { ...type.caption, color: colors.textMuted, lineHeight: 16 },
  error: { ...type.label, color: colors.red },
  done: { ...type.label, color: colors.gold },
  primary: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: space.md,
  },
  primaryText: { ...type.label, color: colors.ink, fontWeight: "700" },
  disabled: { opacity: 0.4 },
  secondary: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: space.md,
  },
  secondaryText: { ...type.label, color: colors.textSecondary },
  privacy: { ...type.caption, color: colors.textMuted, lineHeight: 16, marginTop: space.sm },
})
