import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { router } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { fetchTocField, type TocField, type TocFieldAthlete } from "@/lib/toc-field"
import {
  boutsByRound,
  buildBracketPreview,
  moveInOrder,
  slotLabel,
  slotSeed,
  type BracketPreview,
} from "@/lib/toc-bracket"

/** Orders live on the device. Private by design — nothing is uploaded and nobody else sees them. */
const ORDER_KEY = "recruitnc.tocBracketOrders"

type Orders = Record<string, string[]>

export default function TocBracketScreen() {
  const [field, setField] = useState<TocField | null>(null)
  const [weight, setWeight] = useState<number | null>(null)
  const [orders, setOrders] = useState<Orders>({})
  const [preview, setPreview] = useState<BracketPreview | null>(null)
  const [tab, setTab] = useState<"order" | "bracket">("order")
  const [loading, setLoading] = useState(true)
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [f, saved] = await Promise.all([fetchTocField(), AsyncStorage.getItem(ORDER_KEY)])
        setField(f)
        setWeight(f.weights[0]?.weightClass ?? null)
        if (saved) setOrders(JSON.parse(saved) as Orders)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load the field.")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const athletes: TocFieldAthlete[] = useMemo(
    () => field?.weights.find((w) => w.weightClass === weight)?.athletes ?? [],
    [field, weight],
  )

  /**
   * The order for this weight: whatever they saved, then anyone added to the field since.
   * A wrestler announced after they last touched this weight joins the bottom rather than
   * silently vanishing from their bracket.
   */
  const order: string[] = useMemo(() => {
    const ids = athletes.map((a) => a.athleteId)
    const saved = (orders[String(weight)] ?? []).filter((id) => ids.includes(id))
    return [...saved, ...ids.filter((id) => !saved.includes(id))]
  }, [athletes, orders, weight])

  const persist = useCallback(
    async (next: string[]) => {
      const merged = { ...orders, [String(weight)]: next }
      setOrders(merged)
      setPreview(null)
      await AsyncStorage.setItem(ORDER_KEY, JSON.stringify(merged)).catch(() => undefined)
    },
    [orders, weight],
  )

  const move = useCallback(
    (from: number, to: number) => {
      const next = moveInOrder(order, from, to)
      if (next !== order) void persist(next)
    },
    [order, persist],
  )

  const build = useCallback(async () => {
    if (weight == null || order.length === 0) return
    setBuilding(true)
    setError(null)
    try {
      setPreview(await buildBracketPreview(weight, order))
      setTab("bracket")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build that bracket.")
    } finally {
      setBuilding(false)
    }
  }, [weight, order])

  const byId = useMemo(() => new Map(athletes.map((a) => [a.athleteId, a])), [athletes])
  const rounds = preview ? boutsByRound(preview.draw) : []

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
        <Text style={styles.subtitle}>
          Rank the field how you think it should seed, then see the bracket it makes. Saved on this
          phone only.
        </Text>
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
                  setTab("order")
                }}
                style={[
                  styles.chip,
                  tile.weightClass === weight && styles.chipActive,
                  !tile.announced && styles.chipLocked,
                ]}
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
                Once a weight class field is announced you can seed it and build your bracket.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.tabs}>
                {(["order", "bracket"] as const).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => (t === "bracket" && !preview ? void build() : setTab(t))}
                    style={[styles.tab, tab === t && styles.tabActive]}
                  >
                    <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                      {t === "order" ? "Your order" : "Bracket"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {tab === "order" ? (
                <ScrollView contentContainerStyle={styles.list}>
                  {order.map((id, i) => {
                    const a = byId.get(id)
                    if (!a) return null
                    return (
                      <View key={id} style={styles.row}>
                        <View style={styles.seedBadge}>
                          <Text style={styles.seedText}>{i + 1}</Text>
                        </View>
                        <View style={styles.rowBody}>
                          <Text style={styles.name} numberOfLines={1}>
                            {a.name}
                          </Text>
                          {a.club ? (
                            <Text style={styles.club} numberOfLines={1}>
                              {a.club}
                            </Text>
                          ) : null}
                        </View>
                        {/* Arrows rather than drag: reordering by dragging inside a scroll view
                            is fiddly on a phone, and this is the same operation without the fight. */}
                        <Pressable onPress={() => move(i, i - 1)} disabled={i === 0} hitSlop={8} style={styles.arrow}>
                          <Ionicons name="chevron-up" size={20} color={i === 0 ? colors.line : colors.gold} />
                        </Pressable>
                        <Pressable
                          onPress={() => move(i, i + 1)}
                          disabled={i === order.length - 1}
                          hitSlop={8}
                          style={styles.arrow}
                        >
                          <Ionicons
                            name="chevron-down"
                            size={20}
                            color={i === order.length - 1 ? colors.line : colors.gold}
                          />
                        </Pressable>
                      </View>
                    )
                  })}

                  <Pressable style={styles.build} onPress={() => void build()} disabled={building}>
                    {building ? (
                      <ActivityIndicator color={colors.ink} size="small" />
                    ) : (
                      <Text style={styles.buildText}>Build my bracket</Text>
                    )}
                  </Pressable>
                </ScrollView>
              ) : preview ? (
                <ScrollView contentContainerStyle={styles.list}>
                  {!preview.official ? (
                    <View style={styles.notice}>
                      <Ionicons name="information-circle" size={15} color={colors.gold} />
                      <Text style={styles.noticeText}>
                        Your projection — official brackets and seeds are released 11 September.
                      </Text>
                    </View>
                  ) : null}

                  {rounds.map(({ round, bouts }) => (
                    <View key={round} style={styles.round}>
                      <Text style={styles.roundLabel}>{round.toUpperCase()}</Text>
                      {bouts.map((bout) => (
                        <View key={bout.id} style={styles.bout}>
                          <Text style={styles.boutNumber}>{bout.boutNumber}</Text>
                          <View style={styles.boutBody}>
                            {[bout.top, bout.bottom].map((slot, idx) => {
                              const seed = slotSeed(preview.draw, slot)
                              return (
                                <View key={idx} style={styles.slot}>
                                  {seed != null ? <Text style={styles.slotSeed}>{seed}</Text> : null}
                                  <Text
                                    style={[styles.slotName, slot.kind !== "athlete" && styles.slotPending]}
                                    numberOfLines={1}
                                  >
                                    {slotLabel(preview.draw, slot)}
                                  </Text>
                                </View>
                              )
                            })}
                          </View>
                        </View>
                      ))}
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.centre}>
                  <ActivityIndicator color={colors.gold} />
                </View>
              )}
            </>
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

  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, paddingHorizontal: space.xl },
  emptyTitle: { ...type.title, color: colors.text, textAlign: "center" },
  emptyText: { ...type.body, color: colors.textMuted, textAlign: "center" },
  errorText: { ...type.label, color: colors.red, paddingHorizontal: space.lg, paddingTop: space.sm },

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

  tabs: { flexDirection: "row", gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm },
  tab: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabActive: { backgroundColor: colors.raised, borderColor: colors.gold },
  tabText: { ...type.label, color: colors.textMuted },
  tabTextActive: { color: colors.gold },

  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.sm },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  seedBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  seedText: { ...type.label, color: colors.ink, fontWeight: "700" },
  rowBody: { flex: 1 },
  name: { ...type.heading, color: colors.text },
  club: { ...type.label, color: colors.textMuted },
  arrow: { padding: 2 },

  build: {
    marginTop: space.md,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: "center",
  },
  buildText: { ...type.label, color: colors.ink, fontWeight: "700" },

  notice: {
    flexDirection: "row",
    gap: space.sm,
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
  },
  noticeText: { ...type.label, color: colors.textSecondary, flex: 1 },

  round: { marginTop: space.lg, gap: space.sm },
  roundLabel: { ...type.caption, color: colors.gold },
  bout: {
    flexDirection: "row",
    gap: space.md,
    alignItems: "center",
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  boutNumber: { ...type.caption, color: colors.textMuted, width: 16 },
  boutBody: { flex: 1, gap: 4 },
  slot: { flexDirection: "row", alignItems: "center", gap: space.sm },
  slotSeed: { ...type.caption, color: colors.gold, width: 14 },
  slotName: { ...type.body, color: colors.text, flex: 1 },
  slotPending: { color: colors.textMuted, fontStyle: "italic" },
})
