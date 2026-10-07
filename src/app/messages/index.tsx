import { useCallback, useState } from "react"
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useFocusEffect } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"

import { useSession } from "@/lib/auth"
import { fetchThreads, shortDate, threadTitle, type ThreadSummary } from "@/lib/coach-messages"
import { colors, radius, space, type } from "@/theme/tokens"

/**
 * Messages: college coaches who wrote to this family's wrestler (or, for a coach, the wrestlers
 * they wrote to). Only a coach can start a conversation, so there is no compose button here.
 */
export default function MessagesScreen() {
  const { signedIn } = useSession()
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!signedIn) return
    try {
      setThreads(await fetchThreads())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your messages.")
      setThreads((t) => t ?? [])
    }
  }, [signedIn])

  // Reload on return, so a conversation just read loses its unread dot.
  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const refresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>RECRUITING</Text>
          <Text style={styles.title}>Messages</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.gold} />}
      >
        {!signedIn ? (
          <>
            <Text style={styles.muted}>Sign in to read messages from college coaches.</Text>
            <Pressable style={styles.primary} onPress={() => router.push("/sign-in")}>
              <Text style={styles.primaryText}>Sign in</Text>
            </Pressable>
          </>
        ) : threads === null ? (
          <ActivityIndicator color={colors.gold} />
        ) : (
          <>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {threads.length === 0 && !error ? (
              <View style={styles.card}>
                <Ionicons name="chatbubbles-outline" size={28} color={colors.gold} />
                <Text style={styles.cardTitle}>No messages yet</Text>
                <Text style={styles.muted}>
                  When a college coach messages your wrestler, you&apos;ll get an alert on this phone and the conversation
                  shows up here. Link your wrestler under My wrestlers so it reaches you.
                </Text>
              </View>
            ) : null}
            {threads.map((t) => (
              <Pressable key={t.id} style={styles.row} onPress={() => router.push(`/messages/${t.id}` as never)}>
                <View style={[styles.dot, t.unread ? styles.dotOn : null]} />
                <View style={styles.flex}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.name, t.unread ? styles.nameUnread : null]} numberOfLines={1}>
                      {threadTitle(t)}
                    </Text>
                    {t.unread ? <Text style={styles.newPill}>NEW</Text> : t.yourTurn ? <Text style={styles.turnPill}>REPLY</Text> : null}
                    <Text style={styles.date}>{shortDate(t.lastMessageAt)}</Text>
                  </View>
                  {t.viewerRole !== "coach" ? (
                    <Text style={styles.program} numberOfLines={1}>
                      {[t.program, t.viewerRole === "parent" ? `about ${t.athleteName}` : null].filter(Boolean).join(" · ")}
                    </Text>
                  ) : null}
                  <Text style={styles.preview} numberOfLines={2}>
                    {t.stopped ? "Messages stopped · " : ""}
                    {t.lastMessagePreview}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  back: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surface },
  flex: { flex: 1 },
  eyebrow: { ...type.caption, color: colors.gold },
  title: { ...type.title, color: colors.text },
  content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
  muted: { ...type.label, color: colors.textMuted, fontWeight: "500" },
  error: { ...type.label, color: colors.red },
  card: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: space.lg, gap: space.sm, alignItems: "flex-start" },
  cardTitle: { ...type.heading, color: colors.text },
  primary: { backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: space.md, alignItems: "center" },
  primaryText: { ...type.body, color: colors.ink, fontWeight: "700" },
  row: {
    flexDirection: "row",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: space.md,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  dotOn: { backgroundColor: colors.gold },
  rowTop: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  name: { ...type.body, color: colors.textSecondary, fontWeight: "600", flex: 1 },
  nameUnread: { color: colors.text, fontWeight: "800" },
  date: { ...type.label, color: colors.textMuted, fontWeight: "500" },
  newPill: { ...type.caption, fontSize: 10, color: colors.ink, backgroundColor: colors.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  turnPill: { ...type.caption, fontSize: 10, color: colors.gold, borderWidth: 1, borderColor: colors.gold, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, overflow: "hidden" },
  program: { ...type.label, color: colors.gold, marginTop: 2 },
  preview: { ...type.label, color: colors.textMuted, fontWeight: "500", marginTop: 4 },
})
