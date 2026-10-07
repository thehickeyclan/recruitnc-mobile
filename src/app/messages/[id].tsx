import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useLocalSearchParams } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"

import { useSession } from "@/lib/auth"
import { fetchThread, reportThread, sendReply, setStopped, shortDate, type ThreadDetail } from "@/lib/coach-messages"
import { syncAppBadge } from "@/lib/app-badge"
import { colors, radius, space, type } from "@/theme/tokens"

/**
 * /messages/<id> - one coach ↔ family conversation, and where a message alert lands.
 *
 * The family can reply, report the conversation, or stop the coach (App Store guideline 1.2:
 * report and block). What each viewer may do comes from the server.
 */
export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const threadId = typeof id === "string" && /^[a-z0-9-]+$/i.test(id) ? id : null
  const { signedIn } = useSession()
  const [thread, setThread] = useState<ThreadDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const scroll = useRef<ScrollView>(null)

  const load = useCallback(async () => {
    if (!threadId || !signedIn) return
    try {
      setThread(await fetchThread(threadId))
      setError(null)
      // Reading it marked it read on the server; bring the icon's number down with it.
      void syncAppBadge(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this conversation.")
    }
  }, [threadId, signedIn])

  useEffect(() => {
    void load()
  }, [load])

  const send = async () => {
    if (!threadId || !draft.trim() || busy) return
    setBusy(true)
    try {
      await sendReply(threadId, draft)
      setDraft("")
      await load()
    } catch (e) {
      Alert.alert("Not sent", e instanceof Error ? e.message : "Try again.")
    } finally {
      setBusy(false)
    }
  }

  const toggleStop = () => {
    if (!thread || !threadId) return
    const stopping = !thread.stopped
    const run = async () => {
      setBusy(true)
      try {
        await setStopped(threadId, stopping)
        await load()
      } catch (e) {
        Alert.alert("Could not update", e instanceof Error ? e.message : "Try again.")
      } finally {
        setBusy(false)
      }
    }
    if (!stopping) return void run()
    Alert.alert(
      `Stop messages from ${thread.coachName}?`,
      `They won't be able to message ${thread.athleteName || "your wrestler"} again unless you turn this back on.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Stop messages", style: "destructive", onPress: () => void run() },
      ],
    )
  }

  const report = () => {
    if (!threadId) return
    const file = async (reason: string) => {
      try {
        await reportThread(threadId, reason)
        Alert.alert("Reported", "NC United staff will review this conversation within 24 hours.")
      } catch (e) {
        Alert.alert("Could not report", e instanceof Error ? e.message : "Email info@ncwrestlingunited.com.")
      }
    }
    Alert.alert("Report this conversation?", "NC United staff read it and act within 24 hours.", [
      { text: "Cancel", style: "cancel" },
      { text: "Inappropriate", onPress: () => void file("Inappropriate") },
      { text: "Spam or not a real coach", onPress: () => void file("Spam or not a real coach") },
      { text: "Something else", onPress: () => void file("Other") },
    ])
  }

  const family = thread?.viewerRole === "athlete" || thread?.viewerRole === "parent"
  const title = thread ? (thread.viewerRole === "coach" ? thread.athleteName || "Wrestler" : thread.coachName) : "Messages"
  const subtitle = thread
    ? thread.viewerRole === "coach"
      ? "The wrestler and their linked parents see this conversation."
      : `${thread.program ? `${thread.program} · ` : ""}About ${thread.athleteName || "your wrestler"}. Everyone linked to the profile sees this.`
    : null

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/messages" as never))}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {family ? (
          <Pressable accessibilityLabel="Report" onPress={report} style={styles.back} hitSlop={8}>
            <Ionicons name="flag-outline" size={18} color={colors.text} />
          </Pressable>
        ) : null}
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={8}>
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.content}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
        >
          {!signedIn ? (
            <>
              <Text style={styles.muted}>Sign in to read this message.</Text>
              <Pressable style={styles.primary} onPress={() => router.push("/sign-in")}>
                <Text style={styles.primaryText}>Sign in</Text>
              </Pressable>
            </>
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : !thread ? (
            <ActivityIndicator color={colors.gold} />
          ) : (
            <>
              {thread.messages.map((m) => (
                <View key={m.id} style={[styles.msgWrap, m.mine ? styles.mineWrap : null]}>
                  <View style={[styles.bubble, m.mine ? styles.mine : styles.theirs]}>
                    <Text style={[styles.body, m.mine ? styles.mineText : null]}>{m.body}</Text>
                  </View>
                  <Text style={styles.meta}>
                    {m.mine ? "You" : m.senderName} · {shortDate(m.createdAt)}
                  </Text>
                </View>
              ))}
              {family ? (
                <Pressable onPress={toggleStop} disabled={busy} style={styles.stop}>
                  <Ionicons name={thread.stopped ? "shield-checkmark-outline" : "hand-left-outline"} size={16} color={colors.textSecondary} />
                  <Text style={styles.stopText}>{thread.stopped ? "Allow this coach to message again" : "Stop messages from this coach"}</Text>
                </Pressable>
              ) : null}
              {thread.stopped && thread.viewerRole === "coach" ? (
                <Text style={styles.muted}>This family has turned off messages from you.</Text>
              ) : null}
            </>
          )}
        </ScrollView>

        {thread?.canReply ? (
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              placeholder="Write a reply…"
              placeholderTextColor={colors.textMuted}
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={4000}
            />
            <Pressable
              accessibilityLabel="Send"
              onPress={() => void send()}
              disabled={!draft.trim() || busy}
              style={[styles.send, !draft.trim() || busy ? styles.sendOff : null]}
            >
              {busy ? <ActivityIndicator color={colors.ink} /> : <Ionicons name="arrow-up" size={20} color={colors.ink} />}
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  back: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surface },
  flex: { flex: 1 },
  title: { ...type.heading, color: colors.text },
  subtitle: { ...type.label, color: colors.textMuted, fontWeight: "500", marginTop: 2 },
  content: { padding: space.lg, paddingBottom: space.xl, gap: space.md },
  muted: { ...type.label, color: colors.textMuted, fontWeight: "500" },
  error: { ...type.label, color: colors.red },
  primary: { backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: space.md, alignItems: "center" },
  primaryText: { ...type.body, color: colors.ink, fontWeight: "700" },
  msgWrap: { alignItems: "flex-start", maxWidth: "100%" },
  mineWrap: { alignItems: "flex-end" },
  bubble: { maxWidth: "86%", borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.sm + 2 },
  theirs: { backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line },
  mine: { backgroundColor: colors.gold },
  body: { ...type.body, color: colors.text, lineHeight: 21 },
  mineText: { color: colors.ink },
  meta: { ...type.label, color: colors.textMuted, fontWeight: "500", marginTop: 4, paddingHorizontal: 4 },
  stop: { flexDirection: "row", alignItems: "center", gap: space.xs, alignSelf: "center", paddingVertical: space.md },
  stopText: { ...type.label, color: colors.textSecondary },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.ink,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingTop: space.sm + 2,
    paddingBottom: space.sm + 2,
    color: colors.text,
    ...type.body,
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  sendOff: { opacity: 0.4 },
})
