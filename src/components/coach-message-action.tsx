import { useCallback, useState } from "react"
import { Alert, Pressable, StyleSheet, Text } from "react-native"
import { router, useFocusEffect } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"

import { fetchEligibility, type Eligibility } from "@/lib/coach-messages"
import { colors, radius, space, type } from "@/theme/tokens"

/**
 * "Message Gavin" on a wrestler's screen - college coaches only, beside the scouting report.
 *
 * Renders nothing for families and fans (the server decides). A coach staff have not confirmed
 * yet sees it but gets the explanation; once a conversation exists it opens that instead.
 */
export function CoachMessageAction({ athleteId, athleteName }: { athleteId: string; athleteName: string }) {
  const [gate, setGate] = useState<Eligibility | null>(null)

  // Re-asked on return, so after the first message the button reads "Open conversation".
  useFocusEffect(
    useCallback(() => {
      let live = true
      void fetchEligibility(athleteId).then((g) => {
        if (live) setGate(g)
      })
      return () => {
        live = false
      }
    }, [athleteId]),
  )

  if (!gate?.show) return null

  const first = athleteName.trim().split(/\s+/)[0] || "wrestler"
  const onPress = () => {
    if (gate.threadId) {
      router.push(`/messages/${gate.threadId}` as never)
      return
    }
    if (!gate.canSend) {
      Alert.alert("Messaging is not open yet", gate.message ?? "Your coaching account has not been confirmed yet.")
      return
    }
    router.push({ pathname: "/messages/new", params: { athleteId, name: athleteName } } as never)
  }

  return (
    <Pressable style={styles.button} onPress={onPress} accessibilityRole="button">
      <Ionicons name={gate.threadId ? "chatbubbles-outline" : "mail-outline"} size={16} color={colors.gold} />
      <Text style={styles.text}>{gate.threadId ? "OPEN CONVERSATION" : `MESSAGE ${first.toUpperCase()}`}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: "rgba(211,181,116,0.1)",
    borderRadius: radius.md,
    paddingVertical: space.md,
  },
  text: { ...type.label, color: colors.gold, fontWeight: "800" },
})
