import { useCallback, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { router, useFocusEffect } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { supabase } from "@/lib/supabase"
import { fetchMyAthletes, type LinkedAthlete, type MissingField } from "@/lib/my-athletes"
import { openWebPage } from "@/lib/profile-link"

/**
 * The card at the top of Home and Athletes: "Create your free profile", or for a family whose
 * wrestler is already on file, the one thing that profile most needs ("Add Jaxon's cell number").
 *
 * Tucked under More, nobody found it - and making a profile is the reason most families download
 * the app. It shows to everyone who might need one: signed out, or signed in with no wrestler
 * linked. College coaches never see it. A complete profile gets no card at all. While it is
 * being worked out it stays hidden, so it never flashes up and then vanishes.
 */
type CardState = { kind: "create" } | { kind: "complete"; athlete: LinkedAthlete; field: MissingField } | null

export function CreateProfileCard() {
  const [state, setState] = useState<CardState>(null)

  useFocusEffect(
    useCallback(() => {
      let live = true
      void whatToAsk().then((next) => live && setState(next))
      return () => {
        live = false
      }
    }, []),
  )

  if (!state) return null
  if (state.kind === "create") {
    return (
      <Card
        icon="person-add"
        title="Create your free profile"
        detail="College coaches are on RecruitNC. Takes about a minute."
        onPress={() => router.push("/create-profile" as never)}
      />
    )
  }
  const { athlete, field } = state
  const ask = askFor(athlete, field)
  return <Card icon={ask.icon} title={ask.title} detail={ask.detail} onPress={ask.onPress} />
}

function Card(props: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={props.title}
    >
      <View style={styles.icon}>
        <Ionicons name={props.icon} size={22} color={colors.ink} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{props.title}</Text>
        <Text style={styles.detail}>{props.detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.ink} />
    </Pressable>
  )
}

/** "your" for the wrestler; the wrestler's first name for a parent. */
function askFor(athlete: LinkedAthlete, field: MissingField) {
  const own = athlete.relationship === "self"
  const first = athlete.name.trim().split(/\s+/)[0] || "your wrestler"
  const whose = own ? "your" : `${first}'s`
  const edit = () =>
    router.push({ pathname: "/athlete-edit", params: { id: athlete.id, name: athlete.name, focus: field } } as never)
  switch (field) {
    case "phone":
      return { icon: "call" as const, title: `Add ${whose} cell number`, detail: "It's how college coaches reach out. Only verified coaches see it.", onPress: edit }
    case "gpa":
      return { icon: "school" as const, title: `Add ${whose} GPA`, detail: "The first thing college coaches filter on.", onPress: edit }
    case "photo":
      return {
        icon: "camera" as const,
        title: own ? "Add your photo" : `Add a photo of ${first}`,
        detail: "Profiles with a photo get opened the most.",
        onPress: () => openWebPage(`/view-profile?id=${encodeURIComponent(athlete.id)}&edit=photo`),
      }
    case "film":
      return { icon: "videocam" as const, title: `Add ${whose} highlight film`, detail: "Coaches want to see you wrestle.", onPress: edit }
  }
}

async function whatToAsk(): Promise<CardState> {
  try {
    const { data } = await supabase.auth.getSession()
    const userId = data.session?.user.id
    if (!userId) return { kind: "create" }
    const { data: profile } = await supabase.from("user_profiles").select("profile_type").eq("user_id", userId).maybeSingle()
    if (profile?.profile_type === "college-coach") return null
    const { linked } = await fetchMyAthletes()
    if (linked.length === 0) return { kind: "create" }
    // Their own profile first, then each wrestler in turn; the most important gap of the first one short.
    const ordered = [...linked].sort((a, b) => Number(b.relationship === "self") - Number(a.relationship === "self"))
    for (const athlete of ordered) {
      const field = athlete.missing?.[0]
      if (field) return { kind: "complete", athlete, field }
    }
    return null
  } catch {
    // Unsure means quiet: a card that is wrong is worse than one that is missing for a moment.
    return null
  }
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.gold,
  },
  pressed: { opacity: 0.85 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,22,40,0.12)",
  },
  body: { flex: 1, gap: 2 },
  title: { ...type.heading, color: colors.ink, fontWeight: "800" },
  detail: { ...type.label, color: colors.ink, opacity: 0.8 },
})
