import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"

import { colors, radius, space, type } from "@/theme/tokens"

/**
 * Every North Carolina wrestler, searchable, with the filters a coach sorts by.
 *
 * The app could only reach a profile through the rankings, the commits list or a name search
 * buried in More — so a wrestler who was not ranked was effectively unreachable, which is most
 * of them. The credential filters read linked results rather than matching on names, which only
 * became honest after the result links were backfilled: before that a state-champion filter
 * would have returned a fraction of them and looked authoritative doing it.
 */

const API = "/api/mobile/v1/athletes"

type Athlete = {
  id: string
  name: string
  graduationYear: number | null
  highSchool: string | null
  club: string | null
  weightClass: string | null
  claimed: boolean
  /** The server says whether this viewer may open this wrestler's report. */
  scoutingReport?: boolean
}

const CREDS = [
  { key: "state_champ", label: "State champ" },
  { key: "state_placer", label: "State placer" },
  { key: "toc_champ", label: "TOC champ" },
  { key: "toc_placer", label: "TOC placer" },
  { key: "all_american", label: "All-American" },
] as const

const CLASSES = [2027, 2028, 2029, 2030] as const

export default function AthletesScreen() {
  const [q, setQ] = useState("")
  const [gender, setGender] = useState<"" | "Male" | "Female">("")
  const [gradYear, setGradYear] = useState<number | null>(null)
  const [creds, setCreds] = useState<string[]>([])
  const [rows, setRows] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q.trim().length >= 2) params.set("q", q.trim())
      if (gender) params.set("gender", gender)
      if (gradYear) params.set("gradYear", String(gradYear))
      if (creds.length) params.set("cred", creds.join(","))
      const base = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? ""
      const res = await fetch(`${base}${API}?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "Could not load athletes")
      setRows(data.athletes ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load athletes")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [q, gender, gradYear, creds])

  /* Debounced: typing a name should not fire a request per keystroke. */
  useEffect(() => {
    const t = setTimeout(() => void load(), 350)
    return () => clearTimeout(t)
  }, [load])

  const toggleCred = (key: string) =>
    setCreds((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]))

  const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  )

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Athletes</Text>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search by name"
            placeholderTextColor={colors.textMuted}
            style={styles.search}
            autoCorrect={false}
            returnKeyType="search"
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ("")} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowInner}>
        <Chip on={gender === "Male"} label="Boys" onPress={() => setGender(gender === "Male" ? "" : "Male")} />
        <Chip on={gender === "Female"} label="Girls" onPress={() => setGender(gender === "Female" ? "" : "Female")} />
        {CLASSES.map((y) => (
          <Chip key={y} on={gradYear === y} label={`'${String(y).slice(2)}`} onPress={() => setGradYear(gradYear === y ? null : y)} />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowInner}>
        {CREDS.map((c) => (
          <Chip key={c.key} on={creds.includes(c.key)} label={c.label} onPress={() => toggleCred(c.key)} />
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.list}>
        {loading && <ActivityIndicator color={colors.gold} style={{ marginTop: space.lg }} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {!loading && !error && rows.length === 0 && (
          <Text style={styles.empty}>No wrestlers match that. Try fewer filters.</Text>
        )}
        {rows.map((a) => (
          <Pressable key={a.id} style={styles.card} onPress={() => router.push(`/athlete/${a.id}`)}>
            <View style={styles.cardBody}>
              <Text style={styles.cardName}>{a.name}</Text>
              <Text style={styles.cardDetail}>
                {[
                  a.graduationYear ? `Class of ${a.graduationYear}` : null,
                  a.weightClass ? `${a.weightClass} lbs` : null,
                  a.highSchool,
                  a.club,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            {!a.claimed && <Text style={styles.unclaimed}>Unclaimed</Text>}
            {/*
              * A coach opens the report from the list, without visiting the profile first.
              * `scoutingReport` is decided per athlete on the server - the role rules and the
              * availability test both - so this never offers a report the endpoint refuses.
              */}
            {a.scoutingReport ? (
              <Pressable
                hitSlop={8}
                style={styles.reportButton}
                accessibilityLabel={`Scouting report for ${a.name}`}
                onPress={() => router.push({ pathname: "/scouting-report/[id]", params: { id: a.id } })}
              >
                <Ionicons name="document-text" size={18} color={colors.gold} />
              </Pressable>
            ) : null}
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  header: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.xs },
  title: { ...type.display, color: colors.text, marginBottom: space.sm },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    height: 44,
  },
  search: { flex: 1, color: colors.text, fontSize: 16 },
  filterRow: { flexGrow: 0, maxHeight: 48 },
  filterRowInner: { paddingHorizontal: space.md, paddingVertical: space.xs, gap: space.xs },
  chip: {
    paddingHorizontal: space.sm,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    marginRight: space.xs,
  },
  chipOn: { backgroundColor: colors.gold },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  chipTextOn: { color: colors.ink },
  list: { padding: space.md, gap: space.xs, paddingBottom: space.xl },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.sm,
    marginBottom: space.xs,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardName: { ...type.body, fontWeight: "700", color: colors.text },
  cardDetail: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  unclaimed: { ...type.caption, color: colors.gold },
  reportButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  error: { color: "#fca5a5", textAlign: "center", marginTop: space.lg },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: space.lg },
})
