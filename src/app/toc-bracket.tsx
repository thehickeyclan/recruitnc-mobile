import { useCallback, useEffect, useMemo, useState, type Ref } from "react"
import { useRef } from "react"
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { router, useLocalSearchParams } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { compareBySurname, fetchTocField, type TocField, type TocFieldAthlete } from "@/lib/toc-field"
import {
  buildBracketPreview,
  slotLabel,
  slotSeed,
  type BracketPreview,
  type BracketSlotDisplay,
} from "@/lib/toc-bracket"
import { BracketCanvas } from "@/components/bracket-canvas"
import { shareBracketImage } from "@/lib/share-bracket"
import { championOf, pickProgress, simulate, updatePick, type SimulationPicks } from "@/lib/bracket-simulation"
import { PoolSubmit } from "@/components/pool-submit"

const ORDER_KEY = "recruitnc.tocBracketOrders"
const PICKS_KEY = "recruitnc.tocBracketPicks"

type Orders = Record<string, string[]>
type AllPicks = Record<string, SimulationPicks>

/**
 * Alphabetical by surname — the same order the field is published in.
 *
 * This list used to open in credential order, strongest first, as a convenience so nobody had to
 * rank eight strangers. But an ordered list of a weight class, published by the people running
 * the tournament, reads as a suggested seeding whatever the label above it says. Alphabetical
 * takes no view, and matches what The Field shows.
 */
function defaultOrder(athletes: TocFieldAthlete[]): string[] {
  return [...athletes].sort(compareBySurname).map((a) => a.athleteId)
}

/**
 * The bracket as a self-contained card: logo, weight, who wins it, championship, consolation.
 *
 * Rendered twice — once on screen with scrolling canvases so the bracket is tappable on a phone,
 * once off-screen unscrolled so it can be photographed whole. Sharing a bracket that stops where
 * the phone's edge happened to fall is worse than not sharing one, and a picture of names with
 * no logo or weight class means nothing once it leaves the app.
 */
function BracketCard({
  weight,
  championName,
  layout,
  winners,
  resolved,
  onPickWinner,
  scroll = true,
  cardRef,
  official = false,
}: {
  weight: number
  championName: string | null
  official?: boolean
  layout: BracketPreview["layout"]
  winners: Record<number, string | null>
  resolved: Record<number, { top: BracketSlotDisplay; bottom: BracketSlotDisplay }>
  onPickWinner: (boutNumber: number, competitorId: string) => void
  scroll?: boolean
  cardRef?: Ref<View>
}) {
  // Unscrolled, the card has to be told how wide it is: nothing else constrains it, and both
  // canvases have to fit the wider of the two so the columns line up down the image.
  const naturalWidth =
    Math.max(layout.championship.width, layout.consolation?.width ?? 0) + space.lg * 2

  return (
    <View
      ref={cardRef}
      collapsable={false}
      style={[styles.shareCard, !scroll && { width: naturalWidth, paddingHorizontal: space.lg }]}
    >
      <View style={styles.shareHead}>
        <Image
          source={require("../../assets/images/toc-logo.png")}
          style={styles.shareLogo}
          resizeMode="contain"
        />
        <View style={styles.flexShrink}>
          <Text style={styles.shareWeight}>{weight} lbs</Text>
          <Text style={styles.shareSub}>
            {championName ? `${championName} takes it` : official ? "Official bracket" : "Projected bracket"}
          </Text>
        </View>
      </View>

      <View style={styles.canvasWrap}>
        <BracketCanvas
          layout={layout.championship}
          winners={winners}
          resolved={resolved}
          onPickWinner={onPickWinner}
          scroll={scroll}
        />
      </View>

      {layout.consolation ? (
        <>
          <Text style={styles.sideLabel}>CONSOLATION</Text>
          <View style={styles.canvasWrap}>
            <BracketCanvas
              layout={layout.consolation}
              winners={winners}
              resolved={resolved}
              onPickWinner={onPickWinner}
              scroll={scroll}
            />
          </View>
        </>
      ) : null}

      <Text style={styles.shareFooter}>NC United Tournament of Champions · 18 September 2026</Text>
    </View>
  )
}

export default function TocBracketScreen() {
  const params = useLocalSearchParams<{ weight?: string }>()
  const [field, setField] = useState<TocField | null>(null)
  const [weight, setWeight] = useState<number | null>(null)
  const [orders, setOrders] = useState<Orders>({})
  const [allPicks, setAllPicks] = useState<AllPicks>({})
  const [preview, setPreview] = useState<BracketPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  /** Points at the off-screen, unscrolled copy of the card — see share-bracket.ts. */
  const shareRef = useRef<View>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [f, savedOrders, savedPicks] = await Promise.all([
          fetchTocField(),
          AsyncStorage.getItem(ORDER_KEY),
          AsyncStorage.getItem(PICKS_KEY),
        ])
        setField(f)
        const wanted = Number(params.weight)
        setWeight(
          Number.isFinite(wanted) && f.weights.some((w) => w.weightClass === wanted)
            ? wanted
            : (f.weights[0]?.weightClass ?? null),
        )
        if (savedOrders) setOrders(JSON.parse(savedOrders) as Orders)
        if (savedPicks) setAllPicks(JSON.parse(savedPicks) as AllPicks)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load the field.")
      } finally {
        setLoading(false)
      }
    })()
  }, [params.weight])

  const athletes = useMemo(
    () => field?.weights.find((w) => w.weightClass === weight)?.athletes ?? [],
    [field, weight],
  )
  const key = String(weight)
  const byId = useMemo(() => new Map(athletes.map((a) => [a.athleteId, a])), [athletes])

  /** Whatever they seeded, in their order. Empty until they start tapping. */
  const seeded = useMemo(
    () => (orders[key] ?? []).filter((id) => byId.has(id)),
    [orders, key, byId],
  )
  const unseeded = useMemo(
    () => defaultOrder(athletes).filter((id) => !seeded.includes(id)),
    [athletes, seeded],
  )

  const picks = allPicks[key] ?? {}

  const saveOrder = useCallback(
    async (next: string[]) => {
      const merged = { ...orders, [key]: next }
      setOrders(merged)
      setPreview(null)
      await AsyncStorage.setItem(ORDER_KEY, JSON.stringify(merged)).catch(() => undefined)
    },
    [orders, key],
  )

  const savePicks = useCallback(
    async (next: SimulationPicks) => {
      const merged = { ...allPicks, [key]: next }
      setAllPicks(merged)
      await AsyncStorage.setItem(PICKS_KEY, JSON.stringify(merged)).catch(() => undefined)
    },
    [allPicks, key],
  )

  /**
   * Draw from the very first tap. The builder pads the rest with open spots, so the bracket
   * fills in as you seed rather than making you do eight taps of work before anything appears.
   */
  useEffect(() => {
    if (weight == null || seeded.length === 0) return
    let cancelled = false
    setBusy(true)
    buildBracketPreview(weight, seeded)
      .then((p) => !cancelled && setPreview(p))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not build that bracket."))
      .finally(() => !cancelled && setBusy(false))
    return () => {
      cancelled = true
    }
  }, [weight, seeded, athletes.length])

  const simulated = useMemo(
    () => (preview ? simulate(preview.draw, picks) : null),
    [preview, picks],
  )
  const winnersByBout = useMemo(() => {
    const out: Record<number, string | null> = {}
    for (const bout of simulated?.bouts ?? []) out[bout.boutNumber] = bout.winnerAthleteId
    return out
  }, [simulated])
  /**
   * What the server drew, by bout number.
   *
   * The server collapses walkovers — a nine-man weight is mostly byes, and it resolves the feeders
   * that point at them. Those labels are better than anything reconstructed here from the raw
   * draw, which still holds all twenty-eight bouts including the ones nobody wrestles.
   */
  const layoutSlots = useMemo(() => {
    const out: Record<number, { top: BracketSlotDisplay; bottom: BracketSlotDisplay }> = {}
    for (const side of [preview?.layout.championship, preview?.layout.consolation]) {
      for (const match of side?.matches ?? []) {
        if (match.boutNumber != null) out[match.boutNumber] = { top: match.top, bottom: match.bottom }
      }
    }
    return out
  }, [preview])

  /**
   * Who is in each bout once the picks are applied — the layout alone never changes.
   *
   * Only a slot the simulation has resolved to an actual wrestler overrides the server. Left to
   * override everything, it reinstated feeders the server had already collapsed: bout 21 read
   * "Winner Bout 16" when bout 16 is a walkover nobody wrestles.
   */
  const resolvedByBout = useMemo(() => {
    const out: Record<number, { top: any; bottom: any }> = {}
    for (const bout of simulated?.bouts ?? []) {
      const asDisplay = (slot: (typeof bout)["top"]) => ({
        name: slotLabel(simulated!, slot),
        subtitle: null,
        seed: slotSeed(simulated!, slot),
        isOpen: slot.kind !== "athlete" || slotSeed(simulated!, slot) == null,
        photoUrl: null,
        competitorId: slot.kind === "athlete" ? slot.athleteId : null,
      })
      // Use the simulation whenever it has worked out an actual wrestler — including through a
      // feeder, which is how "Loser Bout 2" becomes the wrestler who just lost the pigtail. Only
      // fall back to the server's slot when the simulation has nobody, so collapsed walkovers stay
      // collapsed without also discarding the results of a pick.
      const drawn = layoutSlots[bout.boutNumber]
      const pick = (slot: (typeof bout)["top"], fallback: BracketSlotDisplay | undefined) => {
        const resolved = asDisplay(slot)
        return resolved.competitorId ? resolved : fallback ?? resolved
      }
      out[bout.boutNumber] = {
        top: pick(bout.top, drawn?.top),
        bottom: pick(bout.bottom, drawn?.bottom),
      }
    }
    return out
  }, [simulated, layoutSlots])

  const progress = simulated ? pickProgress(simulated, picks) : { picked: 0, total: 0 }
  const champion = simulated ? championOf(simulated, picks) : null
  const championName = champion ? (byId.get(champion)?.name ?? null) : null

  const tapSlot = useCallback(
    (boutNumber: number, athleteId: string | null) => {
      if (!simulated || !athleteId) return
      void savePicks(updatePick(simulated, picks, boutNumber, athleteId))
    },
    [simulated, picks, savePicks],
  )

  const share = useCallback(async () => {
    if (weight == null) return
    setSharing(true)
    const outcome = await shareBracketImage(shareRef, weight)
    if (outcome === "unavailable") setError("Sharing is not available on this device.")
    if (outcome === "failed") setError("Could not create the image.")
    setSharing(false)
  }, [weight])

  const reset = useCallback(() => {
    void saveOrder([])
    void savePicks({})
  }, [saveOrder, savePicks])

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.flexShrink}>
            <Text style={styles.eyebrow}>TOURNAMENT OF CHAMPIONS</Text>
            <Text style={styles.title} maxFontSizeMultiplier={1.4}>
              Your Bracket
            </Text>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chips}>
            {(field?.tiles ?? []).map((tile) => (
              <Pressable
                key={tile.weightClass}
                disabled={!tile.announced}
                onPress={() => {
                  setWeight(tile.weightClass)
                  setPreview(null)
                }}
                style={[styles.chip, tile.weightClass === weight && styles.chipActive, !tile.announced && styles.chipLocked]}
              >
                <Text
                  style={[
                    styles.chipText,
                    tile.weightClass === weight && styles.chipTextActive,
                    !tile.announced && styles.chipTextLocked,
                  ]}
                >
                  {tile.weightClass}
                </Text>
                {tile.announced ? null : <Ionicons name="lock-closed" size={11} color={colors.textMuted} />}
              </Pressable>
            ))}
          </ScrollView>

          {athletes.length === 0 ? (
            <View style={styles.centre}>
              <Ionicons name="lock-closed-outline" size={34} color={colors.line} />
              <Text style={styles.emptyTitle}>No weights released yet</Text>
              <Text style={styles.emptyText}>
                Once a weight class field is announced you can seed it and run the bracket.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.body}>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {/* Seeding is how you build a projection. Once TOC has released the real draw
                  there is nothing to seed — the bracket is simply the bracket. */}
              {!preview?.official && seeded.length < athletes.length ? (
                <>
                  <Text style={styles.instruction}>
                    Tap wrestlers in the order you&apos;d seed them — {seeded.length} of {athletes.length}.
                  </Text>
                  {seeded.length > 0 ? (
                    <View style={styles.seededWrap}>
                      {seeded.map((id, i) => (
                        <Pressable
                          key={id}
                          style={styles.seededPill}
                          onPress={() => void saveOrder(seeded.filter((x) => x !== id))}
                        >
                          <Text style={styles.seededSeed}>{i + 1}</Text>
                          <Text style={styles.seededName} numberOfLines={1}>
                            {byId.get(id)?.name}
                          </Text>
                          <Ionicons name="close" size={12} color={colors.ink} />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}

                  {unseeded.map((id) => {
                    const a = byId.get(id)!
                    return (
                      <Pressable key={id} style={styles.pick} onPress={() => void saveOrder([...seeded, id])}>
                        <View style={styles.pickBody}>
                          <Text style={styles.name} numberOfLines={1}>
                            {a.name}
                          </Text>
                          <Text style={styles.sub} numberOfLines={1}>
                            {[a.credentials[0]?.label, a.club].filter(Boolean).join(" · ")}
                          </Text>
                        </View>
                        <Ionicons name="add-circle-outline" size={20} color={colors.gold} />
                      </Pressable>
                    )
                  })}
                </>
              ) : null}

              {/* Shown as soon as there is anything to show, so the bracket grows while you
                  seed rather than appearing only once the last wrestler is placed. */}
              {simulated && preview ? (
                <>
                  <View style={styles.statusRow}>
                    <Text style={styles.status}>
                      {championName ? `Your champion: ${championName}` : `${progress.picked} of ${progress.total} picked`}
                    </Text>
                    <Pressable onPress={reset} hitSlop={8}>
                      <Text style={styles.resetText}>Start over</Text>
                    </Pressable>
                  </View>

                  {!preview?.official ? (
                    <View style={styles.notice}>
                      <Ionicons name="information-circle" size={15} color={colors.gold} />
                      <Text style={styles.noticeText}>
                        Your projection — official brackets and seeds are released 11 September.
                        Nobody else can see your picks, and NC United never publishes them.
                      </Text>
                    </View>
                  ) : null}

                  <BracketCard
                    weight={preview.weightClass}
                    championName={championName}
                    official={preview.official}
                    layout={preview.layout}
                    winners={winnersByBout}
                    resolved={resolvedByBout}
                    onPickWinner={tapSlot}
                  />

                  {/* The copy that actually gets shared. Same card, laid out off-screen at the
                      bracket's natural width with no ScrollViews, because captureRef photographs
                      what is drawn — and a scrolling canvas draws only its viewport. */}
                  <View style={styles.offscreen} pointerEvents="none">
                    <BracketCard
                      cardRef={shareRef}
                      scroll={false}
                      weight={preview.weightClass}
                      championName={championName}
                      official={preview.official}
                      layout={preview.layout}
                      winners={winnersByBout}
                      resolved={resolvedByBout}
                      onPickWinner={tapSlot}
                    />
                  </View>

                  <PoolSubmit
                    weightClass={preview.weightClass}
                    picks={picks}
                    complete={progress.total > 0 && progress.picked === progress.total}
                  />

                  {/* Deliberately quieter than Submit, and directly under the pool card, because a
                      parent read a gold "Share my bracket" sitting there as the way to enter. One
                      filled gold button per screen; this one makes a picture and nothing else. */}
                  <Pressable style={styles.shareButton} onPress={() => void share()} disabled={sharing}>
                    {sharing ? (
                      <ActivityIndicator color={colors.gold} size="small" />
                    ) : (
                      <>
                        <Ionicons name="image-outline" size={16} color={colors.gold} />
                        <Text style={styles.shareButtonText}>Save an image to share</Text>
                      </>
                    )}
                  </Pressable>
                  <Text style={styles.shareNote}>
                    Makes a picture on your phone to send to whoever you like. It is not an entry, and it
                    sends nothing to NC United.
                  </Text>
                </>
              ) : busy ? (
                <View style={styles.centre}>
                  <ActivityIndicator color={colors.gold} />
                </View>
              ) : null}
            </ScrollView>
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

  centre: { alignItems: "center", justifyContent: "center", gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.xl },
  emptyTitle: { ...type.title, color: colors.text, textAlign: "center" },
  emptyText: { ...type.body, color: colors.textMuted, textAlign: "center" },
  errorText: { ...type.label, color: colors.red },

  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chips: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.md, alignItems: "center" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: space.md, paddingVertical: space.sm,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.raised,
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipLocked: { backgroundColor: colors.surface, opacity: 0.55 },
  chipText: { ...type.label, color: colors.text },
  chipTextActive: { color: colors.ink },
  chipTextLocked: { color: colors.textMuted },

  body: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.sm },
  instruction: { ...type.body, color: colors.textSecondary, marginBottom: space.xs },

  seededWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.sm },
  seededPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.gold, borderRadius: radius.pill,
    paddingHorizontal: space.md, paddingVertical: 6, maxWidth: "100%",
  },
  seededSeed: { ...type.caption, color: colors.ink, fontWeight: "700" },
  seededName: { ...type.label, color: colors.ink, flexShrink: 1 },

  pick: {
    flexDirection: "row", alignItems: "center", gap: space.md,
    backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.md,
  },
  pickBody: { flex: 1 },
  name: { ...type.heading, color: colors.text },
  sub: { ...type.label, color: colors.textMuted },

  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  status: { ...type.label, color: colors.gold, flexShrink: 1 },
  resetText: { ...type.label, color: colors.textMuted, textDecorationLine: "underline" },

  notice: {
    flexDirection: "row", gap: space.sm, alignItems: "flex-start",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, padding: space.md,
  },
  noticeText: { ...type.label, color: colors.textSecondary, flex: 1 },

  shareCard: { backgroundColor: colors.ink, paddingBottom: space.md, gap: space.sm },
  // Off the left edge rather than hidden: `display: none` and `opacity: 0` both stop it being
  // drawn, and captureRef can only photograph something that was drawn.
  offscreen: { position: "absolute", left: -10000, top: 0 },
  shareHead: { flexDirection: "row", alignItems: "center", gap: space.md, paddingTop: space.sm },
  shareLogo: { width: 54, height: 54 },
  shareWeight: { ...type.title, color: colors.text },
  shareSub: { ...type.label, color: colors.gold },
  shareFooter: { ...type.caption, color: colors.textMuted, paddingTop: space.sm },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    marginTop: space.md,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: space.md,
  },
  shareButtonText: { ...type.label, color: colors.gold, fontWeight: "700" },
  shareNote: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: space.sm,
    lineHeight: 16,
  },
  canvasWrap: {
    marginTop: space.md,
    marginHorizontal: -space.lg,
    backgroundColor: colors.ink,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    paddingVertical: space.md,
  },
  sideLabel: { ...type.caption, color: colors.gold, marginTop: space.xl },
  round: { marginTop: space.lg, gap: space.sm },
  roundLabel: { ...type.caption, color: colors.gold },
  bout: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, overflow: "hidden" },
  slot: {
    flexDirection: "row", alignItems: "center", gap: space.sm,
    backgroundColor: colors.raised, paddingHorizontal: space.md, paddingVertical: space.sm,
  },
  slotTop: { borderBottomWidth: 1, borderBottomColor: colors.line },
  slotWon: { backgroundColor: colors.gold },
  slotSeed: { ...type.caption, color: colors.textMuted, width: 14 },
  slotName: { ...type.body, color: colors.text, flex: 1 },
  slotNameWon: { color: colors.ink, fontWeight: "700" },
  slotPending: { color: colors.textMuted, fontStyle: "italic" },
})
