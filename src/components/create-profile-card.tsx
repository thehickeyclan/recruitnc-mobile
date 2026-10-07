import { useCallback, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { router, useFocusEffect } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { supabase } from "@/lib/supabase"
import { fetchMyAthletes } from "@/lib/my-athletes"

/**
 * "Create your free profile", at the top of Home and Athletes.
 *
 * Tucked under More, nobody found it - and making a profile is the reason most families download
 * the app. It shows to everyone who might need one: signed out, or signed in with no wrestler
 * linked. College coaches never see it, and neither does anyone whose profile already exists.
 * While that is being worked out it stays hidden, so it never flashes up and then vanishes.
 */
export function CreateProfileCard() {
  const [show, setShow] = useState(false)

  useFocusEffect(
    useCallback(() => {
      let live = true
      void needsProfile().then((yes) => live && setShow(yes))
      return () => {
        live = false
      }
    }, []),
  )

  if (!show) return null
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => router.push("/create-profile" as never)}
      accessibilityRole="button"
      accessibilityLabel="Create your free profile"
    >
      <View style={styles.icon}>
        <Ionicons name="person-add" size={22} color={colors.ink} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Create your free profile</Text>
        <Text style={styles.detail}>College coaches are on RecruitNC. Takes about a minute.</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.ink} />
    </Pressable>
  )
}

async function needsProfile(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession()
    const userId = data.session?.user.id
    if (!userId) return true
    const { data: profile } = await supabase.from("user_profiles").select("profile_type").eq("user_id", userId).maybeSingle()
    if (profile?.profile_type === "college-coach") return false
    const { linked } = await fetchMyAthletes()
    return linked.length === 0
  } catch {
    // Unsure means quiet: a card that is wrong is worse than one that is missing for a moment.
    return false
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
