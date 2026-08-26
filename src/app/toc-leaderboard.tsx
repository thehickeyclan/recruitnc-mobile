import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { fetchLeaderboard, type LeaderboardRow } from "@/lib/toc-pool"

/**
 * Standings for the bracket pool.
 *
 * Shows totals and nothing else. Nobody sees anyone else's picks — not while the tournament runs,
 * not afterwards — and the endpoint behind this never returns them, so the promise holds even if
 * this screen were changed carelessly.
 *
 * Names arrive already shortened to a first name and a last initial, because most entrants are
 * minors and a full name does not belong on a board anyone can open.
 */
export default function TocLeaderboardScreen() {
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [entrants, setEntrants] = useState(0)
  const [boutsDecided, setBoutsDecided] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchLeaderboard()
      setRows(data.standings)
      setEntrants(data.entrants)
      setBoutsDecided(data.boutsDecided)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the leaderboard.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load()
  }, [load])

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>TOURNAMENT OF CHAMPIONS</Text>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>
          {boutsDecided === 0
            ? "Scoring starts when the first bouts are wrestled."
            : `${entrants} ${entrants === 1 ? "entrant" : "entrants"} · ${boutsDecided} ${boutsDecided === 1 ? "bout" : "bouts"} decided`}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
        }
      >
        {loading ? (
          <ActivityIndicator color={colors.gold} style={styles.spinner} />
        ) : error ? (
          <View style={styles.empty}>
            <Ionicons name="cloud-offline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="podium" size={28} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Nobody has entered yet</Text>
            <Text style={styles.emptyText}>
              Submit a bracket at each weight once the official seeds are released, then watch it
              score as the tournament runs.
            </Text>
          </View>
        ) : (
          <View style={styles.group}>
            {rows.map((row) => (
              <View key={`${row.rank}-${row.name}`} style={styles.row}>
                <View style={[styles.rank, row.rank <= 3 && styles.rankTop]}>
                  <Text style={[styles.rankText, row.rank <= 3 && styles.rankTextTop]}>{row.rank}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.name}>{row.name}</Text>
                  <Text style={styles.detail}>
                    {row.correct} correct · {row.weightsEntered}{" "}
                    {row.weightsEntered === 1 ? "weight" : "weights"}
                  </Text>
                </View>
                <Text style={styles.points}>{row.points}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { ...type.caption, color: colors.gold },
  title: { ...type.display, color: colors.text, marginTop: 2 },
  subtitle: { ...type.label, color: colors.textMuted, marginTop: space.xs, fontWeight: "500" },

  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl * 3 },
  spinner: { marginTop: space.xxl },

  group: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rank: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  rankTop: { backgroundColor: colors.gold },
  rankText: { ...type.label, color: colors.textSecondary, fontWeight: "800" },
  rankTextTop: { color: colors.ink },
  name: { ...type.label, color: colors.text, fontWeight: "700" },
  detail: { ...type.caption, color: colors.textMuted, marginTop: 2, fontWeight: "600", letterSpacing: 0.2 },
  points: { ...type.title, color: colors.gold },

  empty: { alignItems: "center", gap: space.sm, paddingTop: space.xxl, paddingHorizontal: space.lg },
  emptyTitle: { ...type.heading, color: colors.text },
  emptyText: { ...type.label, color: colors.textMuted, textAlign: "center", fontWeight: "500", lineHeight: 19 },
})
