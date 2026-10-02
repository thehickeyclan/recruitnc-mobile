import { useCallback, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useFocusEffect } from "expo-router"
import Ionicons from "@expo/vector-icons/Ionicons"
import { Image } from "expo-image"

import { useSession } from "@/lib/auth"
import { fetchFollows, setFollowing, type FollowedAthlete } from "@/lib/follows"
import { colors, radius, space, type } from "@/theme/tokens"

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("")
}

/**
 * Following: the wrestlers whose results you get told about.
 *
 * Where a result digest lands when it is tapped — "Journeymen results are in, 4 wrestlers you
 * follow competed" opens here. Unfollowing is on this screen too, because the notification is the
 * only reason most people arrive and turning it off should not require finding the profile again.
 */
export default function FollowingScreen() {
  const { signedIn } = useSession()
  const [athletes, setAthletes] = useState<FollowedAthlete[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    return fetchFollows()
      .then(setAthletes)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load who you follow."))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const unfollow = (athlete: FollowedAthlete) => {
    /* Gone from the list straight away; put back if the save fails. */
    setAthletes((prev) => prev.filter((a) => a.id !== athlete.id))
    void setFollowing(athlete.id, false).catch(() => setAthletes((prev) => [athlete, ...prev]))
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.title}>Following</Text>
          <Text style={styles.sub}>
            {athletes.length > 0
              ? `${athletes.length} ${athletes.length === 1 ? "wrestler" : "wrestlers"} · alerts when results land`
              : "Alerts when their results land"}
          </Text>
        </View>
      </View>

      {!signedIn ? (
        <View style={styles.empty}>
          <Ionicons name="notifications-outline" size={32} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Sign in to follow wrestlers</Text>
          <Text style={styles.emptyBody}>
            Following sends you an alert when an event&apos;s results come in and one of your wrestlers was
            there. A free account is all it takes.
          </Text>
          <Pressable style={styles.action} onPress={() => router.push("/sign-in")}>
            <Text style={styles.actionText}>SIGN IN</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{error}</Text>
          <Pressable style={styles.action} onPress={() => void load()}>
            <Text style={styles.actionText}>TRY AGAIN</Text>
          </Pressable>
        </View>
      ) : athletes.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="notifications-outline" size={32} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Not following anyone yet</Text>
          <Text style={styles.emptyBody}>
            Open a wrestler and tap Follow. When an event&apos;s results come in, you get one alert naming
            who competed — not one per result.
          </Text>
          <Pressable style={styles.action} onPress={() => router.push("/athletes")}>
            <Text style={styles.actionText}>BROWSE ATHLETES</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={athletes}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                void load()
              }}
              tintColor={colors.gold}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push({ pathname: "/athlete/[id]", params: { id: item.id } })}
            >
              {item.photoUrl ? (
                <Image source={{ uri: item.photoUrl }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{initials(item.name)}</Text>
                </View>
              )}
              <View style={styles.flex}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {[item.classYear ? `'${String(item.classYear).slice(2)}` : null, item.weight ? `${item.weight} lbs` : null, item.school]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                {item.college ? <Text style={styles.committed} numberOfLines={1}>Committed · {item.college}</Text> : null}
              </View>
              <Pressable onPress={() => unfollow(item)} hitSlop={10} style={styles.bell}>
                <Ionicons name="notifications" size={18} color={colors.gold} />
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  back: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surface },
  title: { ...type.title, color: colors.text },
  sub: { ...type.caption, color: colors.textMuted, marginTop: 2 },

  list: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
  },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.raised },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarText: { ...type.label, color: colors.textMuted, fontWeight: "800" },
  name: { ...type.body, color: colors.text, fontWeight: "700" },
  meta: { ...type.caption, color: colors.textMuted, marginTop: 2 },
  committed: { ...type.caption, color: colors.gold, marginTop: 2 },
  bell: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl, gap: space.md },
  emptyTitle: { ...type.body, color: colors.text, fontWeight: "700", textAlign: "center" },
  emptyBody: { ...type.caption, color: colors.textMuted, textAlign: "center", lineHeight: 18 },
  action: { backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: space.md, paddingHorizontal: space.xl },
  actionText: { ...type.label, color: colors.ink, fontWeight: "800" },
})
