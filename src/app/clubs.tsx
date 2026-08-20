import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { AppleMaps } from "expo-maps"
import * as Location from "expo-location"
import { router } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { colors, radius, space, type } from "@/theme/tokens"
import {
  directionsUrl,
  distanceMiles,
  fetchClubs,
  fitCamera,
  type ClubPin,
  type UnlocatedClub,
} from "@/lib/clubs"

type Row = { kind: "pin"; club: ClubPin; miles: number | null } | { kind: "unlocated"; club: UnlocatedClub }

function matches(text: string, needle: string): boolean {
  return text.toLowerCase().includes(needle)
}

function ClubRow({ row, onDirections }: { row: Row; onDirections: (c: ClubPin) => void }) {
  // Narrow on the row, not on an alias — `row.club` only carries counts when kind is "pin".
  const club = row.club
  const place = [club.city, club.state].filter(Boolean).join(", ")
  const counts =
    row.kind === "pin"
      ? [
          row.club.athleteCount ? `${row.club.athleteCount} athletes` : null,
          row.club.commitCount ? `${row.club.commitCount} commits` : null,
        ].filter((v): v is string => Boolean(v))
      : []

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.name} numberOfLines={2}>
          {club.name}
        </Text>
        {row.kind === "pin" && row.miles != null ? (
          <Text style={styles.miles}>{row.miles < 10 ? row.miles.toFixed(1) : Math.round(row.miles)} mi</Text>
        ) : null}
      </View>

      {place ? <Text style={styles.place}>{place}</Text> : null}
      {counts.length ? <Text style={styles.counts}>{counts.join(" · ")}</Text> : null}
      {row.kind === "unlocated" ? (
        <Text style={styles.noPin}>No address on file — not shown on the map</Text>
      ) : null}

      <View style={styles.actions}>
        {row.kind === "pin" ? (
          <Pressable style={styles.action} onPress={() => onDirections(row.club)}>
            <Ionicons name="navigate" size={13} color={colors.gold} />
            <Text style={styles.actionText}>Directions</Text>
          </Pressable>
        ) : null}
        {club.contactPhone ? (
          <Pressable
            style={styles.action}
            onPress={() => void Linking.openURL(`tel:${club.contactPhone}`)}
          >
            <Ionicons name="call" size={13} color={colors.gold} />
            <Text style={styles.actionText}>Call</Text>
          </Pressable>
        ) : null}
        {club.website ? (
          <Pressable style={styles.action} onPress={() => void Linking.openURL(club.website!)}>
            <Ionicons name="globe" size={13} color={colors.gold} />
            <Text style={styles.actionText}>Website</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

/**
 * Club finder — Apple Maps with every geocoded club, over a searchable list.
 *
 * Location is asked for only when someone taps "Near me". Wrestling families look for a club by
 * name and by town as often as by distance, so the screen is useful before any permission is
 * granted, and a decline costs nothing but the sort order.
 *
 * Clubs we hold but could not geocode still appear in the list. They are real clubs; dropping
 * them because an address failed to resolve would quietly hide them from every search.
 */
export default function ClubsScreen() {
  const [pins, setPins] = useState<ClubPin[]>([])
  const [unlocated, setUnlocated] = useState<UnlocatedClub[]>([])
  const [query, setQuery] = useState("")
  const [origin, setOrigin] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationNote, setLocationNote] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const directory = await fetchClubs()
      setPins(directory.pins)
      setUnlocated(directory.unlocated)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load clubs.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const useMyLocation = useCallback(async () => {
    setLocating(true)
    setLocationNote(null)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        setLocationNote("Location is off. You can still search by name or town.")
        return
      }
      const position = await Location.getCurrentPositionAsync({})
      setOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude })
    } catch {
      setLocationNote("Could not get your location. You can still search by name or town.")
    } finally {
      setLocating(false)
    }
  }, [])

  const rows: Row[] = useMemo(() => {
    const needle = query.trim().toLowerCase()

    const pinRows: Row[] = pins
      .filter(
        (c) =>
          !needle ||
          matches(c.name, needle) ||
          matches(c.city ?? "", needle) ||
          matches(c.address ?? "", needle) ||
          matches(c.zipCode ?? "", needle),
      )
      .map((club) => ({
        kind: "pin" as const,
        club,
        miles: origin ? distanceMiles(origin, club) : null,
      }))

    pinRows.sort((a, b) => {
      if (a.kind !== "pin" || b.kind !== "pin") return 0
      if (a.miles != null && b.miles != null) return a.miles - b.miles
      return a.club.name.localeCompare(b.club.name)
    })

    const unlocatedRows: Row[] = unlocated
      .filter((c) => !needle || matches(c.name, needle) || matches(c.city ?? "", needle))
      .map((club) => ({ kind: "unlocated" as const, club }))

    return [...pinRows, ...unlocatedRows]
  }, [pins, unlocated, query, origin])

  const visiblePins = useMemo(
    () => rows.flatMap((r) => (r.kind === "pin" ? [r.club] : [])),
    [rows],
  )

  const selected = useMemo(
    () => visiblePins.find((c) => c.id === selectedId) ?? null,
    [visiblePins, selectedId],
  )

  // A pin that is no longer in the filtered set must not stay selected — otherwise searching
  // leaves a card on screen for a club the map is no longer showing.
  useEffect(() => {
    if (selectedId && !visiblePins.some((c) => c.id === selectedId)) setSelectedId(null)
  }, [visiblePins, selectedId])

  const camera = useMemo(() => {
    if (origin) return { coordinates: origin, zoom: 9 }
    return fitCamera(visiblePins)
  }, [origin, visiblePins])

  const markers = useMemo(
    () =>
      visiblePins.map((c) => ({
        id: c.id,
        coordinates: { latitude: c.latitude, longitude: c.longitude },
        title: c.name,
        tintColor: c.id === selectedId ? colors.gold : colors.red,
        systemImage: "figure.wrestling",
      })),
    [visiblePins, selectedId],
  )

  const openDirections = useCallback((club: ClubPin) => {
    void Linking.openURL(directionsUrl(club))
  }, [])

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.flexShrink}>
            <Text style={styles.eyebrow}>NORTH CAROLINA</Text>
            <Text style={styles.title} maxFontSizeMultiplier={1.4}>
              Clubs
            </Text>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : error ? (
        <View style={styles.centre}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retry} onPress={() => void load()}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.mapWrap}>
            <AppleMaps.View
              style={styles.map}
              cameraPosition={camera}
              markers={markers}
              onMarkerClick={(marker) => {
                if (marker.id) setSelectedId(marker.id)
              }}
            />
          </View>

          {selected ? (
            <View style={styles.selectedWrap}>
              <View style={styles.selectedHead}>
                <Text style={styles.selectedLabel}>SELECTED ON MAP</Text>
                <Pressable onPress={() => setSelectedId(null)} hitSlop={10} accessibilityLabel="Clear selection">
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
              <ClubRow
                row={{ kind: "pin", club: selected, miles: origin ? distanceMiles(origin, selected) : null }}
                onDirections={openDirections}
              />
            </View>
          ) : null}

          <View style={styles.controls}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={15} color={colors.textMuted} />
              <TextInput
                style={styles.search}
                value={query}
                onChangeText={setQuery}
                placeholder="Club, town or ZIP"
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
              />
              {query ? (
                <Pressable onPress={() => setQuery("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              style={[styles.nearMe, origin && styles.nearMeOn]}
              onPress={() => void useMyLocation()}
              disabled={locating}
            >
              {locating ? (
                <ActivityIndicator size="small" color={colors.gold} />
              ) : (
                <Ionicons name="locate" size={16} color={origin ? colors.ink : colors.gold} />
              )}
            </Pressable>
          </View>

          {locationNote ? <Text style={styles.locationNote}>{locationNote}</Text> : null}

          <FlatList
            data={rows}
            keyExtractor={(r) => `${r.kind}-${r.club.id}`}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <ClubRow row={item} onDirections={openDirections} />}
            ListHeaderComponent={
              <Text style={styles.count}>
                {rows.length} {rows.length === 1 ? "club" : "clubs"}
                {origin ? " · nearest first" : ""}
              </Text>
            }
            ListEmptyComponent={
              <Text style={styles.empty}>No clubs match “{query.trim()}”.</Text>
            }
          />
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  flexShrink: { flexShrink: 1 },
  eyebrow: { ...type.caption, color: colors.gold, marginBottom: space.xs },
  title: { ...type.display, color: colors.text },

  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, paddingHorizontal: space.xl },
  errorText: { ...type.body, color: colors.textSecondary, textAlign: "center" },
  retry: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  retryText: { ...type.label, color: colors.gold },

  mapWrap: {
    height: 260,
    marginHorizontal: space.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
  },
  map: { flex: 1 },

  selectedWrap: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.xs,
  },
  selectedHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectedLabel: { ...type.caption, color: colors.gold },
  controls: {
    flexDirection: "row",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  search: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 2 },
  nearMe: {
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
  },
  nearMeOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  locationNote: { ...type.label, color: colors.textMuted, paddingHorizontal: space.lg, paddingTop: space.sm },

  list: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xxl, gap: space.md },
  count: { ...type.caption, color: colors.textMuted, marginBottom: space.xs },
  empty: { ...type.body, color: colors.textMuted, textAlign: "center", marginTop: space.xl },

  card: {
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 3,
  },
  cardHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.sm },
  name: { ...type.heading, color: colors.text, flexShrink: 1 },
  miles: { ...type.label, color: colors.gold },
  place: { ...type.label, color: colors.textSecondary },
  counts: { ...type.label, color: colors.textMuted },
  noPin: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: "row", gap: space.lg, marginTop: space.sm },
  action: { flexDirection: "row", alignItems: "center", gap: 5 },
  actionText: { ...type.label, color: colors.gold },
})
