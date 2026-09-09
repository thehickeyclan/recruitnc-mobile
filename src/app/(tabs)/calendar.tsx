import { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { eventCoversDate, fetchAllEvents, formatTime, type CalendarEvent } from "@/lib/events"
import { useCollegeFollows } from "@/lib/use-college-follows"
import { MonthGrid } from "@/components/month-grid"

function DateBlock({ iso }: { iso: string }) {
  const d = new Date(`${iso}T00:00:00`)
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()
  const day = d.getDate()
  return (
    <View style={styles.dateBlock}>
      <Text style={styles.dateMonth}>{month}</Text>
      <Text style={styles.dateDay}>{day}</Text>
    </View>
  )
}

function EventCard({ event }: { event: CalendarEvent }) {
  const time = formatTime(event.startTime)
  const endTime = formatTime(event.endTime)
  const timeLabel = time ? (endTime ? `${time} – ${endTime}` : time) : null

  return (
    <View style={styles.card}>
      <View style={[styles.accent, { backgroundColor: event.accent }]} />
      <DateBlock iso={event.startDate} />

      <View style={styles.cardBody}>
        <Text style={styles.category}>{event.categoryLabel.toUpperCase()}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>

        {timeLabel ? (
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={13} color={colors.textMuted} />
            <Text style={styles.meta}>{timeLabel}</Text>
          </View>
        ) : null}

        {event.location ? (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={colors.textMuted} />
            <Text style={styles.meta} numberOfLines={1}>
              {event.location}
            </Text>
          </View>
        ) : null}

        {event.acceptsDropIn ? (
          <Pressable
            style={styles.dropInButton}
            onPress={() => router.push({ pathname: "/drop-in/[eventId]", params: { eventId: event.id, title: event.title, date: event.startDate } })}
          >
            <Ionicons name="add-circle" size={15} color={colors.ink} />
            <Text style={styles.dropInText}>Drop in</Text>
          </Pressable>
        ) : event.externalLink ? (
          <Pressable
            style={styles.linkButton}
            onPress={() => void WebBrowser.openBrowserAsync(event.externalLink!)}
          >
            <Text style={styles.linkText}>Details</Text>
            <Ionicons name="open-outline" size={13} color={colors.gold} />
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

export default function CalendarScreen() {
  const [ncEvents, setNcEvents] = useState<CalendarEvent[]>([])
  const [teamPickerOpen, setTeamPickerOpen] = useState(false)
  /** Followed college teams. Nothing is drawn until one is chosen. */
  const college = useCollegeFollows()
  // Month is the default here to match the website's calendar, which opens on the grid.
  const [view, setView] = useState<"month" | "list">("month")
  const now = new Date()
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      setNcEvents(await fetchAllEvents())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the calendar")
    }
  }, [])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

  /**
   * NC events plus whatever college teams are followed, in one list.
   *
   * Merged rather than kept in a second tab so a college dual lands on its own square of the
   * month grid, next to everything else happening that day.
   */
  const events = useMemo(
    () => [...ncEvents, ...college.events].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [ncEvents, college.events],
  )

  const upcoming = useMemo(
    () => events.filter((e) => (e.endDate && e.endDate >= e.startDate ? e.endDate : e.startDate) >= todayIso),
    [events, todayIso],
  )

  const dayEvents = useMemo(
    () => (selected ? events.filter((e) => eventCoversDate(e, selected)) : []),
    [events, selected],
  )

  const changeMonth = useCallback((delta: number) => {
    setSelected(null)
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>NC UNITED</Text>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.4}>Calendar</Text>
        {!loading && !error ? (
          <View style={styles.headerRow}>
            <Text style={styles.subtitle}>
              {upcoming.length} upcoming {upcoming.length === 1 ? "event" : "events"}
            </Text>
            <View style={styles.toggle}>
              {(["month", "list"] as const).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setView(v)}
                  style={[styles.toggleButton, view === v && styles.toggleActive]}
                >
                  <Ionicons
                    name={v === "month" ? "grid-outline" : "list-outline"}
                    size={13}
                    color={view === v ? colors.ink : colors.textMuted}
                  />
                  <Text style={[styles.toggleText, view === v && styles.toggleTextActive]}>
                    {v === "month" ? "Month" : "List"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/*
          Following a college team. Collapsed by default and empty until somebody opens it —
          twelve programs at roughly twenty dates each would bury the NC events this calendar
          exists for, so the choice is the whole gate.
        */}
        {!loading && !error && college.ready && college.teams.length ? (
          <View style={styles.collegeBar}>
            <Pressable
              onPress={() => setTeamPickerOpen((open) => !open)}
              accessibilityRole="button"
              style={styles.collegeToggle}
            >
              <Ionicons name="school-outline" size={14} color={colors.textMuted} />
              <Text style={styles.collegeToggleText}>
                {college.followed.length
                  ? `Following ${college.followed.length} college ${college.followed.length === 1 ? "team" : "teams"}`
                  : "Follow a college team"}
              </Text>
              <Ionicons
                name={teamPickerOpen ? "chevron-up" : "chevron-down"}
                size={14}
                color={colors.textMuted}
              />
            </Pressable>

            {teamPickerOpen ? (
              /*
                Scrollable and bounded. This list lived in the fixed header above the calendar, so
                it had no scroll of its own and simply ran off the bottom — twelve programs sorted
                alphabetically meant both UNCs were the ones cut off, and they are the two people
                are most likely to want.
              */
              <ScrollView style={styles.teamList} nestedScrollEnabled contentContainerStyle={styles.teamListContent}>
                {college.teams.map((team) => {
                  const following = college.followed.includes(team.id)
                  return (
                    <Pressable
                      key={team.id}
                      onPress={() => void college.toggle(team.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: following }}
                      style={[styles.teamRow, following && styles.teamRowActive]}
                    >
                      <View style={styles.teamNames}>
                        <Text style={[styles.teamName, following && styles.teamNameActive]}>{team.name}</Text>
                        {team.division ? <Text style={styles.teamDivision}>{team.division}</Text> : null}
                      </View>
                      <Ionicons
                        name={following ? "checkmark-circle" : "add-circle-outline"}
                        size={20}
                        color={following ? colors.gold : colors.textMuted}
                      />
                    </Pressable>
                  )
                })}
              </ScrollView>
            ) : null}

            {college.notice ? (
              <Pressable onPress={() => college.setNotice(null)}>
                <Text style={styles.collegeNotice}>{college.notice}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : view === "month" ? (
        <FlatList
          data={dayEvents}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => <EventCard event={item} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <MonthGrid
              year={cursor.year}
              month={cursor.month}
              events={events}
              selected={selected}
              onSelect={setSelected}
              onChangeMonth={changeMonth}
            />
          }
          ListEmptyComponent={
            <Text style={styles.hint}>
              {selected ? "Nothing scheduled that day" : "Tap a day to see what's on"}
            </Text>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
          }
        />
      ) : upcoming.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={40} color={colors.line} />
          <Text style={styles.error}>No upcoming events on the schedule</Text>
        </View>
      ) : (
        <FlatList
          data={upcoming}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => <EventCard event={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.lg },
  eyebrow: { ...type.caption, color: colors.gold, marginBottom: space.xs },
  headerTitle: { ...type.display, color: colors.text },
  subtitle: { ...type.body, color: colors.textSecondary, flexShrink: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    marginTop: space.xs,
  },
  toggle: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 2,
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  toggleActive: { backgroundColor: colors.gold },
  toggleText: { ...type.caption, color: colors.textMuted, fontSize: 10 },
  toggleTextActive: { color: colors.ink },
  hint: { ...type.label, color: colors.textMuted, textAlign: "center", paddingVertical: space.xl },
  collegeBar: { marginTop: space.md, gap: space.sm },
  collegeToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  collegeToggleText: { ...type.label, color: colors.textSecondary, flex: 1 },
  // Roughly six rows before it scrolls, so the calendar underneath is never pushed off-screen.
  teamList: { maxHeight: 240 },
  teamListContent: { gap: 2, paddingBottom: space.xs },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  teamRowActive: { backgroundColor: colors.surface },
  teamNames: { flex: 1 },
  teamName: { ...type.body, color: colors.textSecondary },
  teamNameActive: { color: colors.text },
  teamDivision: { ...type.caption, color: colors.textMuted },
  collegeNotice: { ...type.caption, color: colors.gold, paddingHorizontal: space.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md },
  error: { ...type.body, color: colors.textSecondary, paddingHorizontal: space.xl, textAlign: "center" },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.md },
  card: {
    flexDirection: "row",
    backgroundColor: colors.raised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  accent: { width: 4 },
  dateBlock: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRightWidth: 1,
    borderRightColor: colors.line,
    minWidth: 64,
  },
  dateMonth: { ...type.caption, color: colors.gold, fontSize: 10 },
  dateDay: { ...type.title, color: colors.text, marginTop: 2 },
  cardBody: { flex: 1, padding: space.md, gap: 4 },
  category: { ...type.caption, color: colors.textMuted, fontSize: 9 },
  title: { ...type.heading, color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  meta: { ...type.label, color: colors.textMuted, fontWeight: "500", flexShrink: 1 },
  dropInButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
  },
  dropInText: { ...type.label, color: colors.ink, fontWeight: "700" },
  linkButton: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: space.sm, alignSelf: "flex-start" },
  linkText: { ...type.label, color: colors.gold },
})
