import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { fetchUpcomingEvents, formatTime, type CalendarEvent } from "@/lib/events"

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
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      setEvents(await fetchUpcomingEvents())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the calendar")
    }
  }, [])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>RECRUITNC</Text>
        <Text style={styles.headerTitle}>Calendar</Text>
        {!loading && !error ? (
          <Text style={styles.subtitle}>
            {events.length} upcoming {events.length === 1 ? "event" : "events"}
          </Text>
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
      ) : events.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={40} color={colors.line} />
          <Text style={styles.error}>No upcoming events on the schedule</Text>
        </View>
      ) : (
        <FlatList
          data={events}
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
  subtitle: { ...type.body, color: colors.textSecondary, marginTop: space.xs },
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
