import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Stack } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { fetchMembershipCards, recordDropIn, type MembershipCard, type PartnerDropIn } from "@/lib/membership-card"

function formatDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric" })
}

/** A labelled line on the card. Absent facts are left off rather than shown as a blank. */
function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

/**
 * The drop-in control: pick a club, then one button.
 *
 * A row per club worked with one partner and would not with five. The picker keeps the card the
 * same height however many clubs are added, and only appears when there is a choice to make.
 */
function DropInSection({
  card,
  busyKey,
  onClaim,
}: {
  card: MembershipCard
  busyKey: string | null
  onClaim: (club: PartnerDropIn) => void
}) {
  const [selectedId, setSelectedId] = useState(card.dropIns[0]?.clubId ?? "")
  const club = card.dropIns.find((d) => d.clubId === selectedId) ?? card.dropIns[0] ?? null
  if (!club) return null

  const busy = busyKey === `${card.athleteId}:${club.clubId}`
  const membershipInactive = card.status !== "active"

  /** Say why the button is unavailable. A blank date was the worst of both. */
  const reason = membershipInactive
    ? card.status === "paused"
      ? "Membership paused — drop-ins resume when it does"
      : "Membership inactive — renew to use drop-ins"
    : club.availableFrom
      ? `Used here. Next free drop-in ${formatDate(club.availableFrom)}`
      : null

  return (
    <View style={styles.dropInSection}>
      <Text style={styles.dropInHeading}>FREE DROP-IN</Text>

      {card.dropIns.length > 1 ? (
        <View style={styles.clubPicker}>
          {card.dropIns.map((option) => {
            const on = option.clubId === club.clubId
            return (
              <Pressable
                key={option.clubId}
                onPress={() => setSelectedId(option.clubId)}
                style={[styles.clubChip, on && styles.clubChipOn]}
                accessibilityRole="button"
              >
                <Text style={[styles.clubChipText, on && styles.clubChipTextOn]} numberOfLines={1}>
                  {option.clubName}
                </Text>
              </Pressable>
            )
          })}
        </View>
      ) : (
        <Text style={styles.singleClub}>{club.clubName}</Text>
      )}

      <View style={[styles.dropIn, club.eligible ? styles.dropInOpen : styles.dropInClosed]}>
        <Ionicons
          name={club.eligible ? "checkmark-circle" : "time-outline"}
          size={22}
          color={club.eligible ? colors.success : colors.textSecondary}
        />
        <Text style={styles.dropInBody}>{club.eligible ? "Available now" : reason}</Text>
      </View>

      <Pressable
        style={[styles.tap, !club.eligible && styles.tapOff]}
        onPress={() => onClaim(club)}
        disabled={!club.eligible || busy}
        accessibilityRole="button"
      >
        <Text style={[styles.tapText, !club.eligible && styles.tapTextOff]}>
          {busy ? "Recording…" : "Coach: tap to check in"}
        </Text>
      </Pressable>
    </View>
  )
}

function formatMonthYear(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" })
}

/**
 * A live clock, so a screenshot is obviously not today's card.
 *
 * This is the whole anti-sharing mechanism, chosen because it asks nothing of the partner club —
 * no scanner, no app, no account. A coach glances and sees the seconds moving; a screenshot passed
 * around a group chat is frozen and dated.
 */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export default function MembershipCardScreen() {
  const [cards, setCards] = useState<MembershipCard[] | null>(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const { width } = useWindowDimensions()
  const now = useNow()

  const load = useCallback(async () => {
    try {
      setError("")
      setCards(await fetchMembershipCards())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your membership.")
      setCards([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const claim = useCallback(
    (card: MembershipCard, club: PartnerDropIn) => {
      /**
       * Confirmed before it is written, and written by the coach's own tap. A mis-tap costs the
       * family thirty days, so the club is named in the prompt and the action is theirs to take.
       */
      Alert.alert(
        "Coach: confirm drop-in",
        `Record ${card.name}'s free drop-in at ${club.clubName}? This uses their one visit there for the next 30 days.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm",
            onPress: async () => {
              setSaving(`${card.athleteId}:${club.clubId}`)
              try {
                await recordDropIn(card.athleteId, club.clubId)
                await load()
              } catch (e) {
                Alert.alert("Not recorded", e instanceof Error ? e.message : "Try again.")
              } finally {
                setSaving(null)
              }
            },
          },
        ],
      )
    },
    [load],
  )

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <Stack.Screen options={{ title: "Membership" }} />
      {cards === null ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : cards.length === 0 ? (
        <View style={styles.empty}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Ionicons name="card-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Blue membership</Text>
          <Text style={styles.emptyBody}>
            NC United Blue members get a free drop-in each month at every partner club. Ask us about joining.
          </Text>
        </View>
      ) : (
        <>
          {/* One card per screen, swiped between. It is held up at a door, so it fills the screen. */}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            style={styles.pager}
          >
            {cards.map((card) => {
              const live = card.status === "active"
              return (
                <View key={card.athleteId} style={[styles.page, { width }]}>
                  <View style={styles.card}>
                    <View style={styles.cardHead}>
                      <Text style={styles.brand}>NC UNITED BLUE</Text>
                      <View style={[styles.pill, live ? styles.pillLive : styles.pillOff]}>
                        <Text style={[styles.pillText, live ? styles.pillTextLive : styles.pillTextOff]}>
                          {card.status === "active" ? "ACTIVE" : card.status === "paused" ? "PAUSED" : "INACTIVE"}
                        </Text>
                      </View>
                    </View>

                    {/* Laid out as a credential: portrait photo, then the fields a coach reads. */}
                    <View style={styles.identity}>
                      {card.photoUrl ? (
                        <Image source={{ uri: card.photoUrl }} style={styles.photo} />
                      ) : (
                        <View style={[styles.photo, styles.photoEmpty]}>
                          <Ionicons name="person" size={56} color={colors.textMuted} />
                        </View>
                      )}
                      <View style={styles.identityText}>
                        <Text style={styles.name} numberOfLines={2}>
                          {card.name}
                        </Text>
                        <Field label="SCHOOL" value={card.highSchool} />
                        <Field label="CLUB" value={card.club} />
                        <Field label="CLASS OF" value={card.graduationYear ? String(card.graduationYear) : null} />
                      </View>
                    </View>

                    {card.memberSince ? (
                      <View style={styles.sinceRow}>
                        <Text style={styles.sinceLabel}>MEMBER SINCE</Text>
                        <Text style={styles.sinceValue}>{formatMonthYear(card.memberSince)}</Text>
                      </View>
                    ) : null}

                    {/* The moving clock is what makes a screenshot useless. */}
                    <Text style={styles.clock}>
                      {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} ·{" "}
                      {now.toLocaleTimeString()}
                    </Text>

                    {card.staleWarning ? <Text style={styles.stale}>{card.staleWarning}</Text> : null}

                    <View style={styles.spacer} />

                    <DropInSection card={card} busyKey={saving} onClaim={(club) => claim(card, club)} />
                  </View>
                </View>
              )
            })}
          </ScrollView>

          {cards.length > 1 ? (
            <View style={styles.dots}>
              {cards.map((card, i) => (
                <View key={card.athleteId} style={[styles.dot, i === page && styles.dotOn]} />
              ))}
            </View>
          ) : null}
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  pager: { flex: 1 },
  page: { padding: space.lg },
  spacer: { flex: 1 },
  dots: { flexDirection: "row", justifyContent: "center", gap: space.sm, paddingBottom: space.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line },
  dotOn: { backgroundColor: colors.gold },
  error: { ...type.body, color: colors.red, textAlign: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm, padding: space.xl },
  emptyTitle: { ...type.title, color: colors.text },
  emptyBody: { ...type.body, color: colors.textSecondary, textAlign: "center", paddingHorizontal: space.lg },

  card: {
    flex: 1,
    backgroundColor: colors.raised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.md,
  },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { ...type.caption, color: colors.gold },
  pill: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill },
  pillLive: { backgroundColor: colors.gold },
  pillOff: { backgroundColor: colors.surface },
  pillText: { ...type.caption },
  pillTextLive: { color: colors.ink },
  pillTextOff: { color: colors.textSecondary },

  identity: { flexDirection: "row", gap: space.lg, alignItems: "flex-start" },
  photo: {
    width: 120,
    height: 150,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  photoEmpty: { alignItems: "center", justifyContent: "center" },
  identityText: { flex: 1, gap: space.sm },
  name: { ...type.title, color: colors.text },
  field: { gap: 1 },
  fieldLabel: { ...type.caption, color: colors.textMuted, fontSize: 9 },
  fieldValue: { ...type.body, color: colors.text },

  sinceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: space.md,
  },
  sinceLabel: { ...type.caption, color: colors.textMuted, fontSize: 9 },
  sinceValue: { ...type.label, color: colors.textSecondary },

  clock: { ...type.label, color: colors.textMuted, textAlign: "center" },
  stale: { ...type.label, color: colors.warning, textAlign: "center" },

  dropInSection: { gap: space.sm },
  dropInHeading: { ...type.caption, color: colors.textMuted, fontSize: 9 },
  singleClub: { ...type.heading, color: colors.text },
  clubPicker: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  clubChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  clubChipOn: { borderColor: colors.gold, backgroundColor: "rgba(211,181,116,0.14)" },
  clubChipText: { ...type.label, color: colors.textSecondary },
  clubChipTextOn: { color: colors.gold },
  dropIn: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
  },
  dropInOpen: { backgroundColor: "rgba(63,178,127,0.12)", borderColor: "rgba(63,178,127,0.4)" },
  dropInClosed: { backgroundColor: colors.surface, borderColor: colors.line },
  dropInBody: { ...type.label, color: colors.textSecondary, flex: 1 },

  tap: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: "center",
  },
  tapOff: { backgroundColor: colors.surface },
  tapText: { ...type.heading, color: colors.ink },
  tapTextOff: { color: colors.textMuted },
})
