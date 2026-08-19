import { useMemo } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import { eventCoversDate, type CalendarEvent } from "@/lib/events"

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"]

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

export function MonthGrid({
  year,
  month,
  events,
  selected,
  onSelect,
  onChangeMonth,
}: {
  year: number
  month: number
  events: CalendarEvent[]
  selected: string | null
  onSelect: (iso: string) => void
  onChangeMonth: (delta: number) => void
}) {
  const today = new Date()
  const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate())

  const cells = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const out: (string | null)[] = Array(firstWeekday).fill(null)
    for (let d = 1; d <= daysInMonth; d += 1) out.push(iso(year, month, d))
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [year, month])

  // One pass over events per cell would be O(cells × events); events are few, so this stays cheap.
  const accentsFor = (day: string) => {
    const hits = events.filter((e) => eventCoversDate(e, day))
    return [...new Set(hits.map((e) => e.accent))].slice(0, 3)
  }

  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={() => onChangeMonth(-1)} hitSlop={12} accessibilityLabel="Previous month">
          <Ionicons name="chevron-back" size={20} color={colors.gold} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable onPress={() => onChangeMonth(1)} hitSlop={12} accessibilityLabel="Next month">
          <Ionicons name="chevron-forward" size={20} color={colors.gold} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={styles.cell} />
          const accents = accentsFor(day)
          const isToday = day === todayIso
          const isSelected = day === selected
          return (
            <Pressable
              key={i}
              style={styles.cell}
              onPress={() => onSelect(day)}
              accessibilityLabel={`${day}${accents.length ? `, ${accents.length} events` : ""}`}
            >
              <View style={[styles.dayBubble, isToday && styles.today, isSelected && styles.selected]}>
                <Text
                  style={[
                    styles.dayText,
                    isToday && styles.todayText,
                    isSelected && styles.selectedText,
                  ]}
                >
                  {Number(day.slice(-2))}
                </Text>
              </View>
              <View style={styles.dots}>
                {accents.map((a, j) => (
                  <View key={j} style={[styles.dot, { backgroundColor: a }]} />
                ))}
              </View>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.sm,
  },
  monthLabel: { ...type.heading, color: colors.text },
  weekRow: { flexDirection: "row", marginTop: space.xs },
  weekday: { ...type.caption, color: colors.textMuted, flex: 1, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: space.xs },
  cell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 5 },
  dayBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  today: { borderWidth: 1, borderColor: colors.gold },
  selected: { backgroundColor: colors.gold },
  dayText: { ...type.body, color: colors.textSecondary },
  todayText: { color: colors.gold, fontWeight: "700" },
  selectedText: { color: colors.ink, fontWeight: "700" },
  dots: { flexDirection: "row", gap: 3, height: 6, marginTop: 3 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
})
