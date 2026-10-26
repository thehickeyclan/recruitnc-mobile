import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Ionicons from "@expo/vector-icons/Ionicons"
import { Image } from "expo-image"
import { router } from "expo-router"
import { colors, radius, space, type } from "@/theme/tokens"
import { fetchCommits, type Commit } from "@/lib/commits"
import { FilterChips, type Chip } from "@/components/filter-chips"

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

/**
 * The date shares a row with the athlete's name, so it stays as short as the information allows:
 * the year only appears when it is not the current one. A full "Aug 18, 2026" squeezed names into
 * ellipsis on narrower phones, and the name is the most important text on the card.
 */
function formatDate(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso + "T00:00:00")
  if (Number.isNaN(d.getTime())) return null
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })
}

function CommitCard({ commit }: { commit: Commit }) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  const showPhoto = commit.photourl && !photoFailed
  const showLogo = commit.collegeLogoUrl && !logoFailed
  const date = formatDate(commit.commitmentdate)

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push({ pathname: "/athlete/[id]", params: { id: commit.id, name: commit.name } })}
      accessibilityRole="link"
      accessibilityLabel={`${commit.name} profile`}
    >
      {showPhoto ? (
        <Image
          source={{ uri: commit.photourl! }}
          style={styles.avatar}
          contentFit="cover"
          contentPosition="top"
          transition={180}
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitials}>{initials(commit.name)}</Text>
        </View>
      )}

      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={2}>
          {commit.name}
        </Text>

        <View style={styles.collegeRow}>
          {showLogo ? (
            <Image
              source={{ uri: commit.collegeLogoUrl! }}
              style={styles.collegeLogo}
              contentFit="contain"
              transition={180}
              onError={() => setLogoFailed(true)}
            />
          ) : null}
          <Text style={styles.college} numberOfLines={1}>
            {commit.college}
          </Text>
        </View>

        <Text style={styles.meta}>
          {[
            commit.highschool,
            commit.weightclass ? `${commit.weightclass} lbs` : null,
            commit.graduationyear ? `'${String(commit.graduationyear).slice(2)}` : null,
            date,
          ]
            .filter(Boolean)
            .join("  ·  ")}
        </Text>
      </View>

    </Pressable>
  )
}

export default function CommitsScreen() {
  const [commits, setCommits] = useState<Commit[]>([])
  const [total, setTotal] = useState(0)
  const [activeYear, setActiveYear] = useState("all")
  const [query, setQuery] = useState("")
  const [activeDivision, setActiveDivision] = useState("all")
  /*
   * Men's or women's commitments (Matt, 14 October 2026). "All" stays the default: this tab is a
   * celebration feed as much as a list, and hiding a third of it behind a switch would be a loss.
   * Year and level chips count within the chosen side, so "2026 · 4" means four women.
   */
  const [activeGender, setActiveGender] = useState<"all" | "Male" | "Female">("all")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const { commits: rows, total: count } = await fetchCommits()
      setCommits(rows)
      setTotal(count)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load commitments")
    }
  }, [])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  const byGender = useMemo(
    () => (activeGender === "all" ? commits : commits.filter((c) => c.gender === activeGender)),
    [commits, activeGender],
  )
  const genderCounts = useMemo(
    () => ({
      Male: commits.filter((c) => c.gender === "Male").length,
      Female: commits.filter((c) => c.gender === "Female").length,
    }),
    [commits],
  )

  const chips = useMemo<Chip[]>(() => {
    const counts = new Map<number, number>()
    for (const c of byGender) {
      if (c.graduationyear) counts.set(c.graduationyear, (counts.get(c.graduationyear) ?? 0) + 1)
    }
    const years = [...counts.entries()].sort((a, b) => b[0] - a[0])
    return [
      { key: "all", label: "All", count: byGender.length },
      ...years.map(([year, count]) => ({ key: String(year), label: String(year), count })),
    ]
  }, [byGender])

  const divisionChips = useMemo<Chip[]>(() => {
    const ORDER = ["DI", "DII", "DIII", "NAIA", "NJCAA", "Club", "Other"]
    const counts = new Map<string, number>()
    for (const c of byGender) {
      if (c.division) counts.set(c.division, (counts.get(c.division) ?? 0) + 1)
    }
    const present = [...counts.entries()].sort(
      (a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]),
    )
    return [
      { key: "all", label: "All levels" },
      ...present.map(([division, count]) => ({ key: division, label: division, count })),
    ]
  }, [byGender])

  const visible = useMemo(() => {
    let list =
      activeYear === "all" ? byGender : byGender.filter((c) => String(c.graduationyear) === activeYear)
    if (activeDivision !== "all") list = list.filter((c) => c.division === activeDivision)
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((c) =>
      [c.name, c.college, c.highschool].some((field) => field?.toLowerCase().includes(q)),
    )
  }, [byGender, activeYear, activeDivision, query])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>RECRUITNC</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title} maxFontSizeMultiplier={1.4}>Commitments</Text>
          {/* Anyone with the news - the wrestler, a parent, a coach (26 Oct 2026). */}
          <Pressable style={styles.report} onPress={() => router.push("/report-commitment")} accessibilityLabel="Report a commitment">
            <Ionicons name="add" size={16} color={colors.ink} />
            <Text style={styles.reportText}>Report</Text>
          </Pressable>
        </View>
        {!loading && !error ? (
          <Text style={styles.subtitle}>
            {activeYear === "all" && activeDivision === "all" && !query.trim()
              ? activeGender === "all"
                ? `${total} North Carolina wrestlers committed`
                : `${byGender.length} North Carolina ${activeGender === "Female" ? "women" : "men"} committed`
              : `${visible.length} of ${byGender.length} commitments`}
          </Text>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search name, college or school"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={17} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.switch}>
          {(
            [
              ["all", "All", commits.length],
              ["Male", "Men's", genderCounts.Male],
              ["Female", "Women's", genderCounts.Female],
            ] as const
          ).map(([key, label, count]) => {
            const active = activeGender === key
            return (
              <Pressable
                key={key}
                onPress={() => {
                  setActiveGender(key)
                  setActiveYear("all")
                  setActiveDivision("all")
                }}
                style={[styles.switchOption, active && styles.switchOptionActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.switchText, active && styles.switchTextActive]}>
                  {label} · {count}
                </Text>
              </Pressable>
            )
          })}
        </View>
        <FilterChips chips={chips} activeKey={activeYear} onChange={setActiveYear} />
        <FilterChips chips={divisionChips} activeKey={activeDivision} onChange={setActiveDivision} />
        <FlatList
          data={visible}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => <CommitCard commit={item} />}
          contentContainerStyle={styles.list}
          keyboardDismissMode="on-drag"
          ListEmptyComponent={
            <Text style={styles.empty}>No commitments match “{query}”</Text>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
          }
        />
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.lg },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  report: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.gold, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14 },
  reportText: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  eyebrow: { ...type.caption, color: colors.gold, marginBottom: space.xs },
  title: { ...type.display, color: colors.text },
  subtitle: { ...type.body, color: colors.textSecondary, marginTop: space.xs },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { ...type.body, color: colors.textSecondary, paddingHorizontal: space.xl, textAlign: "center" },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.md },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginHorizontal: space.lg,
    marginBottom: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  search: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 4 },
  switch: {
    flexDirection: "row",
    marginHorizontal: space.lg,
    marginBottom: space.md,
    padding: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  switchOption: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.pill },
  switchOptionActive: { backgroundColor: colors.gold },
  switchText: { ...type.label, lineHeight: 18, fontWeight: "700", color: colors.textSecondary },
  switchTextActive: { color: colors.ink },
  empty: { ...type.body, color: colors.textMuted, textAlign: "center", paddingVertical: space.xl },
  cardPressed: { opacity: 0.65 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.raised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    gap: space.md,
  },
  avatar: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surface, alignSelf: "flex-start" },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitials: { ...type.heading, color: colors.gold },
  cardBody: { flex: 1, gap: 3 },
  name: { ...type.heading, color: colors.text },
  collegeRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  collegeLogo: { width: 18, height: 18 },
  college: { ...type.label, color: colors.gold, flexShrink: 1 },
  meta: { ...type.label, color: colors.textMuted, fontWeight: "500" },
})
