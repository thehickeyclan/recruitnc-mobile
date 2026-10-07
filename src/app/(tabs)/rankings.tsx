import { useCallback, useMemo, useState } from "react"
import { CoachMessagingIntro } from "@/components/coach-messaging-intro"
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useFocusEffect } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import Ionicons from "@expo/vector-icons/Ionicons"

import { colors, radius, space, type } from "@/theme/tokens"
import { fetchRankings, type RankedAthlete, type RankingBoard, type RankingsResult } from "@/lib/rankings"

/**
 * The rankings, drawn on the phone rather than borrowed from the website.
 *
 * This tab has been three things. It read `public_rankings` straight from Supabase with the
 * anon key — a key that ships inside every copy of the app, so the paywall did nothing, and
 * nothing kept that table in step with what was published, so it served no 2029 at all and a
 * stale 2027. Then it became a button that opened the website: correct and properly gated, but
 * a browser sitting inside an app, and invisible to anyone whose build was too old to receive
 * the change.
 *
 * Now one authenticated endpoint returns every board, having run the same entitlement check the
 * website runs, and this screen draws it. The member reads the same board the website
 * publishes because both come from the same loaders.
 */

const WEB_BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://app.ncwrestlingunited.com"

export default function RankingsScreen() {
  const [result, setResult] = useState<RankingsResult | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [activeKey, setActiveKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    const next = await fetchRankings()
    setResult(next)
    if (next.state === "ok") {
      // Keep the board they were reading across a refresh; otherwise start at the first.
      setActiveKey((current) =>
        current && next.boards.some((b) => b.key === current) ? current : (next.boards[0]?.key ?? null),
      )
    }
  }, [])

  /*
   * Reload whenever the tab comes back into view, not only on mount.
   *
   * Signing in happens on another screen. With a mount-only fetch, a member who tapped "Sign
   * in" here, signed in, and came back was still looking at the locked screen this screen had
   * rendered before they had an account - which reads exactly like being refused.
   */
  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const board: RankingBoard | null = useMemo(() => {
    if (!result || result.state !== "ok") return null
    return result.boards.find((b) => b.key === activeKey) ?? result.boards[0] ?? null
  }, [result, activeKey])

  if (!result) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centre}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </SafeAreaView>
    )
  }

  if (result.state === "signed-out") {
    return (
      <Message
        icon="lock-closed-outline"
        title="Sign in to see the rankings"
        body="Included with NC United Blue, and free for verified college coaches."
        ctaLabel="Sign in"
        onPress={() => router.push("/sign-in")}
      />
    )
  }

  if (result.state === "locked") {
    return (
      <Message
        icon="trophy-outline"
        title="Rankings"
        body={result.message}
        ctaLabel="See what's included"
        onPress={() => {
          void WebBrowser.openBrowserAsync(`${WEB_BASE.replace(/\/$/, "")}/rankings`, {
            toolbarColor: colors.ink,
            controlsColor: colors.gold,
          })
        }}
      />
    )
  }

  if (result.state === "error") {
    return (
      <Message
        icon="alert-circle-outline"
        title="Couldn't load rankings"
        body={result.message}
        ctaLabel="Try again"
        onPress={() => void load()}
      />
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>RECRUITNC</Text>
        <Text style={styles.title}>Rankings</Text>
      </View>

      <CoachMessagingIntro />

      {/*
        * A plain row, not a horizontal ScrollView.
        *
        * The ScrollView took its height from its content and got it wrong, cropping the digits
        * off "2027" halfway down. Four tabs fit across a phone with room to spare, so the
        * scroller bought nothing and cost the one thing that had to be right.
        */}
      <View style={styles.tabs}>
        {result.boards.map((b) => {
          const active = b.key === board?.key
          return (
            <Pressable
              key={b.key}
              onPress={() => setActiveKey(b.key)}
              style={[styles.tab, active && styles.tabActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{shortTitle(b)}</Text>
            </Pressable>
          )
        })}
      </View>

      <FlatList
        data={board?.athletes ?? []}
        keyExtractor={(a) => a.athleteId}
        renderItem={({ item }) => <Row athlete={item} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
        }
        ListFooterComponent={
          <Text style={styles.footnote}>
            Ranked on results: who they wrestled, how they did against them, and what they have done
            outside this state.
          </Text>
        }
      />
    </SafeAreaView>
  )
}

/** "Class of 2027" is too wide for a phone tab; beside the others the year alone reads fine. */
function shortTitle(board: RankingBoard): string {
  return /^\d{4}$/.test(board.key) ? board.key : `Top ${board.cap}`
}

function Row({ athlete }: { athlete: RankedAthlete }) {
  const meta = [athlete.weightClass ? `${athlete.weightClass} lbs` : null, athlete.highSchool]
    .filter(Boolean)
    .join(" · ")

  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push(`/athlete/${athlete.athleteId}`)}
      accessibilityRole="button"
      accessibilityLabel={`${athlete.name}, ranked ${athlete.rank}`}
    >
      <Text style={styles.rank}>{athlete.rank}</Text>

      {athlete.photoUrl ? (
        <Image source={{ uri: athlete.photoUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarEmpty]}>
          <Text style={styles.initials}>{initials(athlete.name)}</Text>
        </View>
      )}

      <View style={styles.rowBody}>
        <Text style={styles.name} numberOfLines={1}>
          {athlete.name}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {athlete.credentials.length > 0 ? (
          <View style={styles.pills}>
            {athlete.credentials.slice(0, 2).map((c) => (
              <View key={c.kind} style={styles.pill}>
                <Text style={styles.pillText}>{c.label.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {athlete.collegeCommit ? (
          <Text style={styles.commit} numberOfLines={1}>
            Committed · {athlete.collegeCommit}
          </Text>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

function Message({
  icon,
  title,
  body,
  ctaLabel,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  body: string
  ctaLabel: string
  onPress: () => void
}) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.centre}>
        <View style={styles.badge}>
          <Ionicons name={icon} size={28} color={colors.gold} />
        </View>
        <Text style={styles.messageTitle}>{title}</Text>
        <Text style={styles.messageBody}>{body}</Text>
        <Pressable onPress={onPress} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl },

  header: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  eyebrow: { ...type.caption, color: colors.gold },
  title: { ...type.title, color: colors.text, marginTop: 2 },

  /*
   * The row is sized, not squeezed.
   *
   * A horizontal ScrollView takes its height from its content, and with only vertical padding
   * to go on it cropped the descenders off "2027" against the first row of the list. An
   * explicit line height on the label and real breathing room underneath fixes both the
   * clipping and the crowding.
   */
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.md,
    gap: space.sm,
  },
  tab: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  tabActive: { borderColor: colors.gold, backgroundColor: colors.raised },
  tabText: { ...type.label, lineHeight: 18, color: colors.textSecondary },
  tabTextActive: { color: colors.gold },

  list: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rank: { ...type.body, color: colors.gold, fontWeight: "800", width: 30, textAlign: "center" },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface },
  avatarEmpty: { alignItems: "center", justifyContent: "center" },
  initials: { ...type.caption, color: colors.textSecondary },
  rowBody: { flex: 1 },
  name: { ...type.body, color: colors.text, fontWeight: "700" },
  meta: { ...type.label, color: colors.textSecondary, marginTop: 1 },
  commit: { ...type.label, color: colors.gold, marginTop: 2 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  pill: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.raised,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  pillText: { fontSize: 9, fontWeight: "800", color: colors.textSecondary, letterSpacing: 0.4 },

  footnote: {
    ...type.label,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: space.lg,
    paddingHorizontal: space.md,
  },

  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: space.lg,
  },
  messageTitle: { ...type.title, color: colors.text, textAlign: "center" },
  messageBody: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  cta: {
    backgroundColor: colors.gold,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: { ...type.body, color: colors.ink, fontWeight: "800" },
})
