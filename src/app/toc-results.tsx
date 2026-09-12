import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useFocusEffect } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"

import { BracketCanvas } from "@/components/bracket-canvas"
import {
  BracketNotReleasedError,
  buildBracketPreview,
  fetchBracketResults,
  slotLabel,
  slotSeed,
  type BracketPreview,
  type BracketResults,
  type BracketSlotDisplay,
} from "@/lib/toc-bracket"
import { fetchTocField, type TocField } from "@/lib/toc-field"
import { bracketsAreLive, bracketsLabel } from "@/lib/toc-live"
import { simulate } from "@/lib/bracket-simulation"
import { colors, radius, space, type } from "@/theme/tokens"

/**
 * The official bracket, as it actually unfolds.
 *
 * Results were being recorded at the mats from the first day, and scoring TOC Madness off them,
 * but nobody could see them: the app had one bracket screen and it drew your picks. A parent
 * watching from home had the draw published on Friday and no way to learn their kid won bout 2.
 *
 * So this screen is deliberately not a bracket you can touch. No picks, no submit, nothing to get
 * wrong — the draw, the winners as they are entered, and an honest line about how fresh that is.
 * Results are typed in by one person walking between mats, so a screen that cannot say when it
 * last heard anything reads as broken the moment it runs a few bouts behind.
 */

const REFRESH_MS = 60_000

function freshness(iso: string | null): string {
  if (!iso) return "No results recorded yet"
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return "Updated just now"
  if (minutes === 1) return "Updated 1 minute ago"
  if (minutes < 60) return `Updated ${minutes} minutes ago`
  return `Updated ${new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
}

export default function TocResultsScreen() {
  const [field, setField] = useState<TocField | null>(null)
  const [weight, setWeight] = useState<number | null>(null)
  const [preview, setPreview] = useState<BracketPreview | null>(null)
  const [results, setResults] = useState<BracketResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [notReleased, setNotReleased] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const f = await fetchTocField()
        setField(f)
        setWeight(f.weights[0]?.weightClass ?? null)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load the field.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const athletes = useMemo(
    () => field?.weights.find((w) => w.weightClass === weight)?.athletes ?? [],
    [field, weight],
  )

  /** The draw and its layout come from the server; only the winners change during the day. */
  const loadWeight = useCallback(
    async (weightClass: number, athleteIds: string[]) => {
      setBusy(true)
      try {
        const [drawn, recorded] = await Promise.all([
          buildBracketPreview(weightClass, athleteIds),
          fetchBracketResults(weightClass),
        ])
        setPreview(drawn)
        setResults(recorded)
        setNotReleased(false)
        setError(null)
      } catch (e) {
        setNotReleased(e instanceof BracketNotReleasedError)
        setError(e instanceof Error ? e.message : "Could not load the bracket.")
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (weight == null || athletes.length === 0) return
    void loadWeight(weight, athletes.map((a) => a.athleteId))
  }, [weight, athletes, loadWeight])

  /** Only the results move, so the poll asks for those rather than rebuilding the draw. */
  const refreshResults = useCallback(async () => {
    if (weight == null) return
    try {
      setResults(await fetchBracketResults(weight))
    } catch {
      // A failed refresh leaves the last good results on screen; the freshness line tells the truth.
    }
  }, [weight])

  useEffect(() => {
    const timer = setInterval(() => void refreshResults(), REFRESH_MS)
    return () => clearInterval(timer)
  }, [refreshResults])

  // Coming back to the screen should not show a stale scoreboard.
  const focusRef = useRef(false)
  useFocusEffect(
    useCallback(() => {
      if (focusRef.current) void refreshResults()
      focusRef.current = true
    }, [refreshResults]),
  )

  const onPullRefresh = useCallback(async () => {
    setRefreshing(true)
    await refreshResults()
    setRefreshing(false)
  }, [refreshResults])

  const official = useMemo(
    () => (preview && results ? simulate(preview.draw, results.winners) : null),
    [preview, results],
  )

  const winnersByBout = useMemo(() => {
    const out: Record<number, string | null> = {}
    for (const bout of official?.bouts ?? []) out[bout.boutNumber] = bout.winnerAthleteId
    return out
  }, [official])

  const layoutSlots = useMemo(() => {
    const out: Record<number, { top: BracketSlotDisplay; bottom: BracketSlotDisplay }> = {}
    for (const side of [preview?.layout.championship, preview?.layout.consolation]) {
      for (const match of side?.matches ?? []) {
        if (match.boutNumber != null) out[match.boutNumber] = { top: match.top, bottom: match.bottom }
      }
    }
    return out
  }, [preview])

  /** Same rule the picks screen uses: the simulation wins only where it has a real wrestler. */
  const resolvedByBout = useMemo(() => {
    const out: Record<number, { top: BracketSlotDisplay; bottom: BracketSlotDisplay }> = {}
    for (const bout of official?.bouts ?? []) {
      const asDisplay = (slot: (typeof bout)["top"]): BracketSlotDisplay => ({
        name: slotLabel(official!, slot),
        subtitle: null,
        seed: slotSeed(official!, slot),
        isOpen: slot.kind !== "athlete" || slotSeed(official!, slot) == null,
        photoUrl: null,
        competitorId: slot.kind === "athlete" ? slot.athleteId : null,
      })
      const drawn = layoutSlots[bout.boutNumber]
      const choose = (slot: (typeof bout)["top"], fallback: BracketSlotDisplay | undefined) => {
        const resolved = asDisplay(slot)
        return resolved.competitorId ? resolved : fallback ?? resolved
      }
      out[bout.boutNumber] = { top: choose(bout.top, drawn?.top), bottom: choose(bout.bottom, drawn?.bottom) }
    }
    return out
  }, [official, layoutSlots])

  /**
   * The server's answer or the clock, whichever says live.
   *
   * The server knows if the mats started early; the clock still works on a phone that cannot
   * reach it. Either one is enough to stop calling a scoreboard a draw.
   */
  const live = bracketsAreLive(new Date(), results?.recorded ?? 0) || results?.live === true

  const championName = useMemo(() => {
    const final = [...(official?.bouts ?? [])]
      .filter((b) => /championship/i.test(b.roundLabel))
      .sort((a, b) => b.boutNumber - a.boutNumber)[0]
    const id = final?.winnerAthleteId
    return id ? (official?.participants.find((p) => p.athleteId === id)?.name ?? null) : null
  }, [official])

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.flexShrink}>
            <Text style={styles.eyebrow}>TOURNAMENT OF CHAMPIONS</Text>
            <View style={styles.titleLine}>
              <Text style={styles.title} maxFontSizeMultiplier={1.4}>
                {bracketsLabel(live)}
              </Text>
              {live ? (
                <View style={styles.livePill}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.replace("/toc-bracket")}
              hitSlop={10}
              accessibilityRole="button"
              style={styles.crossLink}
            >
              <Ionicons name="git-branch-outline" size={15} color={colors.gold} />
              <Text style={styles.crossLinkText}>My picks</Text>
            </Pressable>
            <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
              <Ionicons name="close" size={26} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {(field?.weights ?? []).map((tile) => (
            <Pressable
              key={tile.weightClass}
              onPress={() => setWeight(tile.weightClass)}
              style={[styles.chip, tile.weightClass === weight && styles.chipOn]}
            >
              <Text style={[styles.chipText, tile.weightClass === weight && styles.chipTextOn]}>
                {tile.weightClass}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onPullRefresh()} tintColor={colors.gold} />}
      >
        {loading || busy ? <ActivityIndicator color={colors.gold} style={styles.spinner} /> : null}

        {notReleased ? (
          <View style={styles.centre}>
            <Ionicons name="lock-closed-outline" size={34} color={colors.line} />
            <Text style={styles.emptyTitle}>Brackets not released yet</Text>
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : error && !busy ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        {preview && results && !notReleased ? (
          <>
            <View style={styles.statusRow}>
              <View>
                <Text style={styles.statusStrong}>
                  {results.recorded} of {results.totalBouts} bouts recorded
                </Text>
                <Text style={styles.statusSub}>{freshness(results.lastUpdated)}</Text>
              </View>
              {championName ? (
                <View style={styles.championPill}>
                  <Ionicons name="trophy" size={13} color={colors.ink} />
                  <Text style={styles.championText}>{championName}</Text>
                </View>
              ) : null}
            </View>

            <BracketCanvas
              layout={preview.layout.championship}
              winners={winnersByBout}
              resolved={resolvedByBout}
              onPickWinner={() => undefined}
            />

            {preview.layout.consolation ? (
              <>
                <Text style={styles.sectionLabel}>CONSOLATION</Text>
                <BracketCanvas
                  layout={preview.layout.consolation}
                  winners={winnersByBout}
                  resolved={resolvedByBout}
                  onPickWinner={() => undefined}
                />
              </>
            ) : null}

            <Text style={styles.footnote}>
              Results are entered at the mats as bouts finish. Pull down to refresh.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.sm },
  flexShrink: { flexShrink: 1 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: space.md },
  crossLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  crossLinkText: { ...type.label, color: colors.gold, fontWeight: "700" },
  eyebrow: { ...type.caption, color: colors.red, letterSpacing: 1.4, fontWeight: "700" },
  titleLine: { flexDirection: "row", alignItems: "center", gap: space.sm },
  title: { ...type.title, color: colors.text },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: "rgba(52, 199, 89, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(52, 199, 89, 0.5)",
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#34C759" },
  liveText: { ...type.caption, color: "#34C759", fontWeight: "800", letterSpacing: 1 },

  chips: { gap: space.xs, paddingVertical: space.xs, paddingRight: space.lg },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { ...type.label, color: colors.textSecondary, fontWeight: "700" },
  chipTextOn: { color: colors.ink },

  body: { paddingBottom: space.xl * 2, gap: space.md },
  spinner: { marginTop: space.lg },
  centre: { alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.xl },
  emptyTitle: { ...type.heading, color: colors.text },
  emptyText: { ...type.body, color: colors.textSecondary, textAlign: "center" },
  errorText: { ...type.label, color: colors.red, paddingHorizontal: space.lg },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    marginHorizontal: space.lg,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  statusStrong: { ...type.label, color: colors.text, fontWeight: "700" },
  statusSub: { ...type.caption, color: colors.textMuted },
  championPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: space.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
  },
  championText: { ...type.caption, color: colors.ink, fontWeight: "800" },

  sectionLabel: { ...type.caption, color: colors.textMuted, letterSpacing: 1.2, paddingHorizontal: space.lg },
  footnote: { ...type.caption, color: colors.textMuted, paddingHorizontal: space.lg },
})
