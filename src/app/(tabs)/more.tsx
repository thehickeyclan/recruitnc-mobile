import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import AsyncStorage from "@react-native-async-storage/async-storage"
import * as WebBrowser from "expo-web-browser"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { router } from "expo-router"
import { DEFAULT_PREFS, PushUnavailableError, registerForPush, syncDevice, type AlertPrefs } from "@/lib/push"
import { deleteAccount, signOut, useSession } from "@/lib/auth"

const PREFS_KEY = "recruitnc.alertPrefs"
const WEB = process.env.EXPO_PUBLIC_WEB_BASE_URL

const ALERTS: { key: keyof AlertPrefs; title: string; detail: string }[] = [
  { key: "commits", title: "New commitments", detail: "When a North Carolina wrestler commits to a college" },
  { key: "rankings", title: "Ranking updates", detail: "When a new class ranking is published" },
  { key: "news", title: "News", detail: "Every new article as it goes up" },
  {
    key: "toc",
    title: "Tournament of Champions",
    detail: "The moment a weight class field is released",
  },
  { key: "events", title: "Calendar reminders", detail: "The day before practices and events" },
]

export default function MoreScreen() {
  const { session, signedIn } = useSession()
  const [prefs, setPrefs] = useState<AlertPrefs>(DEFAULT_PREFS)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void AsyncStorage.getItem(PREFS_KEY).then((raw) => {
      if (!raw) return
      try {
        const saved = JSON.parse(raw) as { prefs: AlertPrefs; enabled: boolean }
        setPrefs(saved.prefs ?? DEFAULT_PREFS)
        setEnabled(Boolean(saved.enabled))
      } catch {
        // stored value unreadable — fall back to defaults
      }
    })
  }, [])

  const persist = useCallback(async (next: AlertPrefs, on: boolean) => {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ prefs: next, enabled: on }))
  }, [])

  const enable = useCallback(async () => {
    setBusy(true)
    setNotice(null)
    try {
      const token = await registerForPush()
      await syncDevice(token, prefs)
      setEnabled(true)
      await persist(prefs, true)
      setNotice("Alerts are on for this device.")
    } catch (e) {
      setEnabled(false)
      setNotice(
        e instanceof PushUnavailableError || e instanceof Error
          ? e.message
          : "Could not turn on alerts.",
      )
    } finally {
      setBusy(false)
    }
  }, [prefs, persist])

  const toggle = useCallback(
    async (key: keyof AlertPrefs, value: boolean) => {
      const next = { ...prefs, [key]: value }
      setPrefs(next)
      await persist(next, enabled)
      if (!enabled) return
      try {
        const token = await registerForPush()
        await syncDevice(token, next)
      } catch {
        setNotice("Saved on this device, but we could not reach the server to update it.")
      }
    },
    [prefs, enabled, persist],
  )

  function confirmDelete() {
    // Apple requires deletion to be reachable in the app; the confirmation is ours, because it
    // is irreversible and one careless tap should not end an account.
    Alert.alert(
      "Delete account?",
      "This permanently deletes your NC United account. Commitments and rankings stay published — they are sports records, not account data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteAccount()
              .then(() => setNotice("Your account has been deleted."))
              .catch((e) => setNotice(e instanceof Error ? e.message : "Could not delete your account."))
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>NC UNITED</Text>
          <Text style={styles.title} maxFontSizeMultiplier={1.4}>More</Text>
        </View>

        <Text style={styles.sectionHeading}>ACCOUNT</Text>
        {signedIn ? (
          <View style={styles.group}>
            <View style={styles.row}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>Signed in</Text>
                <Text style={styles.rowDetail}>{session?.user?.email ?? ""}</Text>
              </View>
            </View>
            <Pressable style={[styles.row, styles.rowDivider]} onPress={() => void signOut()}>
              <Text style={styles.linkTitle}>Sign out</Text>
              <Ionicons name="log-out-outline" size={16} color={colors.textMuted} />
            </Pressable>
            <Pressable style={[styles.row, styles.rowDivider]} onPress={confirmDelete}>
              <Text style={[styles.linkTitle, styles.destructive]}>Delete account</Text>
              <Ionicons name="trash-outline" size={16} color={colors.red} />
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.enableCard} onPress={() => router.push("/sign-in")}>
            <Ionicons name="person-circle" size={17} color={colors.ink} />
            <Text style={styles.enableText}>Sign in or create an account</Text>
          </Pressable>
        )}

        <Text style={styles.sectionHeading}>TOURNAMENT OF CHAMPIONS</Text>
        <View style={styles.group}>
          <Pressable style={styles.row} onPress={() => router.push("/toc-field")}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>The Field</Text>
              <Text style={styles.rowDetail}>Announced wrestlers, by weight class</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
          <View style={styles.rowDivider} />
          <Pressable style={styles.row} onPress={() => router.push("/toc-bracket")}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Your Bracket</Text>
              <Text style={styles.rowDetail}>Seed the field yourself and see the draw</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.sectionHeading}>FIND A CLUB</Text>
        <View style={styles.group}>
          <Pressable style={styles.row} onPress={() => router.push("/clubs")}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Club finder</Text>
              <Text style={styles.rowDetail}>Every North Carolina club, on a map</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.sectionHeading}>ALERTS</Text>

        {!enabled ? (
          <Pressable style={styles.enableCard} onPress={() => void enable()} disabled={busy}>
            {busy ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <>
                <Ionicons name="notifications" size={17} color={colors.ink} />
                <Text style={styles.enableText}>Turn on alerts</Text>
              </>
            )}
          </Pressable>
        ) : (
          <View style={styles.statusCard}>
            <Ionicons name="checkmark-circle" size={17} color={colors.success} />
            <Text style={styles.statusText}>Alerts are on for this device</Text>
          </View>
        )}

        <View style={styles.group}>
          {ALERTS.map((alert, i) => (
            <View key={alert.key} style={[styles.row, i > 0 && styles.rowDivider]}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{alert.title}</Text>
                <Text style={styles.rowDetail}>{alert.detail}</Text>
              </View>
              <Switch
                value={prefs[alert.key]}
                onValueChange={(v) => void toggle(alert.key, v)}
                trackColor={{ false: colors.line, true: colors.gold }}
                thumbColor={colors.text}
                ios_backgroundColor={colors.line}
              />
            </View>
          ))}
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <Text style={styles.sectionHeading}>NC UNITED</Text>
        <View style={styles.group}>
          <Pressable style={styles.row} onPress={() => void WebBrowser.openBrowserAsync(`${WEB}/news`)}>
            <Text style={styles.linkTitle}>News</Text>
            <Ionicons name="open-outline" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={[styles.row, styles.rowDivider]}
            onPress={() => void WebBrowser.openBrowserAsync(`${WEB}/athletes`)}
          >
            <Text style={styles.linkTitle}>Open the full site</Text>
            <Ionicons name="open-outline" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable
            style={[styles.row, styles.rowDivider]}
            onPress={() => void Linking.openSettings()}
          >
            <Text style={styles.linkTitle}>iOS notification settings</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  header: { paddingTop: space.sm, paddingBottom: space.lg },
  eyebrow: { ...type.caption, color: colors.gold, marginBottom: space.xs },
  title: { ...type.display, color: colors.text },
  sectionHeading: { ...type.caption, color: colors.textMuted, marginTop: space.lg, marginBottom: space.sm },
  enableCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: space.lg,
  },
  enableText: { ...type.heading, color: colors.ink },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
  },
  statusText: { ...type.label, color: colors.textSecondary },
  group: {
    backgroundColor: colors.raised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: space.md,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    padding: space.md,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...type.body, color: colors.text, fontWeight: "600" },
  rowDetail: { ...type.label, color: colors.textMuted, fontWeight: "500" },
  linkTitle: { ...type.body, color: colors.text, fontWeight: "600" },
  destructive: { color: colors.red },
  notice: { ...type.label, color: colors.textSecondary, fontWeight: "500", marginTop: space.md, lineHeight: 18 },
})
