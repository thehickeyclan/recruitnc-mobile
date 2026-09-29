import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useFocusEffect } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"

import { useSession } from "@/lib/auth"
import { fetchMyAthletes, type AthleteMatch, type LinkedAthlete } from "@/lib/my-athletes"
import { colors, radius, space, type } from "@/theme/tokens"

const cls = (y: number | null) => (y ? `Class of ${y}` : null)

/**
 * My wrestlers: who this account is linked to, and a search to find the one to add.
 *
 * Linking is what college-interest alerts need - "a program viewed Liam's profile" goes to Liam's
 * family - and it also unlocks editing and Blue. The athlete screen already asks "Is this you?"
 * with "This is me" / "I'm the parent"; this screen is the way to reach it without scrolling the
 * commits or rankings for your own kid. Tapping a result opens that screen.
 */
export default function MyWrestlersScreen() {
  const { signedIn } = useSession()
  const [linked, setLinked] = useState<LinkedAthlete[]>([])
  const [results, setResults] = useState<AthleteMatch[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadLinked = useCallback(() => {
    if (!signedIn) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetchMyAthletes()
      .then((d) => setLinked(d.linked))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load your wrestlers."))
      .finally(() => setLoading(false))
  }, [signedIn])

  // Reload on return, so a link made on the athlete screen shows up here.
  useFocusEffect(loadLinked)

  useEffect(() => {
    if (!signedIn || query.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    const t = setTimeout(() => {
      fetchMyAthletes(query)
        .then((d) => setResults(d.results))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(t)
  }, [query, signedIn])

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>ACCOUNT</Text>
          <Text style={styles.title}>My wrestlers</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!signedIn ? (
          <Pressable style={styles.primary} onPress={() => router.push("/sign-in")}>
            <Text style={styles.primaryText}>Sign in to link your wrestler</Text>
          </Pressable>
        ) : (
          <>
            <Text style={styles.muted}>
              Linked wrestlers get college-interest alerts on this phone: when a college program views their
              profile, you&apos;ll know which school.
            </Text>

            {loading ? <ActivityIndicator color={colors.gold} /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!loading && linked.length === 0 && !error ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>No wrestlers linked yet</Text>
                <Text style={styles.muted}>Search for your wrestler below, open their profile, and tap “This is me” or the parent option.</Text>
              </View>
            ) : null}
            {linked.map((a) => (
              <Pressable key={a.id} style={styles.card} onPress={() => router.push(`/athlete/${a.id}` as never)}>
                <View style={styles.rowTop}>
                  <Text style={styles.cardTitle}>{a.name}</Text>
                  <Text style={styles.badge}>{a.relationship === "self" ? "You" : "Your wrestler"}</Text>
                </View>
                <Text style={styles.muted}>{[cls(a.classYear), a.school].filter(Boolean).join(" · ")}</Text>
              </Pressable>
            ))}

            <Text style={styles.section}>LINK A WRESTLER</Text>
            <TextInput
              style={styles.input}
              placeholder="Search by name"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="search"
            />
            {searching ? <ActivityIndicator color={colors.gold} /> : null}
            {results.map((a) => (
              <Pressable key={a.id} style={styles.result} onPress={() => router.push(`/athlete/${a.id}` as never)}>
                <View style={styles.flex}>
                  <Text style={styles.resultName}>{a.name}</Text>
                  <Text style={styles.muted}>{[cls(a.classYear), a.school].filter(Boolean).join(" · ")}</Text>
                </View>
                {a.linked ? <Text style={styles.badge}>Linked</Text> : <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
              </Pressable>
            ))}
            {query.trim().length >= 2 && !searching && results.length === 0 ? (
              <Text style={styles.muted}>No wrestler by that name. Try a last name only.</Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  back: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surface },
  flex: { flex: 1 },
  eyebrow: { ...type.caption, color: colors.gold },
  title: { ...type.title, color: colors.text },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  muted: { ...type.label, color: colors.textMuted, fontWeight: "500" },
  error: { ...type.label, color: colors.red },
  card: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: space.lg, gap: space.xs },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  cardTitle: { ...type.heading, color: colors.text },
  badge: { ...type.caption, color: colors.gold },
  section: { ...type.caption, color: colors.textSecondary, marginTop: space.md },
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
  result: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  resultName: { ...type.body, color: colors.text, fontWeight: "600" },
  primary: { backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: space.md, alignItems: "center" },
  primaryText: { ...type.body, color: colors.ink, fontWeight: "700" },
})
