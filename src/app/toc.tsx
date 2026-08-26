import { useEffect, useState } from "react"
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { fetchTocField, type TocField } from "@/lib/toc-field"
import { useAlertPrefs } from "@/lib/alert-prefs"
import { TocMadness } from "@/components/toc-madness"

/**
 * The Tournament of Champions hub — everything about the event in one place.
 *
 * Reached from the card at the top of Home rather than owning a tab. The tournament is the
 * loudest thing in the app until 19 September and nothing at all after it, which is a card's
 * job, not a permanent tab's.
 */

const WEB = process.env.EXPO_PUBLIC_WEB_BASE_URL
const TOC_WEB = `${WEB}/tournament-of-champions`

function openWeb(url: string) {
  void WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    toolbarColor: colors.ink,
    controlsColor: colors.gold,
    dismissButtonStyle: "done",
  }).catch(() => undefined)
}

function Row({
  icon,
  title,
  detail,
  onPress,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  detail: string
  onPress: () => void
  accent?: boolean
}) {
  return (
    <Pressable style={[styles.row, accent && styles.rowAccent]} onPress={onPress}>
      <View style={[styles.rowIcon, accent && styles.rowIconAccent]}>
        <Ionicons name={icon} size={18} color={accent ? colors.ink : colors.gold} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, accent && styles.rowTitleAccent]}>{title}</Text>
        <Text style={[styles.rowDetail, accent && styles.rowDetailAccent]}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={accent ? colors.ink : colors.textMuted} />
    </Pressable>
  )
}

export default function TocHubScreen() {
  const [field, setField] = useState<TocField | null>(null)
  const { prefs, enabled, busy, notice, enable, toggle } = useAlertPrefs()

  useEffect(() => {
    void fetchTocField()
      .then(setField)
      .catch(() => undefined)
  }, [])

  const announced = field?.tiles.filter((t) => t.announced).length ?? 0
  const total = field?.tiles.length ?? 0
  const fieldDetail =
    total > 0
      ? announced === total
        ? "Every weight class announced"
        : `${announced} of ${total} weight classes announced`
      : "Announced wrestlers, weight by weight"

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
          <Text style={styles.backText}>Home</Text>
        </Pressable>

        <View style={styles.head}>
          <Image
            source={require("../../assets/images/toc-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>SEPTEMBER 18–19, 2026</Text>
            <Text style={styles.title}>Tournament of Champions</Text>
            <Text style={styles.subtitle}>Hope Community Church · Apex</Text>
          </View>
        </View>

        <TocMadness onStart={() => router.push("/toc-bracket")} />

        <View style={styles.group}>
          <Row
            icon="people"
            title="The Field"
            detail={fieldDetail}
            onPress={() => router.push("/toc-field")}
          />
          <Row
            icon="git-branch"
            title="Your Bracket"
            detail="Seed it yourself and run the draw"
            onPress={() => router.push("/toc-bracket")}
          />
          <Row
            icon="podium"
            title="Leaderboard"
            detail="How every entry is scoring"
            onPress={() => router.push("/toc-leaderboard")}
          />
        </View>

        <Text style={styles.groupLabel}>THE EVENT</Text>
        <View style={styles.group}>
          <Row
            icon="ticket"
            title="Tickets"
            detail="Seating is limited — families first"
            onPress={() => openWeb(TOC_WEB)}
          />
          <Row
            icon="information-circle"
            title="Schedule, venue and FAQ"
            detail="Weigh-ins, timing and what to expect"
            onPress={() => openWeb(TOC_WEB)}
          />
        </View>

        <Text style={styles.groupLabel}>ALERTS</Text>
        <View style={styles.group}>
          {enabled ? (
            <View style={styles.toggleRow}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>Weight class releases</Text>
                <Text style={styles.rowDetail}>The moment a field goes live</Text>
              </View>
              <Switch
                value={prefs.toc}
                onValueChange={(v) => void toggle("toc", v)}
                trackColor={{ true: colors.gold, false: colors.line }}
                thumbColor={colors.text}
              />
            </View>
          ) : (
            <Pressable style={styles.enable} onPress={() => void enable()} disabled={busy}>
              <Ionicons name="notifications" size={16} color={colors.ink} />
              <Text style={styles.enableText}>
                {busy ? "Turning on…" : "Know the moment a weight class drops"}
              </Text>
            </Pressable>
          )}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.lg, paddingBottom: space.xxl * 2, gap: space.md },
  flex: { flex: 1 },

  back: { flexDirection: "row", alignItems: "center", gap: 2, marginBottom: space.xs },
  backText: { ...type.label, color: colors.textSecondary },

  head: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.sm },
  logo: { width: 64, height: 64 },
  eyebrow: { ...type.caption, color: colors.gold },
  title: { ...type.heading, color: colors.text, marginTop: 2 },
  subtitle: { ...type.label, color: colors.textMuted, marginTop: 2 },

  groupLabel: { ...type.caption, color: colors.textMuted, marginTop: space.md },
  group: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowAccent: { backgroundColor: colors.gold, borderBottomWidth: 0 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconAccent: { backgroundColor: "rgba(10, 22, 40, 0.12)" },
  rowTitle: { ...type.label, color: colors.text, fontWeight: "700" },
  rowTitleAccent: { color: colors.ink },
  rowDetail: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  rowDetailAccent: { color: colors.ink, opacity: 0.75 },

  toggleRow: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md },
  enable: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: colors.gold,
    padding: space.md,
  },
  enableText: { ...type.label, color: colors.ink, fontWeight: "700" },
  notice: { ...type.caption, color: colors.textSecondary, padding: space.md, paddingTop: 0 },
})
