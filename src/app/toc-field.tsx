import { useCallback, useEffect, useMemo, useState } from "react"
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
import { router, useLocalSearchParams } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { openAthleteProfile } from "@/lib/profile-link"
import {
  fetchTocField,
  headlineCredential,
  type TocAnnouncedWeight,
  type TocField,
  type TocFieldAthlete,
} from "@/lib/toc-field"

function AthleteCard({ athlete }: { athlete: TocFieldAthlete }) {
  const credential = headlineCredential(athlete)
  const meta = [athlete.graduationYear ? `'${String(athlete.graduationYear).slice(-2)}` : null, athlete.club]
    .filter(Boolean)
    .join(" · ")

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => openAthleteProfile(athlete.athleteId)}
      accessibilityRole="link"
      accessibilityLabel={`${athlete.name} profile`}
    >
      {athlete.photoUrl ? (
        <Image source={{ uri: athlete.photoUrl }} style={styles.photo} />
      ) : (
        <View style={[styles.photo, styles.photoEmpty]}>
          <Ionicons name="person" size={20} color={colors.textMuted} />
        </View>
      )}

      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={1}>
          {athlete.name}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {credential ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{credential.label}</Text>
          </View>
        ) : null}
        {athlete.collegeCommit ? (
          <Text style={styles.commit} numberOfLines={1}>
            {athlete.collegeCommit}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

/**
 * The announced Tournament of Champions field.
 *
 * Weights arrive together from one call — the API has no per-weight form, because unreleased
 * weights must stay unreachable. Unreleased weights still get a chip so the release cadence is
 * visible; they just carry no count and cannot be selected.
 */
export default function TocFieldScreen() {
  const params = useLocalSearchParams<{ weight?: string }>()
  const [field, setField] = useState<TocField | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const next = await fetchTocField()
      setField(next)
      // A push carries the weight it announced, so tapping the alert lands on that weight
      // rather than making someone find it.
      const wanted = Number(params.weight)
      const target =
        Number.isFinite(wanted) && next.weights.some((w) => w.weightClass === wanted)
          ? wanted
          : (next.weights[0]?.weightClass ?? null)
      setSelected((current) => current ?? target)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the field.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [params.weight])

  useEffect(() => {
    void load()
  }, [load])

  const active: TocAnnouncedWeight | null = useMemo(
    () => field?.weights.find((w) => w.weightClass === selected) ?? null,
    [field, selected],
  )

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.flexShrink}>
            <Text style={styles.eyebrow}>TOURNAMENT OF CHAMPIONS</Text>
            <Text style={styles.title} maxFontSizeMultiplier={1.4}>
              The Field
            </Text>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={colors.textMuted} />
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          Announced by weight class. Listed alphabetically — the field is not seeded.
        </Text>

        {/* One tap from the reveal someone was just alerted about, with the weight carried over. */}
        <Pressable
          style={styles.bracketCta}
          onPress={() =>
            router.push({
              pathname: "/toc-bracket",
              params: selected != null ? { weight: String(selected) } : {},
            })
          }
        >
          <Ionicons name="git-network" size={15} color={colors.ink} />
          <Text style={styles.bracketCtaText}>Seed it yourself and run the bracket</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : error ? (
        <View style={styles.centre}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retry} onPress={() => void load()}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            // Without flexGrow:0 the row is stretched by the parent flex and the chips get
            // clipped at the baseline; alignItems keeps them their natural height.
            style={styles.chipScroll}
            contentContainerStyle={styles.chips}
          >
            {(field?.tiles ?? []).map((tile) => {
              const isActive = tile.weightClass === selected
              return (
                <Pressable
                  key={tile.weightClass}
                  disabled={!tile.announced}
                  onPress={() => setSelected(tile.weightClass)}
                  style={[
                    styles.chip,
                    isActive && styles.chipActive,
                    !tile.announced && styles.chipLocked,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isActive && styles.chipTextActive,
                      !tile.announced && styles.chipTextLocked,
                    ]}
                  >
                    {tile.weightClass}
                  </Text>
                  {tile.announced ? (
                    <Text style={[styles.chipCount, isActive && styles.chipCountActive]}>
                      {tile.athleteCount}
                    </Text>
                  ) : (
                    <Ionicons name="lock-closed" size={11} color={colors.textMuted} />
                  )}
                </Pressable>
              )
            })}
          </ScrollView>

          {active ? (
            <FlatList
              data={active.athletes}
              keyExtractor={(a) => a.athleteId}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => <AthleteCard athlete={item} />}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true)
                    void load()
                  }}
                  tintColor={colors.gold}
                />
              }
            />
          ) : (
            <View style={styles.centre}>
              <Ionicons name="lock-closed-outline" size={34} color={colors.line} />
              <Text style={styles.emptyTitle}>No weights released yet</Text>
              <Text style={styles.emptyText}>
                Turn on Tournament of Champions alerts and we&apos;ll tell you the moment a weight
                goes live.
              </Text>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  flexShrink: { flexShrink: 1 },
  eyebrow: { ...type.caption, color: colors.gold, marginBottom: space.xs },
  title: { ...type.display, color: colors.text },
  subtitle: { ...type.body, color: colors.textSecondary, marginTop: space.xs },

  bracketCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    marginTop: space.md,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
  },
  bracketCtaText: { ...type.label, color: colors.ink, fontWeight: "700" },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, paddingHorizontal: space.xl },
  errorText: { ...type.body, color: colors.textSecondary, textAlign: "center" },
  retry: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  retryText: { ...type.label, color: colors.gold },
  emptyTitle: { ...type.title, color: colors.text, textAlign: "center" },
  emptyText: { ...type.body, color: colors.textMuted, textAlign: "center" },

  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chips: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.md, alignItems: "center" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.raised,
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipLocked: { backgroundColor: colors.surface, opacity: 0.55 },
  chipText: { ...type.label, color: colors.text },
  chipTextActive: { color: colors.ink },
  chipTextLocked: { color: colors.textMuted },
  chipCount: { ...type.caption, color: colors.textMuted },
  chipCountActive: { color: colors.ink },

  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.md },
  cardPressed: { opacity: 0.65 },
  card: {
    flexDirection: "row",
    gap: space.md,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: space.md,
  },
  photo: { width: 54, height: 54, borderRadius: radius.md, backgroundColor: colors.surface },
  photoEmpty: { alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, gap: 3 },
  name: { ...type.heading, color: colors.text },
  meta: { ...type.label, color: colors.textSecondary },
  badge: {
    alignSelf: "flex-start",
    marginTop: 2,
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  badgeText: { ...type.caption, color: colors.gold },
  commit: { ...type.label, color: colors.textMuted, marginTop: 2 },
})
