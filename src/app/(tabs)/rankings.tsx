import { useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { useSession } from "@/lib/auth"
import { openAthleteProfile } from "@/lib/profile-link"
import {
  fetchRankingClasses,
  fetchRankings,
  type RankedProspect,
  type RankingClass,
} from "@/lib/rankings"

/** "Matthew Akins" → "MA", for the handful of prospects with no photo on file. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}

function RankRow({ prospect }: { prospect: RankedProspect }) {
  const podium = prospect.rank <= 3
  // Not every ranking row is linked to a directory profile, and a row without one must not be
  // a Pressable that does nothing. Two explicit branches rather than a swapped component:
  // View does not accept a function for `style`, so sharing one element silently broke the
  // unlinked rows' layout.
  const body = (
    <>
      <View style={[styles.rankBadge, podium && styles.rankBadgePodium]}>
        <Text style={[styles.rankText, podium && styles.rankTextPodium]}>{prospect.rank}</Text>
      </View>

      {/* The face is the point. A list of names reads like a spreadsheet; these are kids people
          recognise from a mat last weekend. */}
      {prospect.photoUrl ? (
        <Image source={{ uri: prospect.photoUrl }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.photo, styles.photoEmpty]}>
          <Text style={styles.initials}>{initialsOf(prospect.name)}</Text>
        </View>
      )}

      <View style={styles.rowBody}>
        <Text style={styles.name} numberOfLines={1}>
          {prospect.name}
        </Text>
        {prospect.highSchool ? (
          <View style={styles.schoolLine}>
            {prospect.highSchoolLogoUrl ? (
              <Image
                source={{ uri: prospect.highSchoolLogoUrl }}
                style={styles.schoolLogo}
                resizeMode="contain"
              />
            ) : null}
            <Text style={styles.school} numberOfLines={1}>
              {prospect.highSchool}
            </Text>
          </View>
        ) : null}
        {prospect.stateResult || prospect.gpa || prospect.rankedWin ? (
          <View style={styles.badges}>
            {prospect.stateResult ? (
              <View style={[styles.badge, styles.badgeGold]}>
                <Text style={[styles.badgeText, styles.badgeTextGold]}>{prospect.stateResult}</Text>
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

      {prospect.athleteId ? (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      ) : null}
    </>
  )

  if (!prospect.athleteId) return <View style={styles.row}>{body}</View>

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => openAthleteProfile(prospect.athleteId)}
      accessibilityRole="link"
      accessibilityLabel={`${prospect.name} profile`}
    >
      {body}
    </Pressable>
  )
}

export default function RankingsScreen() {
  const { signedIn, loading: sessionLoading } = useSession()
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
        // The nearest class first — 2027 is the one being recruited now, and the one people
        // open this tab to check. Publication order put whichever class was edited last on
        // top, which is an editing detail, not what a reader wants.
        setActiveYear(found[0]?.graduationYear ?? null)
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

  if (!sessionLoading && !signedIn) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>RECRUITNC</Text>
          <Text style={styles.title} maxFontSizeMultiplier={1.4}>Rankings</Text>
        </View>
        <View style={styles.gate}>
          <Ionicons name="lock-closed" size={34} color={colors.line} />
          <Text style={styles.gateTitle}>Sign in for RecruitNC rankings</Text>
          <Text style={styles.gateBody}>
            Rankings are an account feature so we can protect the work and personalize your view.
            Commitments, the calendar and Data Dawg stay open to everyone.
          </Text>
          <Pressable
            style={styles.gateButton}
            onPress={() =>
              router.push({
                pathname: "/sign-in",
                params: { reason: "Sign in to see RecruitNC prospect rankings." },
              })
            }
          >
            <Text style={styles.gateButtonText}>Sign in or create an account</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

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
  gate: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, paddingHorizontal: space.xl, paddingBottom: 80 },
  gateTitle: { ...type.title, color: colors.text, textAlign: "center" },
  gateBody: { ...type.body, color: colors.textSecondary, textAlign: "center", lineHeight: 21 },
  gateButton: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    marginTop: space.sm,
  },
  gateButtonText: { ...type.heading, color: colors.ink },
  error: { ...type.body, color: colors.textSecondary, paddingHorizontal: space.xl, textAlign: "center" },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.sm },
  photo: { width: 46, height: 46, borderRadius: radius.sm, backgroundColor: colors.raised },
  photoEmpty: { alignItems: "center", justifyContent: "center" },
  initials: { ...type.label, color: colors.textMuted, fontWeight: "800" },
  schoolLine: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  schoolLogo: { width: 15, height: 15 },
  badgeGold: { backgroundColor: "rgba(211, 181, 116, 0.15)", borderColor: colors.gold },
  badgeTextGold: { color: colors.gold },
  rowPressed: { opacity: 0.65 },
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
