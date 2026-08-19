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
    <View style={styles.card}>
      {showPhoto ? (
        <Image
          source={{ uri: commit.photourl! }}
          style={styles.avatar}
          contentFit="cover"
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

    </View>
  )
}

export default function CommitsScreen() {
  const [commits, setCommits] = useState<Commit[]>([])
  const [total, setTotal] = useState(0)
  const [activeYear, setActiveYear] = useState("all")
  const [query, setQuery] = useState("")
  const [activeDivision, setActiveDivision] = useState("all")
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

  const chips = useMemo<Chip[]>(() => {
    const counts = new Map<number, number>()
    for (const c of commits) {
      if (c.graduationyear) counts.set(c.graduationyear, (counts.get(c.graduationyear) ?? 0) + 1)
    }
    const years = [...counts.entries()].sort((a, b) => b[0] - a[0])
    return [
      { key: "all", label: "All", count: commits.length },
      ...years.map(([year, count]) => ({ key: String(year), label: String(year), count })),
    ]
  }, [commits])

  const divisionChips = useMemo<Chip[]>(() => {
    const ORDER = ["DI", "DII", "DIII", "NAIA", "NJCAA", "Club", "Other"]
    const counts = new Map<string, number>()
    for (const c of commits) {
      if (c.division) counts.set(c.division, (counts.get(c.division) ?? 0) + 1)
    }
    const present = [...counts.entries()].sort(
      (a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]),
    )
    return [
      { key: "all", label: "All levels" },
      ...present.map(([division, count]) => ({ key: division, label: division, count })),
    ]
  }, [commits])

  const visible = useMemo(() => {
    let list =
      activeYear === "all" ? commits : commits.filter((c) => String(c.graduationyear) === activeYear)
    if (activeDivision !== "all") list = list.filter((c) => c.division === activeDivision)
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((c) =>
      [c.name, c.college, c.highschool].some((field) => field?.toLowerCase().includes(q)),
    )
  }, [commits, activeYear, activeDivision, query])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>RECRUITNC</Text>
        <Text style={styles.title} maxFontSizeMultiplier={1.4}>Commitments</Text>
        {!loading && !error ? (
          <Text style={styles.subtitle}>
            {activeYear === "all" && activeDivision === "all" && !query.trim()
              ? `${total} North Carolina wrestlers committed`
              : `${visible.length} of ${total} commitments`}
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
  empty: { ...type.body, color: colors.textMuted, textAlign: "center", paddingVertical: space.xl },
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
