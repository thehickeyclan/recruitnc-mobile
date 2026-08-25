import { useEffect, useState } from "react"
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { fetchTocField, type TocField } from "@/lib/toc-field"
import { fetchCommits, type Commit } from "@/lib/commits"
import { fetchUpcomingEvents, formatTime, type CalendarEvent } from "@/lib/events"
import { TocMadnessCard } from "@/components/toc-madness-card"

/**
 * Home — what is happening right now, in the order it matters.
 *
 * The app used to open on the Tournament of Champions itself, which reads oddly for anyone who
 * came for recruiting and lands inside a bracket, and reads worse the day after the tournament
 * ends. So the tournament is the top card here instead: loudest thing on the screen while it is
 * live, gone in September, with a home page still underneath it.
 */

const WEB = process.env.EXPO_PUBLIC_WEB_BASE_URL

function openWeb(url: string) {
  void WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    toolbarColor: colors.ink,
    controlsColor: colors.gold,
    dismissButtonStyle: "done",
  }).catch(() => undefined)
}

/** "2026-09-18" → "18 Sep" */
function shortDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short" })
}

function SectionHeader({ title, action, onPress }: { title: string; action: string; onPress: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable onPress={onPress} hitSlop={8}>
        <Text style={styles.sectionAction}>{action}</Text>
      </Pressable>
    </View>
  )
}

function CommitRow({ commit }: { commit: Commit }) {
  return (
    <Pressable style={styles.row} onPress={() => router.push("/commits")}>
      {commit.collegeLogoUrl ? (
        <Image source={{ uri: commit.collegeLogoUrl }} style={styles.logo} resizeMode="contain" />
      ) : (
        <View style={[styles.logo, styles.logoEmpty]}>
          <Ionicons name="school" size={16} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.flex}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {commit.name}
        </Text>
        <Text style={styles.rowDetail} numberOfLines={1}>
          {commit.college}
          {commit.weightclass ? ` · ${commit.weightclass}` : ""}
        </Text>
      </View>
    </Pressable>
  )
}

function EventRow({ event }: { event: CalendarEvent }) {
  const time = formatTime(event.startTime)
  return (
    <Pressable style={styles.row} onPress={() => router.push("/calendar")}>
      <View style={[styles.date, { borderColor: event.accent }]}>
        <Text style={styles.dateText}>{shortDate(event.startDate)}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.rowDetail} numberOfLines={1}>
          {[event.categoryLabel, time, event.location].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </Pressable>
  )
}

export default function HomeScreen() {
  const [field, setField] = useState<TocField | null>(null)
  const [commits, setCommits] = useState<Commit[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])

  useEffect(() => {
    // Each section fills in on its own. One slow call should not hold up the rest of the page.
    void fetchTocField().then(setField).catch(() => undefined)
    void fetchCommits(3).then((r) => setCommits(r.commits.slice(0, 3))).catch(() => undefined)
    void fetchUpcomingEvents().then((r) => setEvents(r.slice(0, 3))).catch(() => undefined)
  }, [])

  const announced = field?.tiles.filter((t) => t.announced).length ?? 0
  const total = field?.tiles.length ?? 0

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <Image
            source={require("../../../assets/images/nc-united-logo-white-source.png")}
            style={styles.brand}
            resizeMode="contain"
          />
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>NC WRESTLING UNITED</Text>
            <Text style={styles.title}>North Carolina wrestling, all of it</Text>
          </View>
        </View>

        <TocMadnessCard
          announced={announced}
          total={total}
          onOpenToc={() => router.push("/toc")}
          onStartBracket={() => router.push("/toc-bracket")}
        />

        {events.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Coming up" action="Calendar" onPress={() => router.push("/calendar")} />
            <View style={styles.group}>
              {events.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </View>
          </View>
        ) : null}

        {commits.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Latest commitments" action="All" onPress={() => router.push("/commits")} />
            <View style={styles.group}>
              {commits.map((commit) => (
                <CommitRow key={commit.id} commit={commit} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Around the state" action="News" onPress={() => openWeb(`${WEB}/news`)} />
          <View style={styles.group}>
            <Pressable style={styles.row} onPress={() => openWeb(`${WEB}/news`)}>
              <View style={[styles.logo, styles.logoEmpty]}>
                <Ionicons name="newspaper" size={16} color={colors.gold} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>United Ascent</Text>
                <Text style={styles.rowDetail}>The newspaper, and everything else we write</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
            <Pressable style={styles.row} onPress={() => router.push("/rankings")}>
              <View style={[styles.logo, styles.logoEmpty]}>
                <Ionicons name="podium" size={16} color={colors.gold} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>Rankings</Text>
                <Text style={styles.rowDetail}>Where every class stands</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
            <Pressable style={styles.row} onPress={() => router.push("/clubs")}>
              <View style={[styles.logo, styles.logoEmpty]}>
                <Ionicons name="location" size={16} color={colors.gold} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>Find a club</Text>
                <Text style={styles.rowDetail}>Every club in North Carolina, on a map</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.lg, paddingBottom: space.xxl * 3, gap: space.md },
  flex: { flex: 1 },

  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  brand: { width: 44, height: 44 },
  eyebrow: { ...type.caption, color: colors.gold },
  title: { ...type.title, color: colors.text, marginTop: 2 },

  section: { gap: space.sm },
  sectionHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  sectionTitle: { ...type.heading, color: colors.text },
  sectionAction: { ...type.label, color: colors.gold },

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
  rowTitle: { ...type.label, color: colors.text, fontWeight: "700" },
  rowDetail: { ...type.caption, color: colors.textMuted, marginTop: 2, fontWeight: "600", letterSpacing: 0.2 },

  logo: { width: 34, height: 34, borderRadius: radius.sm },
  logoEmpty: { backgroundColor: colors.raised, alignItems: "center", justifyContent: "center" },

  date: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    backgroundColor: colors.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  dateText: { fontSize: 10, fontWeight: "800", color: colors.text, textAlign: "center" },
})
