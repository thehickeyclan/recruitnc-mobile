import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import Ionicons from "@expo/vector-icons/Ionicons"

import { useSession } from "@/lib/auth"
import { fetchMessagingSummary } from "@/lib/coach-messages"
import { colors, radius, space, type } from "@/theme/tokens"

const DISMISS_KEY = "coach-messaging-intro-dismissed"

/**
 * "New: message recruits directly" - once, for a college coach staff have confirmed who has not
 * started a conversation yet. Gone for good once dismissed or after their first message. The
 * same note the website shows on the rankings page and My Recruits.
 */
export function CoachMessagingIntro() {
  const { signedIn } = useSession()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!signedIn) {
      setShow(false)
      return
    }
    let live = true
    void (async () => {
      if (await AsyncStorage.getItem(DISMISS_KEY).catch(() => null)) return
      const m = await fetchMessagingSummary()
      if (live && m.canStart && m.total === 0) setShow(true)
    })()
    return () => {
      live = false
    }
  }, [signedIn])

  if (!show) return null

  const dismiss = () => {
    setShow(false)
    void AsyncStorage.setItem(DISMISS_KEY, "1").catch(() => {})
  }

  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name="mail" size={16} color={colors.ink} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.title}>NEW · MESSAGE RECRUITS DIRECTLY</Text>
        <Text style={styles.body}>
          Open any wrestler and tap Message. The wrestler and their parents see the conversation and can reply, and
          you&apos;ll get an alert here when they do.
        </Text>
      </View>
      <Pressable onPress={dismiss} hitSlop={12} accessibilityLabel="Dismiss">
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    marginHorizontal: space.lg,
    marginBottom: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: "rgba(211,181,116,0.1)",
  },
  icon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  title: { ...type.caption, color: colors.gold },
  body: { ...type.label, color: colors.textSecondary, fontWeight: "500", marginTop: 4 },
})
