import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Stack } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { fetchMembershipCards, recordDropIn, type MembershipCard, type PartnerDropIn } from "@/lib/membership-card"

function formatDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric" })
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
    <SafeAreaView style={styles.screen} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Membership" }} />
      {cards === null ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {cards.length === 0 && !error ? (
            <View style={styles.empty}>
              <Ionicons name="card-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Blue membership</Text>
              <Text style={styles.emptyBody}>
                NC United Blue members get a free drop-in each month at every partner club. Ask us about joining.
              </Text>
            </View>
          ) : null}

          {cards.map((card) => {
            const live = card.status === "active"
            return (
              <View key={card.athleteId} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.brand}>NC UNITED BLUE</Text>
                  <View style={[styles.pill, live ? styles.pillLive : styles.pillOff]}>
                    <Text style={[styles.pillText, live ? styles.pillTextLive : styles.pillTextOff]}>
                      {card.status === "active" ? "ACTIVE" : card.status === "paused" ? "PAUSED" : "INACTIVE"}
                    </Text>
                  </View>
                </View>

                <View style={styles.identity}>
                  {card.photoUrl ? (
                    <Image source={{ uri: card.photoUrl }} style={styles.photo} />
                  ) : (
                    <View style={[styles.photo, styles.photoEmpty]}>
                      <Ionicons name="person" size={26} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.identityText}>
                    <Text style={styles.name}>{card.name}</Text>
                    {card.graduationYear ? <Text style={styles.meta}>Class of {card.graduationYear}</Text> : null}
                    {card.memberSince ? (
                      <Text style={styles.meta}>Member since {formatMonthYear(card.memberSince)}</Text>
                    ) : null}
                  </View>
                </View>

                {/* The moving clock is what makes a screenshot useless. */}
                <Text style={styles.clock}>
                  {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} ·{" "}
                  {now.toLocaleTimeString()}
                </Text>

                {card.staleWarning ? <Text style={styles.stale}>{card.staleWarning}</Text> : null}

                {/* One row per partner club: each club's free session stands on its own. */}
                {card.dropIns.map((club) => {
                  const busy = saving === `${card.athleteId}:${club.clubId}`
                  return (
                    <View key={club.clubId} style={styles.clubBlock}>
                      <View style={[styles.dropIn, club.eligible ? styles.dropInOpen : styles.dropInClosed]}>
                        <Ionicons
                          name={club.eligible ? "checkmark-circle" : "time-outline"}
                          size={22}
                          color={club.eligible ? colors.success : colors.textSecondary}
                        />
                        <View style={styles.dropInText}>
                          <Text style={styles.dropInTitle}>{club.clubName}</Text>
                          <Text style={styles.dropInBody}>
                            {club.eligible
                              ? "Free drop-in available"
                              : `Next free drop-in ${formatDate(club.availableFrom)}`}
                          </Text>
                        </View>
                      </View>

                      {club.eligible ? (
                        <Pressable
                          style={styles.tap}
                          onPress={() => claim(card, club)}
                          disabled={busy}
                          accessibilityRole="button"
                        >
                          <Text style={styles.tapText}>{busy ? "Recording…" : "Coach: tap to check in"}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  )
                })}
              </View>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: space.lg, gap: space.lg },
  error: { ...type.body, color: colors.red, textAlign: "center" },
  empty: { alignItems: "center", gap: space.sm, paddingVertical: space.xxl },
  emptyTitle: { ...type.title, color: colors.text },
  emptyBody: { ...type.body, color: colors.textSecondary, textAlign: "center", paddingHorizontal: space.lg },

  card: {
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

  identity: { flexDirection: "row", gap: space.md, alignItems: "center" },
  photo: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surface },
  photoEmpty: { alignItems: "center", justifyContent: "center" },
  identityText: { flex: 1, gap: 2 },
  name: { ...type.title, color: colors.text },
  meta: { ...type.label, color: colors.textSecondary },

  clock: { ...type.label, color: colors.textMuted, textAlign: "center" },
  stale: { ...type.label, color: colors.warning, textAlign: "center" },

  clubBlock: { gap: space.sm },
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
  dropInText: { flex: 1, gap: 2 },
  dropInTitle: { ...type.heading, color: colors.text },
  dropInBody: { ...type.label, color: colors.textSecondary },

  tap: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: "center",
  },
  tapText: { ...type.heading, color: colors.ink },
})
