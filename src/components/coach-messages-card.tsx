import { useCallback, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { router, useFocusEffect } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"

import { fetchThreads, shortDate, type ThreadSummary } from "@/lib/coach-messages"
import { colors, radius, space, type } from "@/theme/tokens"

/**
 * "Coaches who've reached out" on the wrestler's own screen - for the wrestler and linked parents.
 *
 * Families manage messages from their wrestler's profile rather than a separate inbox: each row
 * opens the conversation. Renders nothing until a coach has written, and nothing for anyone the
 * server does not count as family (a coach's own thread is filtered out).
 */
export function CoachMessagesCard({ athleteId }: { athleteId: string }) {
  const [threads, setThreads] = useState<ThreadSummary[]>([])

  useFocusEffect(
    useCallback(() => {
      let live = true
      fetchThreads(athleteId)
        .then((all) => {
          if (live) setThreads(all.filter((t) => t.viewerRole !== "coach"))
        })
        .catch(() => {})
      return () => {
        live = false
      }
    }, [athleteId]),
  )

  if (threads.length === 0) return null

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="chatbubbles-outline" size={16} color={colors.gold} />
        <Text style={styles.heading}>COACHES WHO&apos;VE REACHED OUT</Text>
      </View>
      {threads.map((t, i) => (
        <Pressable
          key={t.id}
          style={[styles.row, i > 0 ? styles.divider : null]}
          onPress={() => router.push(`/messages/${t.id}` as never)}
        >
          <View style={styles.flex}>
            <View style={styles.rowTop}>
              <Text style={[styles.name, t.unread ? styles.nameUnread : null]} numberOfLines={1}>
                {t.coachName}
              </Text>
              {t.unread ? (
                <Text style={styles.newPill}>NEW</Text>
              ) : t.yourTurn ? (
                <Text style={styles.turnPill}>REPLY</Text>
              ) : null}
              <Text style={styles.date}>{shortDate(t.lastMessageAt)}</Text>
            </View>
            {t.program ? <Text style={styles.program}>{t.program}</Text> : null}
            <Text style={styles.preview} numberOfLines={1}>
              {t.stopped ? "Messages stopped · " : ""}
              {t.lastMessagePreview}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.xs },
  heading: { ...type.caption, color: colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  flex: { flex: 1 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { ...type.body, color: colors.textSecondary, fontWeight: "600", flexShrink: 1 },
  nameUnread: { color: colors.text, fontWeight: "800" },
  newPill: { ...type.caption, fontSize: 10, color: colors.ink, backgroundColor: colors.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  turnPill: { ...type.caption, fontSize: 10, color: colors.gold, borderWidth: 1, borderColor: colors.gold, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, overflow: "hidden" },
  date: { ...type.label, color: colors.textMuted, fontWeight: "500", marginLeft: "auto" },
  program: { ...type.label, color: colors.gold, marginTop: 2 },
  preview: { ...type.label, color: colors.textMuted, fontWeight: "500", marginTop: 2 },
})
