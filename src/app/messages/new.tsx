import { useState } from "react"
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useLocalSearchParams } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"

import { startConversation } from "@/lib/coach-messages"
import { colors, radius, space, type } from "@/theme/tokens"

/**
 * /messages/new?athleteId=&name= - a college coach's first message to a wrestler.
 *
 * The server holds every rule (confirmed coaches only, a daily cap, a family that stopped this
 * coach); this screen only writes. On send it replaces itself with the conversation.
 */
export default function NewMessageScreen() {
  const { athleteId, name } = useLocalSearchParams<{ athleteId?: string; name?: string }>()
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const wrestler = typeof name === "string" && name ? name : "this wrestler"

  const send = async () => {
    if (typeof athleteId !== "string" || !draft.trim() || busy) return
    setBusy(true)
    try {
      const threadId = await startConversation(athleteId, draft)
      router.replace(`/messages/${threadId}` as never)
    } catch (e) {
      Alert.alert("Not sent", e instanceof Error ? e.message : "Try again.")
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>NEW MESSAGE</Text>
          <Text style={styles.title} numberOfLines={1}>
            {wrestler}
          </Text>
        </View>
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={8}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.note}>
            {wrestler} and every parent linked to the profile see this conversation and can reply. NC United staff can
            review conversations.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Introduce yourself and your program…"
            placeholderTextColor={colors.textMuted}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={4000}
            autoFocus
          />
          <Pressable style={[styles.send, !draft.trim() || busy ? styles.sendOff : null]} onPress={() => void send()} disabled={!draft.trim() || busy}>
            {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.sendText}>Send</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
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
  content: { padding: space.lg, gap: space.md },
  note: { ...type.label, color: colors.textMuted, fontWeight: "500" },
  input: {
    minHeight: 180,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
    color: colors.text,
    textAlignVertical: "top",
    ...type.body,
  },
  send: { backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: space.md, alignItems: "center" },
  sendOff: { opacity: 0.4 },
  sendText: { ...type.body, color: colors.ink, fontWeight: "800" },
})
