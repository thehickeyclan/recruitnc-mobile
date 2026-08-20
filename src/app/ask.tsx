import { useCallback, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Ionicons from "@expo/vector-icons/Ionicons"
import { router } from "expo-router"
import { colors, radius, space, type } from "@/theme/tokens"
import { AnswerText } from "@/components/answer-text"
import { askDataDawg, voteOnAnswer, type ChatTurn } from "@/lib/data-dawg"
import { useSession } from "@/lib/auth"

/** `isError` keeps a failure out of the history we replay — see `send`. */
type Bubble = ChatTurn & { id: string; messageId?: string; vote?: "up" | "down"; isError?: boolean }

/**
 * Every chip is a prompt the website routes to a deterministic handler
 * (`SUGGESTED_PROMPT_ROUTES`), so the questions we put in front of people are the ones that
 * never depend on the model picking the right tool. The previous three went to the LLM.
 */
const SUGGESTIONS = [
  "Who are our 4x state champions?",
  "Show me all class of 2027 rankings",
  "Who is the all-time winningest wrestler?",
]

export default function AskScreen() {
  const { session } = useSession()
  const [messages, setMessages] = useState<Bubble[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const listRef = useRef<FlatList<Bubble>>(null)
  const abortRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setBusy(false)
  }, [])

  const send = useCallback(
    async (text: string) => {
      const question = text.trim()
      if (!question || busy) return

      // A failed request is not something Data Dawg said. Replaying "Network request failed"
      // as an assistant turn told the model it had answered that way, and it answered in kind.
      const history: ChatTurn[] = messages
        .filter((m) => !m.isError)
        .map((m) => ({ role: m.role, content: m.content }))
      const userBubble: Bubble = { id: `u-${Date.now()}`, role: "user", content: question }

      setMessages((prev) => [...prev, userBubble])
      setInput("")
      setBusy(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const reply = await askDataDawg(question, history, {
          accessToken: session?.access_token,
          signal: controller.signal,
        })
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: "assistant", content: reply.answer, messageId: reply.messageId },
        ])
      } catch (e) {
        // A cancel is the user's own doing — no need to report it back to them.
        if (controller.signal.aborted) return
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            isError: true,
            content: e instanceof Error ? e.message : "Something went wrong.",
          },
        ])
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        setBusy(false)
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
      }
    },
    [busy, messages, session?.access_token],
  )

  const vote = useCallback(
    (bubble: Bubble, choice: "up" | "down") => {
      if (!bubble.messageId) return
      setMessages((prev) => prev.map((m) => (m.id === bubble.id ? { ...m, vote: choice } : m)))
      void voteOnAnswer(bubble.messageId, choice, session?.access_token)
    },
    [session?.access_token],
  )

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.flexShrink}>
            <Text style={styles.title} maxFontSizeMultiplier={1.4}>Data Dawg</Text>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={colors.textMuted} />
          </Pressable>
        </View>
        <Text style={styles.subtitle}>Ask about commitments, rankings and results</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        {messages.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={36} color={colors.line} />
            <Text style={styles.emptyText}>Try one of these</Text>
            {SUGGESTIONS.map((s) => (
              <Pressable key={s} style={styles.suggestion} onPress={() => void send(s)}>
                <Text style={styles.suggestionText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) =>
              item.role === "user" ? (
                <View style={styles.userBubble}>
                  <Text style={styles.userText}>{item.content}</Text>
                </View>
              ) : (
                <View style={styles.answerBubble}>
                  <AnswerText content={item.content} />
                  {item.messageId ? (
                    <View style={styles.voteRow}>
                      <Pressable onPress={() => vote(item, "up")} hitSlop={8}>
                        <Ionicons
                          name={item.vote === "up" ? "thumbs-up" : "thumbs-up-outline"}
                          size={15}
                          color={item.vote === "up" ? colors.gold : colors.textMuted}
                        />
                      </Pressable>
                      <Pressable onPress={() => vote(item, "down")} hitSlop={8}>
                        <Ionicons
                          name={item.vote === "down" ? "thumbs-down" : "thumbs-down-outline"}
                          size={15}
                          color={item.vote === "down" ? colors.red : colors.textMuted}
                        />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              )
            }
          />
        )}

        {busy ? (
          <View style={styles.thinking}>
            <ActivityIndicator color={colors.gold} size="small" />
            <Text style={styles.thinkingText}>Data Dawg is digging…</Text>
            <Pressable onPress={cancel} hitSlop={10} accessibilityLabel="Stop this question">
              <Text style={styles.cancelText}>Stop</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about NC wrestling…"
            placeholderTextColor={colors.textMuted}
            multiline
            onSubmitEditing={() => void send(input)}
          />
          <Pressable
            style={[styles.sendButton, (!input.trim() || busy) && styles.sendDisabled]}
            onPress={() => void send(input)}
            disabled={!input.trim() || busy}
          >
            <Ionicons name="arrow-up" size={19} color={colors.ink} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  flexShrink: { flexShrink: 1 },
  title: { ...type.display, color: colors.text },
  subtitle: { ...type.body, color: colors.textSecondary, marginTop: space.xs },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, paddingHorizontal: space.lg },
  emptyText: { ...type.label, color: colors.textMuted },
  suggestion: {
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  suggestionText: { ...type.label, color: colors.textSecondary },
  list: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  userText: { ...type.body, color: colors.ink, fontWeight: "600" },
  answerBubble: {
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: space.md,
  },
  voteRow: { flexDirection: "row", gap: space.lg, marginTop: space.md },
  thinking: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm },
  thinkingText: { ...type.label, color: colors.textMuted },
  cancelText: { ...type.label, color: colors.gold, textDecorationLine: "underline" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.md,
    color: colors.text,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.4 },
})
