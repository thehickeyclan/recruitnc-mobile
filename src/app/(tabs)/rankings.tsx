import { useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { colors, radius, space, type } from "@/theme/tokens"
import {
  fetchRankingClasses,
  fetchRankings,
  type RankedProspect,
  type RankingClass,
} from "@/lib/rankings"

function RankRow({ prospect }: { prospect: RankedProspect }) {
  const podium = prospect.rank <= 3
  return (
    <View style={styles.row}>
      <View style={[styles.rankBadge, podium && styles.rankBadgePodium]}>
        <Text style={[styles.rankText, podium && styles.rankTextPodium]}>{prospect.rank}</Text>
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.name} numberOfLines={1}>
          {prospect.name}
        </Text>
        {prospect.highSchool ? (
          <Text style={styles.school} numberOfLines={1}>
            {prospect.highSchool}
          </Text>
        ) : null}
        {prospect.stateResult || prospect.gpa || prospect.rankedWin ? (
          <View style={styles.badges}>
            {prospect.stateResult ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{prospect.stateResult}</Text>
              </View>
            ) : null}
            {prospect.rankedWin ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>RANKED WIN</Text>
              </View>
            ) : null}
            {prospect.gpa ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{prospect.gpa.toFixed(1)} GPA</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  )
}

export default function RankingsScreen() {
  const [classes, setClasses] = useState<RankingClass[]>([])
  const [activeYear, setActiveYear] = useState<number | null>(null)
  const [prospects, setProspects] = useState<RankedProspect[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchRankingClasses()
      .then((found) => {
        if (cancelled) return
        setClasses(found)
        // Default to the most recently published edition rather than a hardcoded year,
        // so the tab keeps pointing at current work as new classes are ranked.
        const newest = [...found].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))[0]
        setActiveYear(newest?.graduationYear ?? found[0]?.graduationYear ?? null)
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load rankings"))
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async (year: number) => {
    try {
      setError(null)
      setProspects(await fetchRankings(year))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load rankings")
    }
  }, [])

  useEffect(() => {
    if (activeYear == null) return
    setLoading(true)
    void load(activeYear).finally(() => setLoading(false))
  }, [activeYear, load])

  const onRefresh = useCallback(async () => {
    if (activeYear == null) return
    setRefreshing(true)
    await load(activeYear)
    setRefreshing(false)
  }, [activeYear, load])

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>RECRUITNC</Text>
        <Text style={styles.title} maxFontSizeMultiplier={1.4}>Rankings</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipStrip}
      >
        {classes.map((c) => {
          const active = c.graduationYear === activeYear
          return (
            <Pressable
              key={c.graduationYear}
              onPress={() => setActiveYear(c.graduationYear)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {c.graduationYear}
              </Text>
              <Text style={[styles.chipCount, active && styles.chipCountActive]}>{c.count}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={prospects}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => <RankRow prospect={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md },
  eyebrow: { ...type.caption, color: colors.gold, marginBottom: space.xs },
  title: { ...type.display, color: colors.text },
  chipStrip: { flexGrow: 0, minHeight: 46, marginBottom: space.md },
  chips: { paddingHorizontal: space.lg, gap: space.sm, alignItems: "center" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { ...type.label, color: colors.textSecondary },
  chipTextActive: { color: colors.ink },
  chipCount: { ...type.caption, color: colors.textMuted },
  chipCountActive: { color: colors.ink },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { ...type.body, color: colors.textSecondary, paddingHorizontal: space.xl, textAlign: "center" },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.raised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
  },
  rankBadge: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  rankBadgePodium: { backgroundColor: colors.gold },
  rankText: { ...type.heading, color: colors.textSecondary },
  rankTextPodium: { color: colors.ink },
  rowBody: { flex: 1, gap: 3 },
  name: { ...type.heading, color: colors.text },
  school: { ...type.label, color: colors.textMuted, fontWeight: "500" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.xs },
  badge: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  badgeText: { ...type.caption, color: colors.gold, fontSize: 10 },
})
